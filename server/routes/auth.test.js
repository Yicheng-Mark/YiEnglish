// 鉴权流程测试：用 supertest 驱动挂在临时 express app 上的 auth router。
// 全程 mock db / config / rateLimit，不连真实数据库。
//
// 为什么用 require.cache 注入而非 vi.mock：
// server/ 下文件是 CommonJS（server/package.json 声明 type:commonjs），auth.js 内部
// `require('../db')` 走 Node 原生 require，会绕过 vitest 的 vi.mock 拦截（vi.mock 只
// 命中 ESM import 路径）。经验证，在 ESM 测试文件里 vi.mock 无法替换 auth.js 内部的
// CJS require。因此在 require('./auth') 之前，把 fake module 写进 require.cache，
// 使 auth.js 的 require 拿到我们的 mock pool/config/rateLimit。

import { describe, it, expect, beforeEach, vi } from 'vitest'
const express = require('express')
const cookieParser = require('cookie-parser')
const supertest = require('supertest')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

// --- 固定配置 ---
const FIXED_JWT_SECRET = 'test-jwt-secret-fixed-for-auth-tests'
const FIXED_CONFIG = {
  PORT: 3001,
  FRONTEND_URL: 'http://localhost:5173',
  ALLOWED_ORIGINS: '',
  NODE_ENV: 'development',
  JWT_SECRET: FIXED_JWT_SECRET,
  JWT_ACCESS_EXPIRES: '30m',
  JWT_REFRESH_EXPIRES: '7d',
  BCRYPT_ROUNDS: 4, // 测试用低轮数加速 bcrypt
  LOGIN_RATE_LIMIT_WINDOW: 15 * 60 * 1000,
  LOGIN_RATE_LIMIT_MAX: 5,
  REGISTER_RATE_LIMIT_WINDOW: 60 * 60 * 1000,
  REGISTER_RATE_LIMIT_MAX: 3,
  MAX_DEVICES_PER_USER: 2,
}

// --- 共享 mock 实例（用 vi.fn 以便断言/重置实现）---
const mockExecute = vi.fn()
const mockConnection = {
  beginTransaction: vi.fn().mockResolvedValue(),
  commit: vi.fn().mockResolvedValue(),
  rollback: vi.fn().mockResolvedValue(),
  release: vi.fn(),
  execute: vi.fn(),
}
const mockGetConnection = vi.fn().mockResolvedValue(mockConnection)
const fakePool = {
  execute: mockExecute,
  getConnection: mockGetConnection,
}
const fakeRateLimit = {
  checkLoginRateLimit: vi.fn().mockResolvedValue(),
  checkRegisterRateLimit: vi.fn().mockResolvedValue(),
  logAttempt: vi.fn().mockResolvedValue(),
}

// 把 fake 模块写进 require.cache，使 auth.js 的 require 拿到它们。
// 必须在任何 require('./auth') 之前执行（顶层同步执行即可）。
function injectMocksIntoRequireCache() {
  const dbPath = require.resolve('../db')
  const configPath = require.resolve('../config')
  const rateLimitPath = require.resolve('../middleware/rateLimit')
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: fakePool,
    paths: [],
    children: [],
  }
  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: FIXED_CONFIG,
    paths: [],
    children: [],
  }
  require.cache[rateLimitPath] = {
    id: rateLimitPath,
    filename: rateLimitPath,
    loaded: true,
    exports: fakeRateLimit,
    paths: [],
    children: [],
  }
}
injectMocksIntoRequireCache()

// 此时 require('./auth')：auth.js 内 require('../db') 等命中缓存，拿到 fake。
const authRouter = require('./auth')
// hashToken 与 auth.js 共用同一 tokens 模块实例（依赖的 db/config 已被注入 fake）
const { hashToken } = require('../utils/tokens')

// 构造临时 app：模拟主应用挂载方式（/api/auth 前缀）
function makeApp() {
  const app = express()
  app.use(express.json())
  app.use(cookieParser()) // auth.js 依赖 req.cookies，必须挂 cookie-parser
  app.use('/api/auth', authRouter)
  // 兜底错误处理（auth.js 里 next(err) 会落到这里）
  app.use((err, req, res, _next) => {
    res.status(err.status || 500).json({ error: err.message || '服务器错误' })
  })
  return app
}

// mock execute 辅助：按 SQL 关键字分发不同返回。
// handlers: [{ match: [sqlSubstrings], returns: rows | (params) => rows }]
function setExecuteHandlers(handlers) {
  mockExecute.mockImplementation(async (sql, params) => {
    for (const h of handlers) {
      if (h.match.every((sub) => String(sql).includes(sub))) {
        const rows = typeof h.returns === 'function' ? h.returns(params) : h.returns
        return [rows, []]
      }
    }
    return [[], []] // 默认空结果集
  })
}

// 事务连接（pool.getConnection 返回的 mockConnection）的 execute 分发：
// 登录的设备名额检查与会话写入走事务连接。默认空结果集——遗漏 handler 的用例
// 会在解构处尽早抛错，而不是静默通过。
function setConnectionHandlers(handlers) {
  mockConnection.execute.mockImplementation(async (sql, params) => {
    for (const h of handlers) {
      if (h.match.every((sub) => String(sql).includes(sub))) {
        const rows = typeof h.returns === 'function' ? h.returns(params) : h.returns
        return [rows, []]
      }
    }
    return [[], []]
  })
}

// 提取 Set-Cookie 中指定 cookie 的值
function getCookie(setCookieHeaders, name) {
  if (!setCookieHeaders) return null
  const arr = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders]
  for (const c of arr) {
    const m = c.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'))
    if (m) return m[1]
  }
  return null
}

// 常量
const VALID_USER = 'alice123'
const VALID_PASSWORD = 'password1'
const VALID_HASH = bcrypt.hashSync(VALID_PASSWORD, FIXED_CONFIG.BCRYPT_ROUNDS)

beforeEach(() => {
  vi.clearAllMocks()
  // rateLimit 默认放行（clearAllMocks 不重置实现，但显式 reset 更稳妥）
  fakeRateLimit.checkLoginRateLimit.mockResolvedValue()
  fakeRateLimit.checkRegisterRateLimit.mockResolvedValue()
  fakeRateLimit.logAttempt.mockResolvedValue()
  mockGetConnection.mockResolvedValue(mockConnection)
  mockConnection.beginTransaction.mockResolvedValue()
  mockConnection.commit.mockResolvedValue()
  mockConnection.rollback.mockResolvedValue()
  mockConnection.release.mockResolvedValue()
  // 清掉上一条用例注入的事务实现，防止泄漏到后续用例
  mockConnection.execute.mockReset()
  setConnectionHandlers([])
  // 默认 execute 返回空
  setExecuteHandlers([])
})

