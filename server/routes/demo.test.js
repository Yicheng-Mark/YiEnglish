// 体验码（demo）路由测试：supertest 驱动临时 express app，全程 mock。
//
// mock 策略与 auth.test.js 相同（require.cache 注入，原因见该文件头注释）：
//   - ../db、../config、../middleware/rateLimit 注入 fake；
//   - ../middleware/auth 注入"直接放行并盖章 req.userId"的假中间件（真实鉴权行为
//     由 middleware/auth.test.js 单独覆盖）；
//   - ../utils/tokens 走真实实现（其依赖 config/db 已被 fake），从而覆盖
//     issueTokens 写 cookie、ensureDeviceCookie 签发设备 cookie 的真实行为。

import { describe, it, expect, beforeEach, vi } from 'vitest'
const express = require('express')
const cookieParser = require('cookie-parser')
const supertest = require('supertest')
const jwt = require('jsonwebtoken')

// --- 固定配置 ---
const FIXED_JWT_SECRET = 'test-jwt-secret-fixed-for-demo-tests'
const FIXED_CONFIG = {
  PORT: 3001,
  NODE_ENV: 'development',
  JWT_SECRET: FIXED_JWT_SECRET,
  JWT_ACCESS_EXPIRES: '30m',
  JWT_REFRESH_EXPIRES: '7d',
  BCRYPT_ROUNDS: 4,
}

const GUEST_USER_ID = 88
// 假 auth 中间件：按 currentAuth 设置盖章（测试里随时改写以模拟 guest/正式用户）
let currentAuth = { userId: GUEST_USER_ID, isGuest: false }
const fakeAuthMiddleware = (req, res, next) => {
  req.userId = currentAuth.userId
  req.isGuest = currentAuth.isGuest
  next()
}

// --- 共享 mock ---
const mockExecute = vi.fn()
const mockConnection = {
  beginTransaction: vi.fn().mockResolvedValue(),
  commit: vi.fn().mockResolvedValue(),
  rollback: vi.fn().mockResolvedValue(),
  release: vi.fn(),
  execute: vi.fn(),
}
const mockGetConnection = vi.fn().mockResolvedValue(mockConnection)
const fakePool = { execute: mockExecute, getConnection: mockGetConnection }
const fakeLogAttempt = vi.fn().mockResolvedValue()

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
injectCache('../config', FIXED_CONFIG)
injectCache('../middleware/auth', fakeAuthMiddleware)
injectCache('../middleware/rateLimit', { logAttempt: fakeLogAttempt })

const demoRouter = require('./demo')

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/demo', demoRouter)
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ error: err.message || '服务器错误' })
  })
  return app
}

// mock execute 按 SQL 关键字分发（见 auth.test.js 同名辅助）。
// 兜底分支：COUNT 查询返回 cnt=0（demo 路由直接读 rows[0].cnt，不能给空数组），
// 其余返回空结果集。
function setExecuteHandlers(handlers) {
  mockExecute.mockImplementation(async (sql, params) => {
    for (const h of handlers) {
      if (h.match.every((sub) => String(sql).includes(sub))) {
        const rows = typeof h.returns === 'function' ? h.returns(params) : h.returns
        return [rows, []]
      }
    }
    if (String(sql).includes('COUNT(*)')) return [[{ cnt: 0 }], []]
    return [[], []]
  })
}

function getCookie(setCookieHeaders, name) {
  if (!setCookieHeaders) return null
  const arr = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders]
  for (const c of arr) {
    const m = c.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'))
    if (m) return m[1]
  }
  return null
}

