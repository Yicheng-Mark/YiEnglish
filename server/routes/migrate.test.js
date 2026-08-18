// migrate 路由测试：localStorage → MySQL 一次性迁移的兼容与防御逻辑。
//
// 覆盖：
// - 字符串释义包装成数组（回归：老用户字符串释义迁移后曾变 null 丢失）
// - theme 白名单与 wordRepeatCount 1-10 夹取（与 settings.js 同标）
// - 缺名字的畸形条目跳过而非让整个事务回滚
import { describe, it, expect, beforeEach, vi } from 'vitest'
const express = require('express')
const supertest = require('supertest')

const USER_ID = 1

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

injectFakeModule('../db', { execute: vi.fn(), getConnection: mockGetConnection })
injectFakeModule('../middleware/auth', (req, res, next) => {
  req.userId = USER_ID
  next()
})

const migrateRouter = require('./migrate')

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/migrate', migrateRouter)
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ error: err.message || '服务器错误' })
  })
  return app
}

function post(body) {
  return supertest(makeApp()).post('/api/migrate/local-to-server').send(body)
}

function bookInsertCall() {
  return mockConnQuery.mock.calls.find(([sql]) => String(sql).includes('user_word_books'))
}

function settingsUpdateCall() {
  return mockConnQuery.mock.calls.find(([sql]) => String(sql).includes('UPDATE user_settings'))
}

beforeEach(() => {
  mockConnQuery.mockReset().mockResolvedValue([[], []])
  mockConnExecute.mockReset().mockResolvedValue([[], []])
  mockConnection.beginTransaction.mockReset().mockResolvedValue()
  mockConnection.commit.mockReset().mockResolvedValue()
  mockConnection.rollback.mockReset().mockResolvedValue()
  mockConnection.release.mockReset()
  mockGetConnection.mockReset().mockResolvedValue(mockConnection)
})

describe('POST /api/migrate/local-to-server', () => {
  it('字符串释义包装成单元素数组入库（回归：曾直接存 null 丢失释义）', async () => {
    const res = await post({
      favoriteWords: [
        { name: 'apple', trans: '[n] 苹果' }, // legacy 字符串形态
        { name: 'dog', trans: ['[n] 狗'] }, // 数组形态不受影响
      ],
    })
    expect(res.status).toBe(200)
    const params = bookInsertCall()[1][0]
    expect(params[0][2]).toBe('apple')
    expect(params[0][3]).toBe('["[n] 苹果"]')
    expect(params[1][3]).toBe('["[n] 狗"]')
  })

  it('theme 不在白名单则忽略，合法 theme 入库', async () => {
    await post({ theme: 'hacker' })
    expect(settingsUpdateCall()).toBeUndefined()
    expect(mockConnection.commit).toHaveBeenCalled()

    mockConnQuery.mockClear()
    await post({ theme: 'warm' })
    expect(settingsUpdateCall()[1]).toEqual([{ theme: 'warm' }, USER_ID])
  })

  it('wordRepeatCount 夹取到 1-10，非数字回退 1', async () => {
    await post({ config: { wordRepeatCount: 99 } })
    expect(settingsUpdateCall()[1][0].word_repeat_count).toBe(10)

    mockConnQuery.mockClear()
    await post({ config: { wordRepeatCount: 'abc' } })
    expect(settingsUpdateCall()[1][0].word_repeat_count).toBe(1)
  })

  it('缺名字的畸形条目被跳过，不让整个迁移失败', async () => {
    const res = await post({
      favoriteWords: [{ trans: '无名字' }, { name: 'ok', trans: 'y' }],
      errorBook: [{ word: 'zzz', wrongCount: 3 }], // { word } 形态应被接受
    })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    // favorite 与 error book 是两次独立 INSERT，跨调用聚合所有行
    const allRows = mockConnQuery.mock.calls
      .filter(([sql]) => String(sql).includes('user_word_books'))
      .flatMap(([, params]) => params[0])
    const names = allRows.map((row) => row[2])
    expect(names).toEqual(['ok', 'zzz'])
  })

  it('某条 SQL 失败 → 回滚事务并返回 500', async () => {
    mockConnQuery.mockRejectedValueOnce(new Error('db down'))
    const res = await post({ favoriteWords: [{ name: 'apple', trans: 'x' }] })
    expect(res.status).toBe(500)
    expect(mockConnection.rollback).toHaveBeenCalled()
    expect(mockConnection.commit).not.toHaveBeenCalled()
  })

  it('超长字段截断到列宽、wrongCount 夹取、无效日期回退当前时间（回归：修复前超宽数据触发 ER_DATA_TOO_LONG 让整个迁移 500）', async () => {
    const res = await post({
      favoriteWords: [
        { name: 'x'.repeat(300), notation: 'n'.repeat(300), usphone: 'p'.repeat(200) },
      ],
      errorBook: [
        { word: 'bad', wrongCount: 99999, lastWrongTime: 'not-a-date', dictName: 'd'.repeat(200) },
      ],
    })
    expect(res.status).toBe(200)

    const allRows = mockConnQuery.mock.calls
      .filter(([sql]) => String(sql).includes('user_word_books'))
      .flatMap(([, params]) => params[0])
    // favorite 行布局：[userId, bookType, name(2), trans(3), notation(4), usphone(5), ...]
    const favRow = allRows.find((r) => r[2] === 'x'.repeat(255))
    expect(favRow).toBeTruthy()
    expect(favRow[4]).toBe('n'.repeat(255))
    expect(favRow[5]).toBe('p'.repeat(100))
    // error 行布局：[..., wrongCount(9), lastWrongAt(10), dictName(11)]
    const errRow = allRows.find((r) => r[2] === 'bad')
    expect(errRow[9]).toBe(65535)
    expect(errRow[10]).toBeInstanceOf(Date)
    expect(errRow[11]).toBe('d'.repeat(100))
  })

  it('超长收藏词库 id（>50）被跳过（回归：修复前 ≤100 的 id 过滤后仍超 VARCHAR(50) 列宽）', async () => {
    const res = await post({ favoriteDicts: ['ok-dict', 'x'.repeat(51)] })
    expect(res.status).toBe(200)
    const call = mockConnQuery.mock.calls.find(([sql]) =>
      String(sql).includes('user_favorite_dicts')
    )
    expect(call[1][0]).toEqual([[USER_ID, 'ok-dict']])
  })
})
