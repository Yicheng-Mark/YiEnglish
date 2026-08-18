// progress 路由测试：批量提交的输入校验（回归：对象元素曾直接进 SQL 触发 500）。
import { describe, it, expect, beforeEach, vi } from 'vitest'
const express = require('express')
const supertest = require('supertest')

const USER_ID = 1

const mockExecute = vi.fn()
const fakePool = { execute: mockExecute, query: mockExecute }
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

const progressRouter = require('./progress')

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/progress', progressRouter)
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ error: err.message || '服务器错误' })
  })
  return app
}

beforeEach(() => {
  mockExecute.mockReset()
  mockExecute.mockResolvedValue([[], []])
})

function insertCall() {
  return mockExecute.mock.calls.find(([sql]) =>
    String(sql).includes('INSERT IGNORE INTO word_progress')
  )
}

describe('POST /api/progress · 输入校验', () => {
  it('合法请求 → 静态 SQL + 嵌套数组参数', async () => {
    const res = await supertest(makeApp())
      .post('/api/progress')
      .send({ dictId: 'cet4', chapterId: 3, words: ['apple', 'apply'] })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(insertCall()[0]).toBe(
      'INSERT IGNORE INTO word_progress (user_id, dict_id, chapter_id, word_name) VALUES ?'
    )
    expect(insertCall()[1]).toEqual([
      [
        [USER_ID, 'cet4', 3, 'apple'],
        [USER_ID, 'cet4', 3, 'apply'],
      ],
    ])
  })

  it('words 含对象元素 → 400，不触达数据库（回归：曾直接进 SQL 500）', async () => {
    const res = await supertest(makeApp())
      .post('/api/progress')
      .send({ dictId: 'cet4', chapterId: 3, words: ['apple', { name: 'inject' }] })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('单词列表包含非法元素')
    expect(insertCall()).toBeUndefined()
  })

  it('words 含空字符串 → 400', async () => {
    const res = await supertest(makeApp())
      .post('/api/progress')
      .send({ dictId: 'cet4', chapterId: 3, words: ['apple', '   '] })
    expect(res.status).toBe(400)
  })

  it('words 超过 500 个 → 400', async () => {
    const words = Array.from({ length: 501 }, (_, i) => `w${i}`)
    const res = await supertest(makeApp())
      .post('/api/progress')
      .send({ dictId: 'cet4', chapterId: 3, words })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('单次最多提交 500 个单词')
  })

  it('chapterId 非数字 → 400；数字字符串被规范化', async () => {
    const bad = await supertest(makeApp())
      .post('/api/progress')
      .send({ dictId: 'cet4', chapterId: 'abc', words: ['apple'] })
    expect(bad.status).toBe(400)
    expect(bad.body.error).toBe('无效的章节标识')

    const ok = await supertest(makeApp())
      .post('/api/progress')
      .send({ dictId: 'cet4', chapterId: '5', words: ['apple'] })
    expect(ok.status).toBe(200)
    expect(insertCall()[1]).toEqual([[[USER_ID, 'cet4', 5, 'apple']]])
  })

  it('dictId 非字符串 → 400', async () => {
    const res = await supertest(makeApp())
      .post('/api/progress')
      .send({ dictId: 123, chapterId: 3, words: ['apple'] })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('无效的词库标识')
  })

  it('dictId 超过列宽 50 字符 → 400（回归：修复前上限 100，51-100 字符过校验后触发 ER_DATA_TOO_LONG 500）', async () => {
    const res = await supertest(makeApp())
      .post('/api/progress')
      .send({ dictId: 'd'.repeat(51), chapterId: 3, words: ['apple'] })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('无效的词库标识')
    expect(insertCall()).toBeUndefined()
  })

  it('dictId 首尾空白被 trim 后入库', async () => {
    const res = await supertest(makeApp())
      .post('/api/progress')
      .send({ dictId: '  cet4  ', chapterId: 3, words: ['apple'] })
    expect(res.status).toBe(200)
    expect(insertCall()[1]).toEqual([[[USER_ID, 'cet4', 3, 'apple']]])
  })
})

describe('GET /api/progress/:dictId', () => {
  it('按章节聚合返回完成数', async () => {
    mockExecute.mockResolvedValue([
      [
        { chapter_id: 0, completed_count: 25 },
        { chapter_id: 2, completed_count: 10 },
      ],
      [],
    ])
    const res = await supertest(makeApp()).get('/api/progress/cet4')
    expect(res.status).toBe(200)
    expect(res.body.chapters).toEqual({ 0: 25, 2: 10 })
  })
})