beforeEach(() => {
  vi.clearAllMocks()
  currentAuth = { userId: GUEST_USER_ID, isGuest: false }
  fakeLogAttempt.mockResolvedValue()
  mockGetConnection.mockResolvedValue(mockConnection)
  mockConnection.beginTransaction.mockResolvedValue()
  mockConnection.commit.mockResolvedValue()
  mockConnection.rollback.mockResolvedValue()
  mockConnection.release.mockResolvedValue()
  // 默认：限流计数为 0、体验码不存在
  setExecuteHandlers([
    { match: ['INTERVAL 1 MINUTE'], returns: [{ cnt: 0 }] },
    { match: ['INTERVAL 24 HOUR'], returns: [{ cnt: 0 }] },
  ])
})

// =====================================================================
// POST /api/demo/redeem — 兑换体验码
// =====================================================================
describe('POST /api/demo/redeem', () => {
  it('缺少体验码 → 400', async () => {
    const res = await supertest(makeApp()).post('/api/demo/redeem').send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/请输入体验码/)
  })

  it('同 IP 1 分钟爆破计数超限 → 429', async () => {
    setExecuteHandlers([{ match: ['INTERVAL 1 MINUTE'], returns: [{ cnt: 5 }] }])
    const res = await supertest(makeApp()).post('/api/demo/redeem').send({ code: 'TRY1' })
    expect(res.status).toBe(429)
    expect(res.body.error).toMatch(/请求过于频繁/)
  })

  it('同 IP 24h 成功领取达上限 → 429 且按失败记次', async () => {
    setExecuteHandlers([
      { match: ['INTERVAL 1 MINUTE'], returns: [{ cnt: 0 }] },
      { match: ['INTERVAL 24 HOUR'], returns: [{ cnt: 5 }] },
    ])
    const res = await supertest(makeApp()).post('/api/demo/redeem').send({ code: 'TRY1' })
    expect(res.status).toBe(429)
    expect(res.body.error).toMatch(/该网络今日领取次数已达上限/)
    expect(fakeLogAttempt).toHaveBeenCalledWith(
      expect.stringMatching(/^demo_redeem:/),
      expect.any(String),
      false
    )
  })

  it('体验码不存在 → 400「体验码无效」并记失败', async () => {
    const res = await supertest(makeApp()).post('/api/demo/redeem').send({ code: 'NOPE' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/体验码无效/)
    expect(fakeLogAttempt).toHaveBeenCalledWith(expect.any(String), expect.any(String), false)
  })

  it('体验码已停用 → 400「体验码已失效」', async () => {
    setExecuteHandlers([
      {
        match: ['FROM experience_codes WHERE code'],
        returns: [
          {
            id: 11,
            code: 'TRY1',
            max_uses: 10,
            current_uses: 0,
            trial_hours: 24,
            is_active: 0,
            expires_at: null,
          },
        ],
      },
    ])
    const res = await supertest(makeApp()).post('/api/demo/redeem').send({ code: 'TRY1' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/体验码已失效/)
  })

  it('体验码已过 expires_at → 400「体验码已过期」', async () => {
    setExecuteHandlers([
      {
        match: ['FROM experience_codes WHERE code'],
        returns: [
          {
            id: 11,
            code: 'TRY1',
            max_uses: 10,
            current_uses: 0,
            trial_hours: 24,
            is_active: 1,
            expires_at: '2020-01-01 00:00:00',
          },
        ],
      },
    ])
    const res = await supertest(makeApp()).post('/api/demo/redeem').send({ code: 'TRY1' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/体验码已过期/)
  })

  it('current_uses 已达 max_uses → 400「体验码已达使用上限」', async () => {
    setExecuteHandlers([
      {
        match: ['FROM experience_codes WHERE code'],
        returns: [
          {
            id: 11,
            code: 'TRY1',
            max_uses: 10,
            current_uses: 10,
            trial_hours: 24,
            is_active: 1,
            expires_at: null,
          },
        ],
      },
    ])
    const res = await supertest(makeApp()).post('/api/demo/redeem').send({ code: 'TRY1' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/体验码已达使用上限/)
  })

  it('设备已体验过（device_id 命中）→ 400「该设备已体验过」', async () => {
    setExecuteHandlers([
      {
        match: ['FROM experience_codes WHERE code'],
        returns: [
          {
            id: 11,
            code: 'TRY1',
            max_uses: 10,
            current_uses: 0,
            trial_hours: 24,
            is_active: 1,
            expires_at: null,
          },
        ],
      },
      { match: ['FROM trial_activations WHERE device_id'], returns: [{ 1: 1 }] },
    ])
    const res = await supertest(makeApp()).post('/api/demo/redeem').send({ code: 'TRY1' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/该设备已体验过/)
  })

  it('兑换成功 → 200，返回 isTrial 用户、下发 access/refresh/设备 cookie，access 内嵌 trialExp', async () => {
    setExecuteHandlers([
      {
        match: ['FROM experience_codes WHERE code'],
        returns: [
          {
            id: 11,
            code: 'TRY1',
            max_uses: 10,
            current_uses: 0,
            trial_hours: 24,
            is_active: 1,
            expires_at: null,
          },
        ],
      },
      { match: ['FROM trial_activations WHERE device_id'], returns: [] },
      { match: ['SELECT id FROM users WHERE username'], returns: [] }, // 随机用户名无碰撞
      { match: ['INSERT INTO refresh_tokens'], returns: { insertId: 1, affectedRows: 1 } },
    ])
    mockConnection.execute.mockImplementation(async (sql) => {
      if (sql.includes('INSERT INTO users')) return [{ insertId: 777, affectedRows: 1 }, []]
      if (sql.includes('INSERT INTO trial_activations')) return [{ affectedRows: 1 }, []]
      if (sql.includes('UPDATE experience_codes')) return [{ affectedRows: 1 }, []]
      return [{ affectedRows: 1 }, []]
    })

    const res = await supertest(makeApp()).post('/api/demo/redeem').send({ code: 'TRY1' })
    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({ id: 777, nickname: '体验用户', isTrial: true })
    expect(res.body.user.username).toMatch(/^guest_[0-9a-f]{8}$/)
    // 到期时间约为 24h 后
    const delta = new Date(res.body.user.trialExpiresAt).getTime() - Date.now()
    expect(delta).toBeGreaterThan(23 * 3600 * 1000)
    expect(delta).toBeLessThan(25 * 3600 * 1000)

    // cookie 三件套
    expect(getCookie(res.headers['set-cookie'], 'lf_access_token')).toBeTruthy()
    expect(getCookie(res.headers['set-cookie'], 'lf_refresh_token')).toBeTruthy()
    expect(getCookie(res.headers['set-cookie'], 'lf_device_id')).toBeTruthy()

    // access token 内嵌 isGuest + trialExp（中间件免查库的依据）
    const token = getCookie(res.headers['set-cookie'], 'lf_access_token')
    const decoded = jwt.verify(token, FIXED_JWT_SECRET)
    expect(decoded.isGuest).toBe(true)
    expect(decoded.trialExp).toBeTruthy()

    // 成功记次 + 事务提交
    expect(fakeLogAttempt).toHaveBeenCalledWith(expect.any(String), expect.any(String), true)
    expect(mockConnection.commit).toHaveBeenCalled()
    // 原子消费 SQL 带 max_uses 守卫
    const updateCall = mockConnection.execute.mock.calls.find(([sql]) =>
      String(sql).includes('UPDATE experience_codes')
    )
    expect(String(updateCall[0])).toMatch(/current_uses < max_uses/)
  })

  it('并发耗尽（原子 UPDATE affectedRows=0）→ 回滚事务并 400', async () => {
    setExecuteHandlers([
      {
        match: ['FROM experience_codes WHERE code'],
        returns: [
          {
            id: 11,
            code: 'TRY1',
            max_uses: 10,
            current_uses: 0,
            trial_hours: 24,
            is_active: 1,
            expires_at: null,
          },
        ],
      },
      { match: ['FROM trial_activations WHERE device_id'], returns: [] },
      { match: ['SELECT id FROM users WHERE username'], returns: [] },
    ])
    mockConnection.execute.mockImplementation(async (sql) => {
      if (sql.includes('INSERT INTO users')) return [{ insertId: 778, affectedRows: 1 }, []]
      if (sql.includes('UPDATE experience_codes')) return [{ affectedRows: 0 }, []] // 被并发耗尽
      return [{ affectedRows: 1 }, []]
    })

    const res = await supertest(makeApp()).post('/api/demo/redeem').send({ code: 'TRY1' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/体验码已达使用上限/)
    expect(mockConnection.rollback).toHaveBeenCalled()
    expect(mockConnection.commit).not.toHaveBeenCalled()
  })

  // --- 设备身份回归：body.deviceId 不再被信任（安全修复） ---
  // mock 一套完整成功链路：限流计数 0、码有效、无重复设备、用户名无碰撞、事务全部成功
  function mockRedeemSuccess() {
    setExecuteHandlers([
      { match: ['INTERVAL 1 MINUTE'], returns: [{ cnt: 0 }] },
      { match: ['INTERVAL 24 HOUR'], returns: [{ cnt: 0 }] },
      {
        match: ['FROM experience_codes WHERE code'],
        returns: [
          {
            id: 11,
            code: 'TRY1',
            max_uses: 10,
            current_uses: 0,
            trial_hours: 24,
            is_active: 1,
            expires_at: null,
          },
        ],
      },
      { match: ['FROM trial_activations WHERE device_id'], returns: [] },
      { match: ['SELECT id FROM users WHERE username'], returns: [] },
      { match: ['INSERT INTO refresh_tokens'], returns: { insertId: 1, affectedRows: 1 } },
    ])
    mockConnection.execute.mockImplementation(async (sql) => {
      if (sql.includes('INSERT INTO users')) return [{ insertId: 777, affectedRows: 1 }, []]
      return [{ affectedRows: 1 }, []]
    })
  }

  it('body.deviceId 不再被信任：无 cookie 时伪造值不落库，改用服务端现场生成的 UUID', async () => {
    mockRedeemSuccess()
    const forged = 'attacker-forged-device-id'
    const res = await supertest(makeApp())
      .post('/api/demo/redeem')
      .send({ code: 'TRY1', deviceId: forged })
    expect(res.status).toBe(200)

    const cookieId = getCookie(res.headers['set-cookie'], 'lf_device_id')
    expect(cookieId).toBeTruthy()
    expect(cookieId).not.toBe(forged)
    expect(cookieId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)

    // 入库的 device_id（trial_activations 第 3 个参数）是服务端生成的，不是 body 伪造值
    const insertCall = mockConnection.execute.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO trial_activations')
    )
    expect(insertCall[1][2]).toBe(cookieId)
    expect(insertCall[1][2]).not.toBe(forged)
  })

  it('换 body 值无法重领：同一 cookie 第二次兑换按 cookie 身份命中去重 → 400', async () => {
    mockRedeemSuccess()
    const first = await supertest(makeApp())
      .post('/api/demo/redeem')
      .send({ code: 'TRY1', deviceId: 'body-A' })
    expect(first.status).toBe(200)
    const cookieId = getCookie(first.headers['set-cookie'], 'lf_device_id')
    expect(cookieId).toBeTruthy()

    // 第二次：伪造另一个 body deviceId，cookie 未变 → 去重查询必须用 cookie 身份而非 'body-B'
    let dupQueryDeviceId = null
    setExecuteHandlers([
      { match: ['INTERVAL 1 MINUTE'], returns: [{ cnt: 0 }] },
      { match: ['INTERVAL 24 HOUR'], returns: [{ cnt: 0 }] },
      {
        match: ['FROM experience_codes WHERE code'],
        returns: [
          {
            id: 11,
            code: 'TRY1',
            max_uses: 10,
            current_uses: 0,
            trial_hours: 24,
            is_active: 1,
            expires_at: null,
          },
        ],
      },
      {
        match: ['FROM trial_activations WHERE device_id'],
        returns: (params) => {
          dupQueryDeviceId = params[0]
          return [{ 1: 1 }]
        },
      },
    ])
    const second = await supertest(makeApp())
      .post('/api/demo/redeem')
      .set('Cookie', 'lf_device_id=' + cookieId)
      .send({ code: 'TRY1', deviceId: 'body-B' })
    expect(second.status).toBe(400)
    expect(second.body.error).toMatch(/该设备已体验过/)
    expect(dupQueryDeviceId).toBe(cookieId)
    expect(dupQueryDeviceId).not.toBe('body-B')
  })

  it('cookie deviceId 超长（>64，DB 列 VARCHAR(64) 上限）→ 重新生成合法 id，不触发 500', async () => {
    mockRedeemSuccess()
    const oversized = 'x'.repeat(100)
    const res = await supertest(makeApp())
      .post('/api/demo/redeem')
      .set('Cookie', 'lf_device_id=' + oversized)
      .send({ code: 'TRY1' })
    expect(res.status).toBe(200)

    const insertCall = mockConnection.execute.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO trial_activations')
    )
    const usedId = insertCall[1][2]
    expect(usedId.length).toBeLessThanOrEqual(64)
    expect(usedId).not.toBe(oversized)
    // 重签了新的合法 cookie
    expect(getCookie(res.headers['set-cookie'], 'lf_device_id')).toBe(usedId)
  })
})

// =====================================================================
// GET /api/demo/status — 查询试用状态
// =====================================================================
describe('GET /api/demo/status', () => {
  it('用户不存在 → 404', async () => {
    setExecuteHandlers([{ match: ['LEFT JOIN trial_activations'], returns: [] }])
    const res = await supertest(makeApp()).get('/api/demo/status')
    expect(res.status).toBe(404)
  })

  it('正式用户 → isTrial:false', async () => {
    setExecuteHandlers([
      { match: ['LEFT JOIN trial_activations'], returns: [{ is_guest: 0, expires_at: null }] },
    ])
    const res = await supertest(makeApp()).get('/api/demo/status')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ isTrial: false })
  })

  it('体验用户有到期记录 → isTrial:true + ISO 时间', async () => {
    setExecuteHandlers([
      {
        match: ['LEFT JOIN trial_activations'],
        returns: [{ is_guest: 1, expires_at: '2030-06-01 12:00:00' }],
      },
    ])
    const res = await supertest(makeApp()).get('/api/demo/status')
    expect(res.status).toBe(200)
    expect(res.body.isTrial).toBe(true)
    expect(res.body.trialExpiresAt).toMatch(/^2030-06-01T/)
  })

  it('体验用户无激活记录（LEFT JOIN NULL）→ isTrial:true 且 trialExpiresAt:null', async () => {
    setExecuteHandlers([
      { match: ['LEFT JOIN trial_activations'], returns: [{ is_guest: 1, expires_at: null }] },
    ])
    const res = await supertest(makeApp()).get('/api/demo/status')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ isTrial: true, trialExpiresAt: null })
  })
})

