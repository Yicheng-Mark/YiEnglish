// 词本路由测试：supertest + require.cache 注入 mock（server/ 是 CommonJS，见 auth.test.js 头注）。
//
// 覆盖点：
// - GET /:bookType 对 trans 列脏数据（legacy 字符串 / 截断 JSON / null）的容错
//   （回归：修复前 JSON.parse 一行脏数据即让整本词书 500）
// - bookType 白名单校验
// - POST 输入校验与 wrongCount 夹取（回归：修复前超大计数溢出 SMALLINT → 500）
// - PUT 批量替换的过滤/去重/条数上限（回归：修复前批内重复词名触发唯一键冲突整批回滚）
import { describe, it, expect, beforeEach, vi } from 'vitest'
const express = require('express')
const supertest = require('supertest')

const USER_ID = 1

const mockExecute = vi.fn()
const mockConnQuery = vi.fn()
const mockConnExecute = vi.fn()
const mockConnection = {
  beginTransaction: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  release: vi.fn(),
  query: mockConnQuery,
  execute: mockConnExecute,
}
const mockGetConnection = vi.fn()
const fakePool = { execute: mockExecute, getConnection: mockGetConnection }
const fakeAuthMiddleware = (req, res, next) => {
  req.userId = USER_ID
  next()
}

function injectFakeModule(relPath, exports) {
  const resolved = require.resolve(relPath)
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports,
    paths: [],
    children: [],
  }
}

injectFakeModule('../db', fakePool)
injectFakeModule('../middleware/auth', fakeAuthMiddleware)

const wordbooksRouter = require('./wordbooks')

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/wordbooks', wordbooksRouter)
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ error: err.message || '服务器错误' })
  })
  return app
}

function makeRow(wordName, trans) {
  return {
    word_name: wordName,
    trans,
    notation: null,
    usphone: null,
    ukphone: null,
    us_audio: null,
    uk_audio: null,
    wrong_count: 1,
    last_wrong_at: null,
    dict_name: 'CET4',
    created_at: '2026-06-01 10:00:00',
  }
}

beforeEach(() => {
  mockExecute.mockReset().mockResolvedValue([[], []])
  mockConnQuery.mockReset().mockResolvedValue([[], []])
  mockConnExecute.mockReset().mockResolvedValue([[], []])
  mockConnection.beginTransaction.mockReset().mockResolvedValue()
  mockConnection.commit.mockReset().mockResolvedValue()
  mockConnection.rollback.mockReset().mockResolvedValue()
  mockConnection.release.mockReset()
  mockGetConnection.mockReset().mockResolvedValue(mockConnection)
})

describe('GET /api/wordbooks/:bookType', () => {
  it('trans 为合法 JSON 数组字符串 → 解析为数组', async () => {
    mockExecute.mockResolvedValue([[makeRow('a', '["[n] 苹果"]')], []])
    const res = await supertest(makeApp()).get('/api/wordbooks/error')
    expect(res.status).toBe(200)
    expect(res.body.words[0].trans).toEqual(['[n] 苹果'])
    expect(res.body.words[0].name).toBe('a')
    expect(res.body.words[0]).toMatchObject({ wrongCount: 1, dictName: 'CET4' })
  })

  it('trans 为 legacy 普通字符串 → 包装为单元素数组而非 500（回归）', async () => {
    mockExecute.mockResolvedValue([[makeRow('b', '[n] 书')], []])
    const res = await supertest(makeApp()).get('/api/wordbooks/error')
    expect(res.status).toBe(200)
    expect(res.body.words[0].trans).toEqual(['[n] 书'])
  })

  it('trans 为截断的 JSON → 原样降级为单元素数组而非 500（回归）', async () => {
    mockExecute.mockResolvedValue([[makeRow('c', '["[n] 截')], []])
    const res = await supertest(makeApp()).get('/api/wordbooks/error')
    expect(res.status).toBe(200)
    expect(res.body.words[0].trans).toEqual(['["[n] 截'])
  })

  it('trans 为 null → 空数组', async () => {
    mockExecute.mockResolvedValue([[makeRow('d', null)], []])
    const res = await supertest(makeApp()).get('/api/wordbooks/error')
    expect(res.status).toBe(200)
    expect(res.body.words[0].trans).toEqual([])
  })

  it('一行脏数据不影响其他行（整本不 500）', async () => {
    mockExecute.mockResolvedValue([
      [makeRow('a', '["[n] 苹果"]'), makeRow('bad', 'not-json'), makeRow('e', '["[v] 吃"]')],
      [],
    ])
    const res = await supertest(makeApp()).get('/api/wordbooks/error')
    expect(res.status).toBe(200)
    expect(res.body.words).toHaveLength(3)
    expect(res.body.words.map((w) => w.name)).toEqual(['a', 'bad', 'e'])
  })

  it('非法 bookType → 400', async () => {
    const res = await supertest(makeApp()).get('/api/wordbooks/nope')
    expect(res.status).toBe(400)
  })
})

