// 用户设置路由测试：GET 读取（含老用户兜底 INSERT）、PATCH 白名单字段更新
// 与 theme/word_repeat_count 的取值收敛。db、auth 中间件注入 fake。

import { describe, it, expect, beforeEach, vi } from 'vitest'
const express = require('express')
const cookieParser = require('cookie-parser')
const supertest = require('supertest')

const USER_ID = 42
const fakeAuthMiddleware = (req, res, next) => {
  req.userId = USER_ID
  next()
}

const mockExecute = vi.fn()
const fakePool = { execute: mockExecute }

function injectCache(modulePath, exports) {
  const resolved = require.resolve(modulePath)
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports,
    paths: [],
    children: [],
  }
}
injectCache('../db', fakePool)
injectCache('../middleware/auth', fakeAuthMiddleware)

const settingsRouter = require('./settings')

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/settings', settingsRouter)
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ error: err.message || '服务器错误' })
  })
  return app
}

const SAMPLE_ROW = {
  sound_enabled: 1,
  show_translation: 0,
  show_phonetic: 1,
  dictation_mode: 0,
  word_repeat_count: 3,
  auto_remove_error_word: 1,
  theme: 'gray',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockExecute.mockResolvedValue([[SAMPLE_ROW], []])
})

describe('GET /api/settings', () => {
  it('有行 → 返回驼峰映射后的设置', async () => {
    const res = await supertest(makeApp()).get('/api/settings')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      soundEnabled: true,
      showTranslation: false,
      showPhonetic: true,
      hideEnglish: false,
      wordRepeatCount: 3,
      autoRemoveErrorWord: true,
      theme: 'gray',
    })
  })

  it('老用户无行 → 兜底 INSERT 后重查并返回', async () => {
    mockExecute.mockImplementation(async (sql) => {
      if (String(sql).includes('INSERT IGNORE')) return [{ affectedRows: 1 }, []]
      // 第一次 SELECT 空、第二次返回行：按调用序区分
      const calls = mockExecute.mock.calls.length
      if (String(sql).includes('SELECT') && calls === 1) return [[], []]
      return [[SAMPLE_ROW], []]
    })
    const res = await supertest(makeApp()).get('/api/settings')
    expect(res.status).toBe(200)
    expect(res.body.theme).toBe('gray')
    const sqls = mockExecute.mock.calls.map(([sql]) => String(sql))
    expect(sqls.some((s) => s.includes('INSERT IGNORE INTO user_settings'))).toBe(true)
  })

  it('INSERT 后仍无行（极端情况）→ 500 设置读取失败', async () => {
    mockExecute.mockResolvedValue([[], []])
    const res = await supertest(makeApp()).get('/api/settings')
    expect(res.status).toBe(500)
    expect(res.body.error).toMatch(/设置读取失败/)
  })
})

describe('PATCH /api/settings', () => {
  it('合法 theme → UPDATE 成功', async () => {
    const res = await supertest(makeApp()).patch('/api/settings').send({ theme: 'warm' })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true })
    const [sql, params] = mockExecute.mock.calls.find(([sql]) =>
      String(sql).includes('UPDATE user_settings')
    )
    expect(String(sql)).toContain('theme = ?')
    expect(params).toEqual(['warm', USER_ID])
  })

  it('非法 theme 被忽略；无其他有效字段 → 400 没有有效的更新字段', async () => {
    const res = await supertest(makeApp()).patch('/api/settings').send({ theme: 'dark' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/没有有效的更新字段/)
    expect(mockExecute).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE'),
      expect.anything()
    )
  })

  it('word_repeat_count 收敛到 [1,10] 并取整（回归：浮点/越界值不得进 SQL）', async () => {
    const res = await supertest(makeApp()).patch('/api/settings').send({ wordRepeatCount: 99.6 })
    expect(res.status).toBe(200)
    const [, params] = mockExecute.mock.calls.find(([sql]) =>
      String(sql).includes('UPDATE user_settings')
    )
    expect(params[0]).toBe(10)

    // 第二次请求取「最后一次」UPDATE 调用（mock.calls 累积，不能取首个）
    const res2 = await supertest(makeApp()).patch('/api/settings').send({ wordRepeatCount: 0 })
    expect(res2.status).toBe(200)
    const updateCalls = mockExecute.mock.calls.filter(([sql]) =>
      String(sql).includes('word_repeat_count = ?')
    )
    const [, params2] = updateCalls[updateCalls.length - 1]
    expect(params2[0]).toBe(1)
  })

  it('布尔字段强转 1/0（truthy/falsy），非法 theme 与布尔字段混发时仅保留布尔字段', async () => {
    const res = await supertest(makeApp())
      .patch('/api/settings')
      .send({ theme: 'neon', soundEnabled: true, showTranslation: 0 })
    expect(res.status).toBe(200)
    const [sql, params] = mockExecute.mock.calls.find(([sql]) =>
      String(sql).includes('UPDATE user_settings')
    )
    const s = String(sql)
    expect(s).toContain('sound_enabled = ?')
    expect(s).toContain('show_translation = ?')
    expect(s).not.toContain('theme = ?')
    expect(params).toEqual([1, 0, USER_ID])
  })

  it('未知字段全部忽略 → 400', async () => {
    const res = await supertest(makeApp()).patch('/api/settings').send({ hacker: 1 })
    expect(res.status).toBe(400)
  })
})