// =====================================================================
// 注册：POST /api/auth/register
// =====================================================================
describe('POST /api/auth/register', () => {
  it('缺少激活码 → 400', async () => {
    const app = makeApp()
    const res = await supertest(app)
      .post('/api/auth/register')
      .send({ username: VALID_USER, password: VALID_PASSWORD })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/激活码/)
  })

  it('用户名不合法（太短）→ 400', async () => {
    const app = makeApp()
    const res = await supertest(app)
      .post('/api/auth/register')
      .send({ username: 'ab', password: VALID_PASSWORD, activationCode: 'CODE1' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/用户名/)
  })

  it('密码不合法（无数字）→ 400', async () => {
    const app = makeApp()
    const res = await supertest(app)
      .post('/api/auth/register')
      .send({ username: VALID_USER, password: 'onlyletters', activationCode: 'CODE1' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/密码/)
  })

  it('激活码不存在 → 400', async () => {
    setExecuteHandlers([{ match: ['experience_codes WHERE code'], returns: [] }])
    const app = makeApp()
    const res = await supertest(app)
      .post('/api/auth/register')
      .send({ username: VALID_USER, password: VALID_PASSWORD, activationCode: 'NOPE' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/激活码无效/)
  })

  it('用户名已存在 → 400（响应文案与「注册失败」一致，防枚举）', async () => {
    // 源码：预检同名用户 → 返回 400「注册失败，请稍后重试」；并发 ER_DUP_ENTRY 同文案
    setExecuteHandlers([
      {
        match: ['experience_codes WHERE code'],
        returns: [
          { id: 1, code: 'CODE1', max_uses: 10, current_uses: 0, is_active: 1, expires_at: null },
        ],
      },
      { match: ['FROM users WHERE username'], returns: [{ id: 99 }] }, // 同名已存在
    ])
    const app = makeApp()
    const res = await supertest(app)
      .post('/api/auth/register')
      .send({ username: VALID_USER, password: VALID_PASSWORD, activationCode: 'CODE1' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/注册失败/)
  })

  it('注册成功 → 200 且下发 access/refresh cookie', async () => {
    const insertedUserId = 42
    setExecuteHandlers([
      {
        match: ['experience_codes WHERE code'],
        returns: [
          { id: 1, code: 'CODE1', max_uses: 10, current_uses: 0, is_active: 1, expires_at: null },
        ],
      },
      { match: ['FROM users WHERE username'], returns: [] }, // 用户名可用
      // issueTokens 内会 INSERT refresh_tokens（pool.execute，非 conn）
      { match: ['INSERT INTO refresh_tokens'], returns: { insertId: 1, affectedRows: 1 } },
    ])
    // 事务连接的 execute：INSERT users 返回 insertId，UPDATE 原子消费返回 affectedRows=1
    mockConnection.execute.mockImplementation(async (sql) => {
      if (sql.includes('INSERT INTO users')) {
        return [{ insertId: insertedUserId, affectedRows: 1 }, []]
      }
      return [{ affectedRows: 1 }, []]
    })

    const app = makeApp()
    const res = await supertest(app)
      .post('/api/auth/register')
      .send({ username: VALID_USER, password: VALID_PASSWORD, activationCode: 'CODE1' })

    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({ username: VALID_USER })
    expect(res.body.user.id).toBe(insertedUserId)
    const access = getCookie(res.headers['set-cookie'], 'lf_access_token')
    const refresh = getCookie(res.headers['set-cookie'], 'lf_refresh_token')
    expect(access).toBeTruthy()
    expect(refresh).toBeTruthy()
  })

  it('注册成功（trial_hours=720 月卡）→ 事务内写入订阅到期，access token 内嵌 subExp', async () => {
    const insertedUserId = 43
    setExecuteHandlers([
      {
        match: ['experience_codes WHERE code'],
        returns: [
          {
            id: 2,
            code: 'MONTH1',
            max_uses: 1,
            current_uses: 0,
            is_active: 1,
            expires_at: null,
            trial_hours: 720,
          },
        ],
      },
      { match: ['FROM users WHERE username'], returns: [] },
      { match: ['INSERT INTO refresh_tokens'], returns: { insertId: 1, affectedRows: 1 } },
    ])
    mockConnection.execute.mockImplementation(async (sql) => {
      if (sql.includes('INSERT INTO users')) {
        return [{ insertId: insertedUserId, affectedRows: 1 }, []]
      }
      return [{ affectedRows: 1 }, []]
    })

    const app = makeApp()
    const res = await supertest(app)
      .post('/api/auth/register')
      .send({ username: VALID_USER, password: VALID_PASSWORD, activationCode: 'MONTH1' })

    expect(res.status).toBe(200)
    // 订阅到期与激活码来源同条 UPDATE 写入，值为 now+720h（月卡）
    const updCall = mockConnection.execute.mock.calls.find(([sql]) =>
      String(sql).includes('UPDATE users SET activation_code_id')
    )
    expect(updCall).toBeTruthy()
    expect(String(updCall[0])).toContain('subscription_expires_at')
    expect(updCall[1][0]).toBe(2)
    expect(updCall[1][1]).toBeInstanceOf(Date)
    const deltaHours = (updCall[1][1].getTime() - Date.now()) / 3600000
    expect(deltaHours).toBeGreaterThan(719)
    expect(deltaHours).toBeLessThan(721)
    // access token 内嵌 subExp：middleware 每请求据此比对，到期即 401
    const access = getCookie(res.headers['set-cookie'], 'lf_access_token')
    const decoded = jwt.verify(access, FIXED_JWT_SECRET)
    expect(decoded.subExp).toBeTruthy()
    expect(new Date(decoded.subExp).getTime()).toBeGreaterThan(Date.now() + 719 * 60 * 60 * 1000)
    // 响应体带到期字段（与 login/refresh/me 契约一致），且与 token 内嵌值同源
    expect(res.body.user.subscriptionExpiresAt).toBe(decoded.subExp)
    // 整秒截断：与 TIMESTAMP(fsp=0) 存储值对齐，两道闸在边界上不漂移
    expect(new Date(decoded.subExp).getMilliseconds()).toBe(0)
  })

  it('注册成功（trial_hours=0 存量永久码）→ subscription_expires_at 写 NULL，token 不带 subExp（永久兼容）', async () => {
    setExecuteHandlers([
      {
        match: ['experience_codes WHERE code'],
        returns: [
          {
            id: 3,
            code: 'FOREVER',
            max_uses: 10,
            current_uses: 0,
            is_active: 1,
            expires_at: null,
            trial_hours: 0,
          },
        ],
      },
      { match: ['FROM users WHERE username'], returns: [] },
      { match: ['INSERT INTO refresh_tokens'], returns: { insertId: 1, affectedRows: 1 } },
    ])
    mockConnection.execute.mockImplementation(async (sql) => {
      if (sql.includes('INSERT INTO users')) {
        return [{ insertId: 44, affectedRows: 1 }, []]
      }
      return [{ affectedRows: 1 }, []]
    })

    const app = makeApp()
    const res = await supertest(app)
      .post('/api/auth/register')
      .send({ username: VALID_USER, password: VALID_PASSWORD, activationCode: 'FOREVER' })

    expect(res.status).toBe(200)
    const updCall = mockConnection.execute.mock.calls.find(([sql]) =>
      String(sql).includes('UPDATE users SET activation_code_id')
    )
    expect(updCall).toBeTruthy()
    expect(updCall[1][1]).toBeNull()
    const access = getCookie(res.headers['set-cookie'], 'lf_access_token')
    const decoded = jwt.verify(access, FIXED_JWT_SECRET)
    expect(decoded.subExp).toBeUndefined()
  })
})

// =====================================================================
// 登录：POST /api/auth/login
// =====================================================================
describe('POST /api/auth/login', () => {
  it('缺字段 → 400', async () => {
    const app = makeApp()
    const res = await supertest(app).post('/api/auth/login').send({ username: 'x' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/用户名和密码/)
  })

  it('username 为 truthy 对象（如 {}）→ 400，不进入 DB 查询（回归：对象入参触发 500）', async () => {
    const app = makeApp()
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ username: {}, password: VALID_PASSWORD })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/用户名和密码/)
    expect(mockExecute).not.toHaveBeenCalled()
    expect(fakeRateLimit.checkLoginRateLimit).not.toHaveBeenCalled()
  })

  it('password 为非字符串（如数组）→ 400，不触发 bcrypt 比较', async () => {
    const app = makeApp()
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ username: VALID_USER, password: ['password1'] })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/用户名和密码/)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it('用户不存在 → 401「用户名或密码错误」', async () => {
    setExecuteHandlers([{ match: ['FROM users WHERE username'], returns: [] }])
    const app = makeApp()
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ username: 'ghost', password: 'whatever1' })
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/用户名或密码错误/)
  })

  it('密码错误 → 401，响应文案与「用户不存在」一致（防枚举）', async () => {
    setExecuteHandlers([
      {
        match: ['FROM users WHERE username'],
        returns: [{ id: 5, username: VALID_USER, nickname: 'Alice', password_hash: VALID_HASH }],
      },
    ])
    const app = makeApp()
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ username: VALID_USER, password: 'wrongpass1' })
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/用户名或密码错误/)
  })

  it('登录成功 → 200 + 下发 cookie + 返回用户信息（事务内 FOR UPDATE 名额检查 + 原子 upsert）', async () => {
    setExecuteHandlers([
      {
        match: ['FROM users WHERE username'],
        returns: [
          {
            id: 5,
            username: VALID_USER,
            nickname: 'Alice',
            password_hash: VALID_HASH,
            avatar_url: null,
            daily_goal_minutes: 45,
            signature: 'Keep going',
          },
        ],
      },
    ])
    setConnectionHandlers([
      { match: ['SELECT max_devices FROM users'], returns: [{ max_devices: null }] },
      { match: ['SELECT COUNT(*) AS cnt FROM refresh_tokens'], returns: [{ cnt: 0 }] },
      { match: ['DELETE FROM refresh_tokens WHERE user_id'], returns: { affectedRows: 0 } },
      { match: ['INSERT INTO refresh_tokens'], returns: { insertId: 1, affectedRows: 1 } },
    ])
    const app = makeApp()
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ username: VALID_USER, password: VALID_PASSWORD })

    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({
      id: 5,
      username: VALID_USER,
      nickname: 'Alice',
      avatar: null,
      dailyGoalMinutes: 45,
      signature: 'Keep going',
    })
    const access = getCookie(res.headers['set-cookie'], 'lf_access_token')
    const refresh = getCookie(res.headers['set-cookie'], 'lf_refresh_token')
    expect(access).toBeTruthy()
    expect(refresh).toBeTruthy()

    // 名额检查在事务内串行化：锁用户行（FOR UPDATE），统计其他设备时
    // 排除空 device_id、排除本设备、只算未过期
    const lockCall = mockConnection.execute.mock.calls.find(([sql]) =>
      String(sql).includes('SELECT max_devices FROM users')
    )
    expect(lockCall).toBeTruthy()
    expect(String(lockCall[0])).toContain('FOR UPDATE')
    const countCall = mockConnection.execute.mock.calls.find(([sql]) =>
      String(sql).includes('SELECT COUNT(*) AS cnt FROM refresh_tokens')
    )
    expect(String(countCall[0])).toContain("device_id <> ''")
    expect(String(countCall[0])).toContain('device_id <> ?')
    expect(String(countCall[0])).toContain('expires_at > NOW()')
    expect(countCall[1]).toEqual([5, expect.any(String)])
    // 同设备重登覆盖旧行而非新增：写入是 (user_id, device_id) 唯一键上的原子 upsert
    const insertCall = mockConnection.execute.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO refresh_tokens')
    )
    expect(String(insertCall[0])).toContain('ON DUPLICATE KEY UPDATE')
    expect(mockConnection.commit).toHaveBeenCalled()
  })

  it('订阅到期账号登录 → 401 SUBSCRIPTION_EXPIRED，不签发 cookie', async () => {
    setExecuteHandlers([
      {
        match: ['FROM users WHERE username'],
        returns: [
          {
            id: 5,
            username: VALID_USER,
            nickname: 'Alice',
            password_hash: VALID_HASH,
            subscription_expires_at: new Date(Date.now() - 3600 * 1000),
          },
        ],
      },
    ])
    const app = makeApp()
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ username: VALID_USER, password: VALID_PASSWORD })

    expect(res.status).toBe(401)
    expect(res.body.code).toBe('SUBSCRIPTION_EXPIRED')
    expect(res.body.error).toMatch(/账号已到期/)
    expect(getCookie(res.headers['set-cookie'], 'lf_access_token')).toBeNull()
    // 到期登录也按失败计数，防到期账号无限试密码
    expect(fakeRateLimit.logAttempt).toHaveBeenCalledWith(VALID_USER, expect.any(String), false)
  })

  it('订阅未到期账号登录 → 200 且 access 内嵌 subExp、响应附 subscriptionExpiresAt', async () => {
    const subExp = new Date(Date.now() + 720 * 60 * 60 * 1000)
    setExecuteHandlers([
      {
        match: ['FROM users WHERE username'],
        returns: [
          {
            id: 5,
            username: VALID_USER,
            nickname: 'Alice',
            password_hash: VALID_HASH,
            avatar_url: null,
            daily_goal_minutes: 30,
            signature: null,
            subscription_expires_at: subExp,
          },
        ],
      },
    ])
    setConnectionHandlers([
      { match: ['SELECT max_devices FROM users'], returns: [{ max_devices: null }] },
      { match: ['SELECT COUNT(*) AS cnt FROM refresh_tokens'], returns: [{ cnt: 0 }] },
      { match: ['DELETE FROM refresh_tokens WHERE user_id'], returns: { affectedRows: 0 } },
      { match: ['INSERT INTO refresh_tokens'], returns: { insertId: 1, affectedRows: 1 } },
    ])
    const app = makeApp()
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ username: VALID_USER, password: VALID_PASSWORD })

    expect(res.status).toBe(200)
    expect(res.body.user.subscriptionExpiresAt).toBe(subExp.toISOString())
    const access = getCookie(res.headers['set-cookie'], 'lf_access_token')
    const decoded = jwt.verify(access, FIXED_JWT_SECRET)
    expect(decoded.subExp).toBe(subExp.toISOString())
  })

  it('访客行经 /login 登录（防御性路径）→ 按访客身份签发：access 内嵌 isGuest+trialExp、不带 subExp，响应附 isTrial（回归：旧实现一律按正式账号签发）', async () => {
    const trialExp = new Date(Date.now() + 24 * 3600 * 1000)
    setExecuteHandlers([
      {
        match: ['FROM users WHERE username'],
        returns: [
          {
            id: 9,
            username: 'guest_abcd1234',
            nickname: '体验用户',
            password_hash: VALID_HASH,
            avatar_url: null,
            daily_goal_minutes: 30,
            signature: null,
            is_guest: 1,
            subscription_expires_at: null,
          },
        ],
      },
      { match: ['FROM trial_activations WHERE user_id'], returns: [{ expires_at: trialExp }] },
    ])
    setConnectionHandlers([
      { match: ['SELECT max_devices FROM users'], returns: [{ max_devices: null }] },
      { match: ['SELECT COUNT(*) AS cnt FROM refresh_tokens'], returns: [{ cnt: 0 }] },
      { match: ['DELETE FROM refresh_tokens WHERE user_id'], returns: { affectedRows: 0 } },
      { match: ['INSERT INTO refresh_tokens'], returns: { insertId: 1, affectedRows: 1 } },
    ])
    const app = makeApp()
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ username: 'guest_abcd1234', password: VALID_PASSWORD })

    expect(res.status).toBe(200)
    expect(res.body.user.isTrial).toBe(true)
    expect(res.body.user.trialExpiresAt).toBe(trialExp.toISOString())
    const access = getCookie(res.headers['set-cookie'], 'lf_access_token')
    const decoded = jwt.verify(access, FIXED_JWT_SECRET)
    expect(decoded.isGuest).toBe(true)
    expect(decoded.trialExp).toBe(trialExp.toISOString())
    expect(decoded.subExp).toBeUndefined()
  })

  it('访客行经 /login 登录但试用已到期 → 401 TRIAL_EXPIRED，不签发 cookie', async () => {
    setExecuteHandlers([
      {
        match: ['FROM users WHERE username'],
        returns: [
          {
            id: 9,
            username: 'guest_abcd1234',
            nickname: '体验用户',
            password_hash: VALID_HASH,
            is_guest: 1,
            subscription_expires_at: null,
          },
        ],
      },
      {
        match: ['FROM trial_activations WHERE user_id'],
        returns: [{ expires_at: new Date(Date.now() - 3600 * 1000) }],
      },
    ])
    const app = makeApp()
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ username: 'guest_abcd1234', password: VALID_PASSWORD })

    expect(res.status).toBe(401)
    expect(res.body.code).toBe('TRIAL_EXPIRED')
    expect(res.body.error).toMatch(/体验时间已结束/)
    expect(getCookie(res.headers['set-cookie'], 'lf_access_token')).toBeNull()
    expect(fakeRateLimit.logAttempt).toHaveBeenCalledWith(
      'guest_abcd1234',
      expect.any(String),
      false
    )
  })

  it('达设备上限 → 403 DEVICE_LIMIT_REACHED（真实计数文案；不写入新会话不提交事务）', async () => {
    setExecuteHandlers([
      {
        match: ['FROM users WHERE username'],
        returns: [{ id: 5, username: VALID_USER, nickname: 'Alice', password_hash: VALID_HASH }],
      },
    ])
    setConnectionHandlers([
      { match: ['SELECT max_devices FROM users'], returns: [{ max_devices: null }] },
      {
        match: ['SELECT COUNT(*) AS cnt FROM refresh_tokens'],
        returns: [{ cnt: FIXED_CONFIG.MAX_DEVICES_PER_USER }],
      },
    ])
    const app = makeApp()
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ username: VALID_USER, password: VALID_PASSWORD })
    expect(res.status).toBe(403)
    expect(res.body.code).toBe('DEVICE_LIMIT_REACHED')
    // 文案用真实计数（cnt=2）与生效上限（全局 2），不再拿上限值冒充已登录台数
    expect(res.body.error).toMatch(/已在 2 台其他设备登录（上限 2 台）/)
    // 拒绝路径不得写入新会话（upsert 或普通 INSERT 都算），事务必须回滚
    expect(
      mockConnection.execute.mock.calls.some(([sql]) =>
        String(sql).includes('INSERT INTO refresh_tokens')
      )
    ).toBe(false)
    expect(
      mockExecute.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO refresh_tokens'))
    ).toBe(false)
    expect(mockConnection.rollback).toHaveBeenCalled()
    expect(mockConnection.commit).not.toHaveBeenCalled()
  })

  it('全局默认上限边界：cnt=上限-1（1 台其他设备）→ 放行', async () => {
    setExecuteHandlers([
      {
        match: ['FROM users WHERE username'],
        returns: [{ id: 5, username: VALID_USER, nickname: 'Alice', password_hash: VALID_HASH }],
      },
    ])
    setConnectionHandlers([
      { match: ['SELECT max_devices FROM users'], returns: [{ max_devices: null }] },
      { match: ['SELECT COUNT(*) AS cnt FROM refresh_tokens'], returns: [{ cnt: 1 }] },
      { match: ['DELETE FROM refresh_tokens WHERE user_id'], returns: { affectedRows: 0 } },
      { match: ['INSERT INTO refresh_tokens'], returns: { insertId: 1, affectedRows: 1 } },
    ])
    const app = makeApp()
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ username: VALID_USER, password: VALID_PASSWORD })
    expect(res.status).toBe(200)
  })

  it('全局 MAX_DEVICES_PER_USER=0（不限）→ 超额也放行（回归：旧 parseInt||2 会把 0 吞成 2）', async () => {
    FIXED_CONFIG.MAX_DEVICES_PER_USER = 0
    try {
      setExecuteHandlers([
        {
          match: ['FROM users WHERE username'],
          returns: [{ id: 5, username: VALID_USER, nickname: 'Alice', password_hash: VALID_HASH }],
        },
      ])
      setConnectionHandlers([
        { match: ['SELECT max_devices FROM users'], returns: [{ max_devices: null }] },
        // 9 台已远超任何默认值，但全局配置为不限
        { match: ['SELECT COUNT(*) AS cnt FROM refresh_tokens'], returns: [{ cnt: 9 }] },
        { match: ['DELETE FROM refresh_tokens WHERE user_id'], returns: { affectedRows: 0 } },
        { match: ['INSERT INTO refresh_tokens'], returns: { insertId: 1, affectedRows: 1 } },
      ])
      const app = makeApp()
      const res = await supertest(app)
        .post('/api/auth/login')
        .send({ username: VALID_USER, password: VALID_PASSWORD })
      expect(res.status).toBe(200)
    } finally {
      FIXED_CONFIG.MAX_DEVICES_PER_USER = 2
    }
  })

  it('用户级 max_devices=0（不限）→ 已超全局上限也放行', async () => {
    setExecuteHandlers([
      {
        match: ['FROM users WHERE username'],
        returns: [{ id: 5, username: VALID_USER, nickname: 'Alice', password_hash: VALID_HASH }],
      },
    ])
    setConnectionHandlers([
      // 事务内重读的 max_devices=0：用户级不限
      { match: ['SELECT max_devices FROM users'], returns: [{ max_devices: 0 }] },
      // 5 台已远超全局上限 2，但该用户不限台数
      { match: ['SELECT COUNT(*) AS cnt FROM refresh_tokens'], returns: [{ cnt: 5 }] },
      { match: ['DELETE FROM refresh_tokens WHERE user_id'], returns: { affectedRows: 0 } },
      { match: ['INSERT INTO refresh_tokens'], returns: { insertId: 1, affectedRows: 1 } },
    ])
    const app = makeApp()
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ username: VALID_USER, password: VALID_PASSWORD })
    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({ id: 5, username: VALID_USER })
  })

  it('用户级 max_devices=3 覆盖全局 2 → 第 3 台可登录', async () => {
    setExecuteHandlers([
      {
        match: ['FROM users WHERE username'],
        returns: [{ id: 5, username: VALID_USER, nickname: 'Alice', password_hash: VALID_HASH }],
      },
    ])
    setConnectionHandlers([
      { match: ['SELECT max_devices FROM users'], returns: [{ max_devices: 3 }] },
      // 全局上限 2 会拒绝，但该用户上限为 3，cnt=2 应放行
      { match: ['SELECT COUNT(*) AS cnt FROM refresh_tokens'], returns: [{ cnt: 2 }] },
      { match: ['DELETE FROM refresh_tokens WHERE user_id'], returns: { affectedRows: 0 } },
      { match: ['INSERT INTO refresh_tokens'], returns: { insertId: 1, affectedRows: 1 } },
    ])
    const app = makeApp()
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ username: VALID_USER, password: VALID_PASSWORD })
    expect(res.status).toBe(200)
  })

  it('用户级 max_devices=3 → 达到覆盖上限（cnt=3）→ 403（文案用生效上限）', async () => {
    setExecuteHandlers([
      {
        match: ['FROM users WHERE username'],
        returns: [{ id: 5, username: VALID_USER, nickname: 'Alice', password_hash: VALID_HASH }],
      },
    ])
    setConnectionHandlers([
      { match: ['SELECT max_devices FROM users'], returns: [{ max_devices: 3 }] },
      { match: ['SELECT COUNT(*) AS cnt FROM refresh_tokens'], returns: [{ cnt: 3 }] },
    ])
    const app = makeApp()
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ username: VALID_USER, password: VALID_PASSWORD })
    expect(res.status).toBe(403)
    expect(res.body.code).toBe('DEVICE_LIMIT_REACHED')
    // 错误文案使用生效上限（覆盖值 3）而非全局值
    expect(res.body.error).toMatch(/上限 3 台/)
  })

  it('登录频率超限 → 429（rateLimit mock 抛错）', async () => {
    const rateErr = new Error('登录尝试过于频繁，请稍后再试')
    rateErr.status = 429
    fakeRateLimit.checkLoginRateLimit.mockRejectedValueOnce(rateErr)
    setExecuteHandlers([
      {
        match: ['FROM users WHERE username'],
        returns: [{ id: 5, username: VALID_USER, nickname: 'Alice', password_hash: VALID_HASH }],
      },
    ])
    const app = makeApp()
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ username: VALID_USER, password: VALID_PASSWORD })
    expect(res.status).toBe(429)
  })
})