describe('POST /api/wordbooks/:bookType · 输入校验', () => {
  function errorInsertCall() {
    return mockExecute.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO user_word_books')
    )
  }

  it('name 非字符串或超长 → 400（回归：修复前对象 name 直接进 SQL 触发驱动层 500）', async () => {
    const bad = await supertest(makeApp())
      .post('/api/wordbooks/error')
      .send({ name: { inject: 1 } })
    expect(bad.status).toBe(400)
    expect(bad.body.error).toBe('无效的单词名称')

    const long = await supertest(makeApp())
      .post('/api/wordbooks/error')
      .send({ name: 'x'.repeat(256) })
    expect(long.status).toBe(400)
  })

  it('wrongCount/delta 超大被夹取到 65535（回归：修复前溢出 SMALLINT → 500）', async () => {
    const res = await supertest(makeApp())
      .post('/api/wordbooks/error')
      .send({ name: 'apple', wrongCount: 70000, delta: 99999 })
    expect(res.status).toBe(200)
    const params = errorInsertCall()[1]
    // params: [userId, bookType, name, trans, notation, usphone, ukphone, us, uk, insertCount, dictName, deltaCount]
    expect(params[9]).toBe(65535)
    expect(params[11]).toBe(65535)
    // SQL 侧对累计值再夹一次，防长期累计溢出
    expect(errorInsertCall()[0]).toContain('wrong_count = LEAST(65535, wrong_count + ?)')
  })

  it('非 error 词本不写计数列', async () => {
    const res = await supertest(makeApp()).post('/api/wordbooks/favorite').send({ name: 'apple' })
    expect(res.status).toBe(200)
    const call = errorInsertCall()
    expect(call[0]).not.toContain('wrong_count')
    expect(call[1][2]).toBe('apple')
  })
})

describe('PUT /api/wordbooks/:bookType · 批量替换', () => {
  function putInsertCall() {
    return mockConnQuery.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT IGNORE INTO user_word_books')
    )
  }

  it('缺 name/超长条目被过滤，批内重复按词名去重（回归：修复前重复词名触发唯一键冲突整批回滚，enrich 同步永久失败）', async () => {
    const res = await supertest(makeApp())
      .put('/api/wordbooks/error')
      .send({
        words: [
          { name: 'apple', wrongCount: 2 },
          { name: 'apple', wrongCount: 5 }, // 批内重复 → 去重
          { trans: 'no-name' }, // 缺 name → 过滤
          { name: 'x'.repeat(300) }, // 超长 → 过滤
          {
            name: 'dog',
            wrongCount: 70000,
            lastWrongTime: 'not-a-date',
            dictName: 'd'.repeat(200),
          },
        ],
      })
    expect(res.status).toBe(200)
    expect(res.body.count).toBe(2)
    const rows = putInsertCall()[1][0]
    expect(rows.map((r) => r[2])).toEqual(['apple', 'dog'])
    // 行布局：[..., wrongCount(9), lastWrongAt(10), dictName(11)]
    expect(rows[1][9]).toBe(65535)
    expect(rows[1][10]).toBeNull() // 无效日期回退 null 而非 Invalid Date（后者 mysql2 序列化抛错）
    expect(rows[1][11]).toBe('d'.repeat(100)) // dictName 截断到列宽
  })

  it('words 非数组或超过 2000 条 → 400', async () => {
    const bad = await supertest(makeApp()).put('/api/wordbooks/error').send({ words: 'nope' })
    expect(bad.status).toBe(400)

    const tooMany = await supertest(makeApp())
      .put('/api/wordbooks/error')
      .send({ words: Array.from({ length: 2001 }, (_, i) => ({ name: `w${i}` })) })
    expect(tooMany.status).toBe(400)
    expect(tooMany.body.error).toBe('单次最多同步 2000 个单词')
  })

  it('INSERT 使用静态 SQL + 嵌套数组参数', async () => {
    await supertest(makeApp())
      .put('/api/wordbooks/favorite')
      .send({ words: [{ name: 'apple' }] })
    const call = putInsertCall()
    expect(call[0]).toBe(
      'INSERT IGNORE INTO user_word_books (user_id, book_type, word_name, trans, notation, usphone, ukphone, us_audio, uk_audio, wrong_count, last_wrong_at, dict_name) VALUES ?'
    )
    expect(call[1][0][0][2]).toBe('apple')
  })
})
