// authMiddleware 单元测试：挂在临时 express app 上直测中间件本体。
// 覆盖：无 token / 无效 token / 过期 token / 正式用户放行 /
//       体验用户 trialExp 快照判定（免查库）/ 老格式回查 DB / DB 故障 fail-open。
// config、db、logger 注入 fake（require.cache 方式，原因见 routes/auth.test.js 头注释）。

import { describe, it, expect, beforeEach, vi } from 'vitest'
const express = require('express')
const cookieParser = require('cookie-parser')
const supertest = require('supertest')
const jwt = require('jsonwebtoken')

const FIXED_JWT_SECRET = 'test-jwt-secret-fixed-for-auth-middleware'
const FIXED_CONFIG = { JWT_SECRET: FIXED_JWT_SECRET, NODE_ENV: 'development' }

const mockExecute = vi.fn()
const fakePool = { execute: mockExecute }
const fakeLogger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() }

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
injectCache('../config', FIXED_CONFIG)
injectCache('../db', fakePool)
injectCache('../utils/logger', fakeLogger)

const authMiddleware = require('./auth')

function makeApp() {
  const app = express()
  app.use(cookieParser())
  app.use(authMiddleware)
  app.get('/ping', (req, res) => res.json({ userId: req.userId, isGuest: req.isGuest }))
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  mockExecute.mockResolvedValue([[], []])
})

describe('token 缺失/无效', () => {
  it('无 cookie → 401「请先登录」', async () => {
    const res = await supertest(makeApp()).get('/ping')
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/请先登录/)
  })

  it('token 非法 → 401「请先登录」', async () => {
    const res = await supertest(makeApp()).get('/ping').set('Cookie', 'lf_access_token=not-a-jwt')
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/请先登录/)
  })

  it('token 过期 → 401 且 code=TOKEN_EXPIRED（前端据此自动 refresh）', async () => {
    // jsonwebtoken v9：exp 属于 payload 声明，不能放 options
    const token = jwt.sign({ userId: 7, exp: Math.floor(Date.now() / 1000) - 10 }, FIXED_JWT_SECRET)
    const res = await supertest(makeApp())
      .get('/ping')
      .set('Cookie', 'lf_access_token=' + token)
    expect(res.status).toBe(401)
    expect(res.body.code).toBe('TOKEN_EXPIRED')
  })
})

describe('正式用户', () => {
  it('有效 token → 放行并盖章 userId/isGuest=false，不查库', async () => {
    const token = jwt.sign({ userId: 7 }, FIXED_JWT_SECRET, { expiresIn: '30m' })
    const res = await supertest(makeApp())
      .get('/ping')
      .set('Cookie', 'lf_access_token=' + token)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ userId: 7, isGuest: false })
    expect(mockExecute).not.toHaveBeenCalled()
  })
})

describe('体验用户（trial 快照免查库路径）', () => {
  it('trialExp 未到期 → 放行且不查库', async () => {
    const token = jwt.sign(
      { userId: 8, isGuest: true, trialExp: new Date(Date.now() + 3600 * 1000).toISOString() },
      FIXED_JWT_SECRET,
      { expiresIn: '30m' }
    )
    const res = await supertest(makeApp())
      .get('/ping')
      .set('Cookie', 'lf_access_token=' + token)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ userId: 8, isGuest: true })
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it('trialExp 已到期 → 401 且 code=TRIAL_EXPIRED', async () => {
    const token = jwt.sign(
      { userId: 8, isGuest: true, trialExp: new Date(Date.now() - 1000).toISOString() },
      FIXED_JWT_SECRET,
      { expiresIn: '30m' }
    )
    const res = await supertest(makeApp())
      .get('/ping')
      .set('Cookie', 'lf_access_token=' + token)
    expect(res.status).toBe(401)
    expect(res.body.code).toBe('TRIAL_EXPIRED')
  })

  it('trialExp 格式异常（无法解析）→ 回查 DB 而非直接放行', async () => {
    const token = jwt.sign({ userId: 8, isGuest: true, trialExp: 'not-a-date' }, FIXED_JWT_SECRET, {
      expiresIn: '30m',
    })
    mockExecute.mockResolvedValue([[{ expires_at: new Date(Date.now() + 3600 * 1000) }], []])
    const res = await supertest(makeApp())
      .get('/ping')
      .set('Cookie', 'lf_access_token=' + token)
    expect(res.status).toBe(200)
    expect(mockExecute).toHaveBeenCalledTimes(1)
  })
})

describe('体验用户（老格式 token，回查 DB 路径）', () => {
  const oldGuestToken = () =>
    jwt.sign({ userId: 8, isGuest: true }, FIXED_JWT_SECRET, { expiresIn: '30m' })

  it('DB 记录未到期 → 放行', async () => {
    mockExecute.mockResolvedValue([[{ expires_at: new Date(Date.now() + 3600 * 1000) }], []])
    const res = await supertest(makeApp())
      .get('/ping')
      .set('Cookie', 'lf_access_token=' + oldGuestToken())
    expect(res.status).toBe(200)
  })

  it('DB 记录已到期 → 401 TRIAL_EXPIRED', async () => {
    mockExecute.mockResolvedValue([[{ expires_at: new Date(Date.now() - 3600 * 1000) }], []])
    const res = await supertest(makeApp())
      .get('/ping')
      .set('Cookie', 'lf_access_token=' + oldGuestToken())
    expect(res.status).toBe(401)
    expect(res.body.code).toBe('TRIAL_EXPIRED')
  })

  it('无 trial_activations 记录 → 401 TRIAL_EXPIRED', async () => {
    mockExecute.mockResolvedValue([[], []])
    const res = await supertest(makeApp())
      .get('/ping')
      .set('Cookie', 'lf_access_token=' + oldGuestToken())
    expect(res.status).toBe(401)
    expect(res.body.code).toBe('TRIAL_EXPIRED')
  })

  it('DB 查询抛错 → fail-open 放行并 warn（有意权衡，勿改成 fail-closed）', async () => {
    mockExecute.mockRejectedValue(new Error('db down'))
    const res = await supertest(makeApp())
      .get('/ping')
      .set('Cookie', 'lf_access_token=' + oldGuestToken())
    expect(res.status).toBe(200)
    expect(fakeLogger.warn).toHaveBeenCalled()
  })
})