// =====================================================================
// /me：GET /api/auth/me（受 authMiddleware 保护）
// =====================================================================
describe('GET /api/auth/me', () => {
  it('无 token → 401「请先登录」', async () => {
    const app = makeApp()
    const res = await supertest(app).get('/api/auth/me')
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/请先登录/)
  })

  it('无效 token → 401', async () => {
    const app = makeApp()
    const res = await supertest(app)
      .get('/api/auth/me')
      .set('Cookie', 'lf_access_token=this-is-not-a-valid-jwt')
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/请先登录/)
  })

  it('有效 token（正式用户）→ 200 返回用户信息，不带 isTrial', async () => {
    const userId = 7
    const token = jwt.sign({ userId }, FIXED_JWT_SECRET, { expiresIn: '30m' })
    setExecuteHandlers([
      {
        match: ['FROM users'],
        returns: [
          {
            id: userId,
            username: VALID_USER,
            nickname: 'Alice',
            avatar_url: null,
            daily_goal_minutes: 30,
            signature: 'hi',
            is_guest: 0,
          },
        ],
      },
    ])
    const app = makeApp()
    const res = await supertest(app)
      .get('/api/auth/me')
      .set('Cookie', 'lf_access_token=' + token)

    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({
      id: userId,
      username: VALID_USER,
      nickname: 'Alice',
      dailyGoalMinutes: 30,
      signature: 'hi',
    })
    // 正式用户不应带试用字段
    expect(res.body.user.isTrial).toBeUndefined()
  })

  it('正式用户带订阅 → 200 附 subscriptionExpiresAt（月/季/年卡）', async () => {
    const userId = 7
    const token = jwt.sign({ userId }, FIXED_JWT_SECRET, { expiresIn: '30m' })
    const subExp = new Date(Date.now() + 720 * 60 * 60 * 1000)
    setExecuteHandlers([
      {
        match: ['FROM users'],
        returns: [
          {
            id: userId,
            username: VALID_USER,
            nickname: 'Alice',
            avatar_url: null,
            daily_goal_minutes: 30,
            signature: 'hi',
            is_guest: 0,
            subscription_expires_at: subExp,
          },
        ],
      },
    ])
    const app = makeApp()
    const res = await supertest(app)
      .get('/api/auth/me')
      .set('Cookie', 'lf_access_token=' + token)

    expect(res.status).toBe(200)
    expect(res.body.user.subscriptionExpiresAt).toBe(subExp.toISOString())
  })

  it('有效 token 但用户已被删 → 404', async () => {
    const userId = 99
    const token = jwt.sign({ userId }, FIXED_JWT_SECRET, { expiresIn: '30m' })
    setExecuteHandlers([{ match: ['FROM users'], returns: [] }])
    const app = makeApp()
    const res = await supertest(app)
      .get('/api/auth/me')
      .set('Cookie', 'lf_access_token=' + token)
    expect(res.status).toBe(404)
  })
})

