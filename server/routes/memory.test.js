// 长期记忆路由测试：体验用户 403（requireFullAccount 真实逻辑）、正式用户返回列表。
// db、auth 中间件注入 fake（auth 按 currentAuth 盖章以切换 guest/正式身份）。

import { describe, it, expect, beforeEach, vi } from 'vitest'
const express = require('express')
const cookieParser = require('cookie-parser')
const supertest = require('supertest')

const USER_ID = 42
let currentAuth = { userId: USER_ID, isGuest: false }
const fakeAuthMiddleware = (req, res, next) => {
  req.userId = currentAuth.userId
  req.isGuest = currentAuth.isGuest
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

const memoryRouter = require('./memory')

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/memory', memoryRouter)
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ error: err.message || '服务器错误' })
  })
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  currentAuth = { userId: USER_ID, isGuest: false }
  mockExecute.mockResolvedValue([[], []])
})

describe('GET /api/memory', () => {
  it('体验用户 → 403 且 code=TRIAL_FORBIDDEN（前端据此引导升级）', async () => {
    currentAuth = { userId: USER_ID, isGuest: true }
    const res = await supertest(makeApp()).get('/api/memory')
    expect(res.status).toBe(403)
    expect(res.body.code).toBe('TRIAL_FORBIDDEN')
    expect(res.body.error).toMatch(/正式账号/)
  })

  it('正式用户 → 返回 memories（LIMIT 50，倒序）', async () => {
    const rows = [
      { id: 2, category: 'preference', content: '喜欢简洁回复', created_at: '2026-01-02' },
      { id: 1, category: 'name', content: '名字是 Alice', created_at: '2026-01-01' },
    ]
    mockExecute.mockResolvedValue([rows, []])
    const res = await supertest(makeApp()).get('/api/memory')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ memories: rows })
    const [sql, params] = mockExecute.mock.calls[0]
    expect(String(sql)).toContain('ORDER BY created_at DESC LIMIT 50')
    expect(params).toEqual([USER_ID])
  })

  it('无记忆 → 空数组', async () => {
    const res = await supertest(makeApp()).get('/api/memory')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ memories: [] })
  })
})
