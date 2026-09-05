// 收藏词库路由测试：GET 列表、toggle 开/关两条路径。db、auth 中间件注入 fake。

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

const favoritesRouter = require('./favorites')

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/favorites', favoritesRouter)
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ error: err.message || '服务器错误' })
  })
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  mockExecute.mockResolvedValue([[], []])
})

describe('GET /api/favorites', () => {
  it('返回 dict_id 数组', async () => {
    mockExecute.mockResolvedValue([[{ dict_id: 'cet4' }, { dict_id: 'ielts-freq' }], []])
    const res = await supertest(makeApp()).get('/api/favorites')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ dicts: ['cet4', 'ielts-freq'] })
    const [sql, params] = mockExecute.mock.calls[0]
    expect(String(sql)).toContain('ORDER BY created_at')
    expect(params).toEqual([USER_ID])
  })

  it('无收藏 → 空数组', async () => {
    const res = await supertest(makeApp()).get('/api/favorites')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ dicts: [] })
  })
})

describe('POST /api/favorites/toggle', () => {
  it('缺 dictId → 400', async () => {
    const res = await supertest(makeApp()).post('/api/favorites/toggle').send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/缺少 dictId/)
  })

  it('dictId 为 truthy 对象 → 400，不进入 DB 查询（回归：对象入参触发 500）', async () => {
    const res = await supertest(makeApp())
      .post('/api/favorites/toggle')
      .send({ dictId: { id: 'cet4' } })
    expect(res.status).toBe(400)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it('dictId 超过 50 字符（DB 列 VARCHAR(50) 上限）→ 400，不进入 DB 查询', async () => {
    const res = await supertest(makeApp())
      .post('/api/favorites/toggle')
      .send({ dictId: 'x'.repeat(51) })
    expect(res.status).toBe(400)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it('dictId 为纯空白字符串 → 400', async () => {
    const res = await supertest(makeApp()).post('/api/favorites/toggle').send({ dictId: '   ' })
    expect(res.status).toBe(400)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it('dictId 恰好 50 字符（边界）→ 正常入库', async () => {
    const id = 'd'.repeat(50)
    const res = await supertest(makeApp()).post('/api/favorites/toggle').send({ dictId: id })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ isFavorite: true })
    const [, params] = mockExecute.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO user_favorite_dicts')
    )
    expect(params).toEqual([USER_ID, id])
  })

  it('已收藏 → DELETE 并返回 isFavorite:false', async () => {
    mockExecute.mockImplementation(async (sql) => {
      if (String(sql).includes('SELECT 1')) return [[{ 1: 1 }], []]
      return [{ affectedRows: 1 }, []]
    })
    const res = await supertest(makeApp()).post('/api/favorites/toggle').send({ dictId: 'cet4' })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ isFavorite: false })
    const sqls = mockExecute.mock.calls.map(([sql]) => String(sql))
    expect(sqls.some((s) => s.includes('DELETE FROM user_favorite_dicts'))).toBe(true)
    expect(sqls.some((s) => s.includes('INSERT INTO user_favorite_dicts'))).toBe(false)
  })

  it('未收藏 → INSERT 并返回 isFavorite:true', async () => {
    mockExecute.mockResolvedValue([[], []])
    const res = await supertest(makeApp()).post('/api/favorites/toggle').send({ dictId: 'cet4' })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ isFavorite: true })
    const [sql, params] = mockExecute.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO user_favorite_dicts')
    )
    expect(params).toEqual([USER_ID, 'cet4'])
  })
})