// =====================================================================
// /profile：PATCH /api/auth/profile（头像 data URL / 清空 / 输入边界）
// =====================================================================
describe('PATCH /api/auth/profile', () => {
  const userId = 7
  const token = jwt.sign({ userId }, FIXED_JWT_SECRET, { expiresIn: '30m' })

  function profileRow(avatar) {
    return {
      id: userId,
      username: VALID_USER,
      nickname: 'Alice',
      avatar_url: avatar,
      daily_goal_minutes: 30,
      signature: '',
    }
  }

  it('接受个人中心生成的 JPEG data URL，并写入 avatar_url', async () => {
    const avatar = 'data:image/jpeg;base64,/9j/2Q=='
    setExecuteHandlers([
      { match: ['UPDATE users SET avatar_url = ?'], returns: { affectedRows: 1 } },
      { match: ['SELECT id, username, nickname, avatar_url'], returns: [profileRow(avatar)] },
    ])

    const res = await supertest(makeApp())
      .patch('/api/auth/profile')
      .set('Cookie', 'lf_access_token=' + token)
      .send({ avatarUrl: avatar })

    expect(res.status).toBe(200)
    expect(res.body.user.avatar).toBe(avatar)
    const update = mockExecute.mock.calls.find(([sql]) =>
      String(sql).includes('UPDATE users SET avatar_url = ?')
    )
    expect(update[1]).toEqual([avatar, userId])
  })

  it('avatarUrl=null 可清空服务端头像', async () => {
    setExecuteHandlers([
      { match: ['UPDATE users SET avatar_url = ?'], returns: { affectedRows: 1 } },
      { match: ['SELECT id, username, nickname, avatar_url'], returns: [profileRow(null)] },
    ])

    const res = await supertest(makeApp())
      .patch('/api/auth/profile')
      .set('Cookie', 'lf_access_token=' + token)
      .send({ avatarUrl: null })

    expect(res.status).toBe(200)
    expect(res.body.user.avatar).toBeNull()
    const update = mockExecute.mock.calls.find(([sql]) =>
      String(sql).includes('UPDATE users SET avatar_url = ?')
    )
    expect(update[1]).toEqual([null, userId])
  })

  it('拒绝超出 TEXT 安全余量的头像，且不访问数据库', async () => {
    const bytes = Buffer.alloc(50000, 0)
    bytes[0] = 0xff
    bytes[1] = 0xd8
    bytes[bytes.length - 2] = 0xff
    bytes[bytes.length - 1] = 0xd9
    const oversized = `data:image/jpeg;base64,${bytes.toString('base64')}`

    const res = await supertest(makeApp())
      .patch('/api/auth/profile')
      .set('Cookie', 'lf_access_token=' + token)
      .send({ avatarUrl: oversized })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('头像数据过大')
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it.each([
    ['SVG data URL', 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='],
    ['伪 JPEG', 'data:image/jpeg;base64,ZmFrZQ=='],
    ['非 HTTPS URL', 'javascript:alert(1)'],
  ])('拒绝无效头像格式：%s', async (_label, avatarUrl) => {
    const res = await supertest(makeApp())
      .patch('/api/auth/profile')
      .set('Cookie', 'lf_access_token=' + token)
      .send({ avatarUrl })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('头像格式无效')
    expect(mockExecute).not.toHaveBeenCalled()
  })
})

// =====================================================================
// 登出：POST /api/auth/logout
// =====================================================================
describe('POST /api/auth/logout', () => {
  it('无 refresh cookie → 200 且清理 cookie', async () => {
    const app = makeApp()
    const res = await supertest(app).post('/api/auth/logout')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('带 refresh cookie → 200 并尝试删 token 行、清 cookie', async () => {
    setExecuteHandlers([
      { match: ['DELETE FROM refresh_tokens WHERE token_hash'], returns: { affectedRows: 1 } },
    ])
    const app = makeApp()
    const res = await supertest(app)
      .post('/api/auth/logout')
      .set('Cookie', 'lf_refresh_token=someopaquevalue')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    const sc = res.headers['set-cookie'] || []
    const arr = Array.isArray(sc) ? sc : [sc]
    expect(arr.some((c) => /lf_refresh_token=;/.test(c))).toBe(true)
  })
})

// =====================================================================
// refresh：POST /api/auth/refresh
// =====================================================================
describe('POST /api/auth/refresh', () => {
  it('无 refresh cookie → 401', async () => {
    const app = makeApp()
    const res = await supertest(app).post('/api/auth/refresh')
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/请先登录/)
  })

  it('refresh token 不存在/已过期 → 401 且清 cookie', async () => {
    setExecuteHandlers([{ match: ['FROM refresh_tokens WHERE token_hash'], returns: [] }])
    const app = makeApp()
    const res = await supertest(app)
      .post('/api/auth/refresh')
      .set('Cookie', 'lf_refresh_token=stalevalue')
    expect(res.status).toBe(401)
  })

  // 原子轮换后的 SELECT（读会话元数据）用更具体的关键字，避免误匹配 DELETE 语句。
  const STORED_REFRESH_ROW = {
    id: 100,
    user_id: 5,
    device_id: 'dev-1',
    device_name: 'Chrome · Windows',
    ip: '127.0.0.1',
    created_at: new Date('2026-09-01T08:00:00Z'),
  }

  it('有效 refresh token（正式用户）→ 200 轮换并下发新 cookie，DELETE 带过期守卫，设备复检放行', async () => {
    setExecuteHandlers([
      { match: ['SELECT id, user_id, device_id'], returns: [STORED_REFRESH_ROW] },
      { match: ['DELETE FROM refresh_tokens WHERE token_hash'], returns: { affectedRows: 1 } },
      {
        match: ['FROM users WHERE id'],
        returns: [
          { id: 5, username: VALID_USER, nickname: 'Alice', is_guest: 0, max_devices: null },
        ],
      },
      // 全局上限 2，活跃会话 1 台 → 未超限，不触发驱逐
      { match: ['COUNT(*) AS activeCnt'], returns: [{ activeCnt: 1 }] },
      { match: ['INSERT INTO refresh_tokens'], returns: { insertId: 2, affectedRows: 1 } },
    ])
    const app = makeApp()
    const res = await supertest(app)
      .post('/api/auth/refresh')
      .set('Cookie', 'lf_refresh_token=somevalidvalue')
    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({ id: 5, username: VALID_USER })
    const access = getCookie(res.headers['set-cookie'], 'lf_access_token')
    expect(access).toBeTruthy()

    // 回归（原子轮换）：抢占删除必须是"按 token_hash + 未过期"的单条守卫 DELETE，
    // 而非按 id 删（无法防并发双花）
    const delCall = mockExecute.mock.calls.find(([sql]) =>
      String(sql).includes('DELETE FROM refresh_tokens WHERE token_hash')
    )
    expect(delCall).toBeTruthy()
    expect(String(delCall[0])).toContain('expires_at > NOW()')
    expect(delCall[1]).toEqual([hashToken('somevalidvalue')])

    // 设备复检（驱逐制）：轮换写入后统计活跃会话总数（与登录口径一致，排除空 device_id）
    const cntCall = mockExecute.mock.calls.find(([sql]) =>
      String(sql).includes('COUNT(*) AS activeCnt')
    )
    expect(cntCall).toBeTruthy()
    expect(String(cntCall[0])).toContain("device_id <> ''")
    expect(String(cntCall[0])).toContain('expires_at > NOW()')
    expect(cntCall[1]).toEqual([5])
    // 未超限：不得发出驱逐 DELETE
    expect(
      mockExecute.mock.calls.some(([sql]) =>
        String(sql).includes('DELETE FROM refresh_tokens WHERE id IN')
      )
    ).toBe(false)
  })

  it('设备复检：活跃会话超上限 → 驱逐最旧他台（排除本会话行），本台正常续期 200', async () => {
    setExecuteHandlers([
      { match: ['SELECT id, user_id, device_id'], returns: [STORED_REFRESH_ROW] },
      { match: ['DELETE FROM refresh_tokens WHERE token_hash'], returns: { affectedRows: 1 } },
      {
        match: ['FROM users WHERE id'],
        returns: [
          { id: 5, username: VALID_USER, nickname: 'Alice', is_guest: 0, max_devices: null },
        ],
      },
      // 全局上限 2，活跃会话 3 台 → 超额 1 台，驱逐最旧的 1 台他者
      { match: ['COUNT(*) AS activeCnt'], returns: [{ activeCnt: 3 }] },
      { match: ['INSERT INTO refresh_tokens'], returns: { insertId: 2, affectedRows: 1 } },
    ])
    const app = makeApp()
    const res = await supertest(app)
      .post('/api/auth/refresh')
      .set('Cookie', 'lf_refresh_token=overlimit')
    // 语义变化（驱逐制）：refresh 不再 403，本台续期成功，超额的最旧设备被服务端删行
    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({ id: 5, username: VALID_USER })
    expect(getCookie(res.headers['set-cookie'], 'lf_refresh_token')).toBeTruthy()

    // 驱逐 = 单条原子 DELETE + 派生表子查询；按 last_active_at 最旧排序，排除本会话行
    const evictCall = mockExecute.mock.calls.find(([sql]) =>
      String(sql).includes('DELETE FROM refresh_tokens WHERE id IN')
    )
    expect(evictCall).toBeTruthy()
    expect(String(evictCall[0])).toContain('ORDER BY last_active_at ASC')
    expect(String(evictCall[0])).toContain('id <> ?')
    expect(String(evictCall[0])).toContain('LIMIT ?')
    // [user_id, 本会话行 id（来自 upsert 的 insertId）, 超额台数]
    expect(evictCall[1]).toEqual([5, 2, 1])
  })

  it('设备复检：活跃会话恰好等于上限 → 不驱逐（excess=0 边界）', async () => {
    setExecuteHandlers([
      { match: ['SELECT id, user_id, device_id'], returns: [STORED_REFRESH_ROW] },
      { match: ['DELETE FROM refresh_tokens WHERE token_hash'], returns: { affectedRows: 1 } },
      {
        match: ['FROM users WHERE id'],
        returns: [
          { id: 5, username: VALID_USER, nickname: 'Alice', is_guest: 0, max_devices: null },
        ],
      },
      { match: ['COUNT(*) AS activeCnt'], returns: [{ activeCnt: 2 }] },
      { match: ['INSERT INTO refresh_tokens'], returns: { insertId: 2, affectedRows: 1 } },
    ])
    const app = makeApp()
    const res = await supertest(app)
      .post('/api/auth/refresh')
      .set('Cookie', 'lf_refresh_token=atlimit')
    expect(res.status).toBe(200)
    expect(
      mockExecute.mock.calls.some(([sql]) =>
        String(sql).includes('DELETE FROM refresh_tokens WHERE id IN')
      )
    ).toBe(false)
  })

  it('用户级 max_devices=0（不限）→ refresh 不复检上限（不发 activeCnt 查询）', async () => {
    setExecuteHandlers([
      { match: ['SELECT id, user_id, device_id'], returns: [STORED_REFRESH_ROW] },
      { match: ['DELETE FROM refresh_tokens WHERE token_hash'], returns: { affectedRows: 1 } },
      {
        match: ['FROM users WHERE id'],
        returns: [{ id: 5, username: VALID_USER, nickname: 'Alice', is_guest: 0, max_devices: 0 }],
      },
      { match: ['INSERT INTO refresh_tokens'], returns: { insertId: 2, affectedRows: 1 } },
    ])
    const app = makeApp()
    const res = await supertest(app)
      .post('/api/auth/refresh')
      .set('Cookie', 'lf_refresh_token=unlimited')
    expect(res.status).toBe(200)
    expect(mockExecute.mock.calls.some(([sql]) => String(sql).includes('activeCnt'))).toBe(false)
  })

  it('并发抢占同一 token（原子 DELETE affectedRows=0）→ 401 但不清 cookie（胜者刚下发的新 cookie 不能被抹掉），不再签发并行会话', async () => {
    setExecuteHandlers([
      { match: ['SELECT id, user_id, device_id'], returns: [STORED_REFRESH_ROW] },
      { match: ['DELETE FROM refresh_tokens WHERE token_hash'], returns: { affectedRows: 0 } },
    ])
    const app = makeApp()
    const res = await supertest(app)
      .post('/api/auth/refresh')
      .set('Cookie', 'lf_refresh_token=racedvalue')
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/请先登录/)
    // 输了的请求不得写入新 token（否则出现两套并行会话）
    expect(
      mockExecute.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO refresh_tokens'))
    ).toBe(false)
    // 回归（B2）：并发败者只回 401 响应体，不清 cookie——否则会抹掉并发胜者
    // 刚 Set-Cookie 的新 refresh token，双标签页间歇被登出
    const sc = res.headers['set-cookie'] || []
    const arr = Array.isArray(sc) ? sc : [sc]
    expect(arr.some((c) => /lf_refresh_token=;/.test(c))).toBe(false)
    expect(arr.some((c) => /lf_access_token=;/.test(c))).toBe(false)
  })

  it('正式用户订阅到期 → 401 SUBSCRIPTION_EXPIRED 且清 cookie（挂机页面的最后兜底闸）', async () => {
    setExecuteHandlers([
      { match: ['SELECT id, user_id, device_id'], returns: [STORED_REFRESH_ROW] },
      { match: ['DELETE FROM refresh_tokens WHERE token_hash'], returns: { affectedRows: 1 } },
      {
        match: ['FROM users WHERE id'],
        returns: [
          {
            id: 5,
            username: VALID_USER,
            nickname: 'Alice',
            is_guest: 0,
            max_devices: null,
            subscription_expires_at: new Date(Date.now() - 1000),
          },
        ],
      },
    ])
    const app = makeApp()
    const res = await supertest(app)
      .post('/api/auth/refresh')
      .set('Cookie', 'lf_refresh_token=somevalidvalue')
    expect(res.status).toBe(401)
    expect(res.body.code).toBe('SUBSCRIPTION_EXPIRED')
    // 清 cookie（与「token 不存在」分支同款强制下线语义）
    const cleared = (res.headers['set-cookie'] || []).join(';')
    expect(cleared).toContain('lf_access_token=;')
    expect(cleared).toContain('lf_refresh_token=;')
    // 到期后不得签发新会话
    expect(
      mockExecute.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO refresh_tokens'))
    ).toBe(false)
  })

  it('正式用户订阅未到期 → 200 且新 access 内嵌 subExp、user 附 subscriptionExpiresAt', async () => {
    const subExp = new Date(Date.now() + 720 * 60 * 60 * 1000)
    setExecuteHandlers([
      { match: ['SELECT id, user_id, device_id'], returns: [STORED_REFRESH_ROW] },
      { match: ['DELETE FROM refresh_tokens WHERE token_hash'], returns: { affectedRows: 1 } },
      {
        match: ['FROM users WHERE id'],
        returns: [
          {
            id: 5,
            username: VALID_USER,
            nickname: 'Alice',
            is_guest: 0,
            max_devices: null,
            subscription_expires_at: subExp,
          },
        ],
      },
      { match: ['COUNT(*) AS activeCnt'], returns: [{ activeCnt: 1 }] },
      { match: ['INSERT INTO refresh_tokens'], returns: { insertId: 2, affectedRows: 1 } },
    ])
    const app = makeApp()
    const res = await supertest(app)
      .post('/api/auth/refresh')
      .set('Cookie', 'lf_refresh_token=somevalidvalue')
    expect(res.status).toBe(200)
    expect(res.body.user.subscriptionExpiresAt).toBe(subExp.toISOString())
    const access = getCookie(res.headers['set-cookie'], 'lf_access_token')
    const decoded = jwt.verify(access, FIXED_JWT_SECRET)
    expect(decoded.subExp).toBe(subExp.toISOString())
  })
})

// =====================================================================
// 设备管理：GET /api/auth/devices（is_current 以服务端 cookie 为准）
// =====================================================================
describe('GET /api/auth/devices', () => {
  const userId = 5
  const token = jwt.sign({ userId }, FIXED_JWT_SECRET, { expiresIn: '30m' })

  it('is_current 以 lf_device_id cookie 比对（回归：query.deviceId 是前端 localStorage id，恒不相等）', async () => {
    setExecuteHandlers([
      {
        match: ['AS is_current'],
        returns: [
          {
            id: 1,
            device_name: 'Chrome · Windows',
            ip: '1.2.3.4',
            last_active_at: new Date('2026-09-10T00:00:00Z'),
            is_current: 1,
          },
          {
            id: 2,
            device_name: 'Safari · iPhone',
            ip: '5.6.7.8',
            last_active_at: new Date('2026-09-09T00:00:00Z'),
            is_current: 0,
          },
        ],
      },
    ])
    const app = makeApp()
    const res = await supertest(app)
      .get('/api/auth/devices')
      .set('Cookie', `lf_access_token=${token}; lf_device_id=cookie-device-1`)
      // query 里伪造的 localStorage id 必须被忽略
      .query({ deviceId: 'forged-localstorage-id' })
    expect(res.status).toBe(200)
    expect(res.body.devices[0]).toMatchObject({ id: 1, isCurrent: true })
    expect(res.body.devices[1]).toMatchObject({ id: 2, isCurrent: false })

    // SQL 参数第一个是 cookie 的 device id，不是 query 伪造值
    const call = mockExecute.mock.calls.find(([sql]) => String(sql).includes('AS is_current'))
    expect(call[1][0]).toBe('cookie-device-1')
    expect(call[1][1]).toBe(userId)
  })

  it('无设备 cookie → 空串比对，所有行 isCurrent=false', async () => {
    setExecuteHandlers([
      {
        match: ['AS is_current'],
        returns: [{ id: 1, device_name: null, ip: null, last_active_at: null, is_current: 0 }],
      },
    ])
    const app = makeApp()
    const res = await supertest(app)
      .get('/api/auth/devices')
      .set('Cookie', `lf_access_token=${token}`)
    expect(res.status).toBe(200)
    expect(res.body.devices[0]).toMatchObject({ id: 1, name: '未知设备', isCurrent: false })
  })
})

// =====================================================================
// 找回密码：POST /api/auth/recover-reset（凭激活码重置用户名与密码）
// =====================================================================
describe('POST /api/auth/recover-reset', () => {
  const validBody = { code: 'CODE1', username: 'newname1', password: VALID_PASSWORD }

  it('入口先过 code 维度限流（回归：修复前 recover-reset 失败不计次，可无限爆破激活码接管账号）', async () => {
    const rateErr = new Error('登录尝试过于频繁，请稍后再试')
    rateErr.status = 429
    fakeRateLimit.checkLoginRateLimit.mockRejectedValueOnce(rateErr)
    const app = makeApp()
    const res = await supertest(app).post('/api/auth/recover-reset').send(validBody)
    expect(res.status).toBe(429)
    expect(fakeRateLimit.checkLoginRateLimit).toHaveBeenCalledWith(
      'recover:CODE1',
      expect.any(String)
    )
  })

  it('code 无关联账号 → 404 且按 code 维度记失败', async () => {
    setExecuteHandlers([{ match: ['JOIN experience_codes'], returns: [] }])
    const app = makeApp()
    const res = await supertest(app).post('/api/auth/recover-reset').send(validBody)
    expect(res.status).toBe(404)
    expect(fakeRateLimit.logAttempt).toHaveBeenCalledWith(
      'recover:CODE1',
      expect.any(String),
      false
    )
  })

  it('重置成功 → 200，按 code 维度记成功并踢掉所有旧登录态', async () => {
    setExecuteHandlers([
      { match: ['JOIN experience_codes'], returns: [{ id: 5, username: 'oldname1' }] },
      { match: ['FROM users WHERE username'], returns: [] }, // 新用户名可用
      { match: ['UPDATE users SET username'], returns: { affectedRows: 1 } },
      { match: ['DELETE FROM refresh_tokens WHERE user_id'], returns: { affectedRows: 1 } },
      { match: ['INSERT INTO refresh_tokens'], returns: { insertId: 1, affectedRows: 1 } },
      {
        match: ['SELECT id, username, nickname, avatar_url'],
        returns: [
          {
            id: 5,
            username: 'newname1',
            nickname: null,
            avatar_url: null,
            daily_goal_minutes: 30,
            signature: null,
          },
        ],
      },
    ])
    const app = makeApp()
    const res = await supertest(app).post('/api/auth/recover-reset').send(validBody)
    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({ id: 5, username: 'newname1' })
    expect(fakeRateLimit.logAttempt).toHaveBeenCalledWith('recover:CODE1', expect.any(String), true)
    expect(
      mockExecute.mock.calls.some(([sql]) =>
        String(sql).includes('DELETE FROM refresh_tokens WHERE user_id')
      )
    ).toBe(true)
  })

  it('订阅已到期 → 401 SUBSCRIPTION_EXPIRED，不重置不签发（堵住「到期→找回密码→拿无 subExp 会话」旁路）', async () => {
    setExecuteHandlers([
      {
        match: ['JOIN experience_codes'],
        returns: [
          {
            id: 5,
            username: 'oldname1',
            subscription_expires_at: new Date(Date.now() - 3600 * 1000),
          },
        ],
      },
    ])
    const app = makeApp()
    const res = await supertest(app).post('/api/auth/recover-reset').send(validBody)
    expect(res.status).toBe(401)
    expect(res.body.code).toBe('SUBSCRIPTION_EXPIRED')
    expect(fakeRateLimit.logAttempt).toHaveBeenCalledWith(
      'recover:CODE1',
      expect.any(String),
      false
    )
    // 到期账号不得重置用户名密码，也不得签发任何会话
    expect(
      mockExecute.mock.calls.some(([sql]) => String(sql).includes('UPDATE users SET username'))
    ).toBe(false)
    expect(
      mockExecute.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO refresh_tokens'))
    ).toBe(false)
  })

  it('订阅未到期 → 200 且新 access token 内嵌 subExp、响应附 subscriptionExpiresAt', async () => {
    const subExp = new Date(Date.now() + 720 * 60 * 60 * 1000)
    setExecuteHandlers([
      {
        match: ['JOIN experience_codes'],
        returns: [{ id: 5, username: 'oldname1', subscription_expires_at: subExp }],
      },
      { match: ['FROM users WHERE username'], returns: [] }, // 新用户名可用
      { match: ['UPDATE users SET username'], returns: { affectedRows: 1 } },
      { match: ['DELETE FROM refresh_tokens WHERE user_id'], returns: { affectedRows: 1 } },
      { match: ['INSERT INTO refresh_tokens'], returns: { insertId: 1, affectedRows: 1 } },
      {
        match: ['SELECT id, username, nickname, avatar_url'],
        returns: [
          {
            id: 5,
            username: 'newname1',
            nickname: null,
            avatar_url: null,
            daily_goal_minutes: 30,
            signature: null,
            subscription_expires_at: subExp,
          },
        ],
      },
    ])
    const app = makeApp()
    const res = await supertest(app).post('/api/auth/recover-reset').send(validBody)
    expect(res.status).toBe(200)
    expect(res.body.user.subscriptionExpiresAt).toBe(subExp.toISOString())
    const access = getCookie(res.headers['set-cookie'], 'lf_access_token')
    const decoded = jwt.verify(access, FIXED_JWT_SECRET)
    expect(decoded.subExp).toBe(subExp.toISOString())
  })
})

// =====================================================================
// 注册：激活码爆破防护（register-code 维度计数）
// =====================================================================
describe('POST /api/auth/register · 激活码爆破防护', () => {
  it('激活码无效 → 400 且按 code 维度记失败（回归：修复前失败不计次，探测无成本）', async () => {
    setExecuteHandlers([{ match: ['experience_codes WHERE code'], returns: [] }])
    const app = makeApp()
    const res = await supertest(app)
      .post('/api/auth/register')
      .send({ username: VALID_USER, password: VALID_PASSWORD, activationCode: 'GUESS1' })
    expect(res.status).toBe(400)
    expect(fakeRateLimit.logAttempt).toHaveBeenCalledWith(
      'register-code:GUESS1',
      expect.any(String),
      false
    )
  })

  it('IP 限流先于激活码查询（429 时不发起 code 查询）', async () => {
    const rateErr = new Error('注册尝试过于频繁，请稍后再试')
    rateErr.status = 429
    fakeRateLimit.checkRegisterRateLimit.mockRejectedValueOnce(rateErr)
    const app = makeApp()
    const res = await supertest(app)
      .post('/api/auth/register')
      .send({ username: VALID_USER, password: VALID_PASSWORD, activationCode: 'CODE1' })
    expect(res.status).toBe(429)
    expect(mockExecute.mock.calls.some(([sql]) => String(sql).includes('experience_codes'))).toBe(
      false
    )
  })
})

// =====================================================================
// auth 通用 IP 限流：refresh / logout / change-password（安全修复回归）
// 这三个端点此前无任何限流：refresh 可未认证刷 DB、change-password 可刷 bcrypt CPU
// =====================================================================
describe('auth 通用 IP 限流（refresh/logout/change-password）', () => {
  it('三个路由均挂载了 IP 限流中间件（rateLimiter）', () => {
    for (const path of ['/refresh', '/logout', '/change-password']) {
      const layer = authRouter.stack.find((l) => l.route && l.route.path === path)
      expect(layer).toBeTruthy()
      const middlewareNames = layer.route.stack.map((s) => s.name)
      expect(middlewareNames).toContain('rateLimiter')
    }
  })

  // 注意：本用例会刷爆共享的 60s 限流窗口，必须放在本文件所有 refresh/logout 用例之后
  it('refresh 超过阈值（30 次/分/IP）→ 429（回归：此前可无限刷）', async () => {
    let last
    for (let i = 0; i < 40; i++) {
      last = await supertest(makeApp()).post('/api/auth/refresh')
    }
    expect(last.status).toBe(429)
    expect(last.body.error).toMatch(/请求过于频繁/)
  })
})