// =====================================================================
// POST /api/demo/upgrade — 升级为正式账号
// =====================================================================
describe('POST /api/demo/upgrade', () => {
  it('非访客用户 → 400「当前账号无需升级」', async () => {
    setExecuteHandlers([
      { match: ['SELECT id, is_guest FROM users'], returns: [{ id: GUEST_USER_ID, is_guest: 0 }] },
    ])
    const res = await supertest(makeApp())
      .post('/api/demo/upgrade')
      .send({ username: 'newuser1', password: 'password1' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/无需升级/)
  })

  it('用户名不合法 → 400', async () => {
    setExecuteHandlers([
      { match: ['SELECT id, is_guest FROM users'], returns: [{ id: GUEST_USER_ID, is_guest: 1 }] },
    ])
    const res = await supertest(makeApp())
      .post('/api/demo/upgrade')
      .send({ username: 'ab', password: 'password1' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/用户名/)
  })

  it('密码不合法 → 400', async () => {
    setExecuteHandlers([
      { match: ['SELECT id, is_guest FROM users'], returns: [{ id: GUEST_USER_ID, is_guest: 1 }] },
    ])
    const res = await supertest(makeApp())
      .post('/api/demo/upgrade')
      .send({ username: 'newuser1', password: 'onlyletters' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/密码/)
  })

  it('用户名已被占用 → 400', async () => {
    setExecuteHandlers([
      { match: ['SELECT id, is_guest FROM users'], returns: [{ id: GUEST_USER_ID, is_guest: 1 }] },
      { match: ['SELECT id FROM users WHERE username'], returns: [{ id: 999 }] },
    ])
    const res = await supertest(makeApp())
      .post('/api/demo/upgrade')
      .send({ username: 'taken1', password: 'password1' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/用户名已被占用/)
  })

  it('升级成功 → 200，转正 UPDATE/试用标记/清旧 token 均执行，重新下发 cookie', async () => {
    setExecuteHandlers([
      { match: ['SELECT id, is_guest FROM users'], returns: [{ id: GUEST_USER_ID, is_guest: 1 }] },
      { match: ['SELECT id FROM users WHERE username'], returns: [] },
      { match: ['UPDATE users SET username'], returns: { affectedRows: 1 } },
      { match: ['UPDATE trial_activations SET converted'], returns: { affectedRows: 1 } },
      { match: ['DELETE FROM refresh_tokens WHERE user_id'], returns: { affectedRows: 1 } },
      { match: ['INSERT INTO refresh_tokens'], returns: { insertId: 2, affectedRows: 1 } },
    ])

    const res = await supertest(makeApp())
      .post('/api/demo/upgrade')
      .send({ username: 'newuser1', password: 'password1', nickname: '小明' })

    expect(res.status).toBe(200)
    expect(res.body.user).toEqual({
      id: GUEST_USER_ID,
      username: 'newuser1',
      nickname: '小明',
      isTrial: false,
    })
    expect(getCookie(res.headers['set-cookie'], 'lf_access_token')).toBeTruthy()

    const sqls = mockExecute.mock.calls.map(([sql]) => String(sql))
    expect(sqls.some((s) => s.includes('UPDATE users SET username'))).toBe(true)
    expect(sqls.some((s) => s.includes('UPDATE trial_activations SET converted'))).toBe(true)
    expect(sqls.some((s) => s.includes('DELETE FROM refresh_tokens WHERE user_id'))).toBe(true)

    // 新 access token 不再带 isGuest
    const token = getCookie(res.headers['set-cookie'], 'lf_access_token')
    const decoded = jwt.verify(token, FIXED_JWT_SECRET)
    expect(decoded.isGuest).toBeUndefined()
  })

  it('未提供 nickname 时用 username 兜底', async () => {
    setExecuteHandlers([
      { match: ['SELECT id, is_guest FROM users'], returns: [{ id: GUEST_USER_ID, is_guest: 1 }] },
      { match: ['SELECT id FROM users WHERE username'], returns: [] },
      { match: ['UPDATE users SET username'], returns: { affectedRows: 1 } },
      { match: ['UPDATE trial_activations SET converted'], returns: { affectedRows: 1 } },
      { match: ['DELETE FROM refresh_tokens WHERE user_id'], returns: { affectedRows: 1 } },
      { match: ['INSERT INTO refresh_tokens'], returns: { insertId: 2, affectedRows: 1 } },
    ])
    const res = await supertest(makeApp())
      .post('/api/demo/upgrade')
      .send({ username: 'newuser1', password: 'password1' })
    expect(res.status).toBe(200)
    expect(res.body.user.nickname).toBe('newuser1')
  })
})
