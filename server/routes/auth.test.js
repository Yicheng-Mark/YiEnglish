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
const path = require('path')
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

// 构造临时 app：模拟主应用挂载方式（/api/auth 前缀）
function makeApp() {
  const app = express()
  app.use(express.json())
  app.use(cookieParser()) // auth.js 依赖 req.cookies，必须挂 cookie-parser
  app.use('/api/auth', authRouter)
  // 兜底错误处理（auth.js 里 next(err) 会落到这里）
  app.use((err, req, res, next) => {
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

  it('登录成功 → 200 + 下发 cookie + 返回用户信息', async () => {
    setExecuteHandlers([
      {
        match: ['FROM users WHERE username'],
        returns: [{ id: 5, username: VALID_USER, nickname: 'Alice', password_hash: VALID_HASH }],
      },
      { match: ['SELECT COUNT(*) AS cnt FROM refresh_tokens'], returns: [{ cnt: 0 }] },
      { match: ['DELETE FROM refresh_tokens WHERE user_id'], returns: { affectedRows: 0 } },
      { match: ['INSERT INTO refresh_tokens'], returns: { insertId: 1, affectedRows: 1 } },
    ])
    const app = makeApp()
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ username: VALID_USER, password: VALID_PASSWORD })

    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({ id: 5, username: VALID_USER, nickname: 'Alice' })
    const access = getCookie(res.headers['set-cookie'], 'lf_access_token')
    const refresh = getCookie(res.headers['set-cookie'], 'lf_refresh_token')
    expect(access).toBeTruthy()
    expect(refresh).toBeTruthy()
  })

  it('达设备上限 → 403 DEVICE_LIMIT_REACHED', async () => {
    setExecuteHandlers([
      {
        match: ['FROM users WHERE username'],
        returns: [{ id: 5, username: VALID_USER, nickname: 'Alice', password_hash: VALID_HASH }],
      },
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

  it('有效 refresh token（正式用户）→ 200 轮换并下发新 cookie', async () => {
    setExecuteHandlers([
      {
        match: ['FROM refresh_tokens WHERE token_hash'],
        returns: [
          {
            id: 100,
            user_id: 5,
            device_id: 'dev-1',
            device_name: 'Chrome · Windows',
            ip: '127.0.0.1',
          },
        ],
      },
      { match: ['DELETE FROM refresh_tokens WHERE id'], returns: { affectedRows: 1 } },
      {
        match: ['FROM users WHERE id'],
        returns: [{ id: 5, username: VALID_USER, nickname: 'Alice', is_guest: 0 }],
      },
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
  })
})
