// 管理后台（admin）路由测试：supertest 驱动临时 express app，全程 mock。
// mock 策略与 demo.test.js 相同（require.cache 注入）：
//   - ../db、../middleware/auth 注入 fake；requireAdmin 走真实实现（其 ../db 依赖已被 fake）
//   - ../utils/tokens 走真实实现（getClientIp 供审计）
// 重点覆盖：非 admin 404 防探测、续期 GREATEST 基准 SQL、参数校验、审计写入、批量生成码。

import { describe, it, expect, beforeEach, vi } from 'vitest'
const express = require('express')
const supertest = require('supertest')

const FIXED_CONFIG = {
  PORT: 3001,
  NODE_ENV: 'development',
  JWT_SECRET: 'test-jwt-secret-for-admin-tests',
  JWT_ACCESS_EXPIRES: '30m',
  JWT_REFRESH_EXPIRES: '7d',
  BCRYPT_ROUNDS: 4,
}

const ADMIN_ID = 1
const fakeAuthMiddleware = (req, res, next) => {
  req.userId = ADMIN_ID
  req.isGuest = false
  next()
}

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

const adminRouter = require('./admin')

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/admin', adminRouter)
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ error: err.message || '服务器错误' })
  })
  return app
}

function setExecuteHandlers(handlers) {
  mockExecute.mockImplementation(async (sql, params) => {
    for (const h of handlers) {
      if (h.match.every((sub) => String(sql).includes(sub))) {
        const rows = typeof h.returns === 'function' ? h.returns(params) : h.returns
        return [rows, []]
      }
    }
    return [[], []]
  })
}

const USER_ROW = {
  id: 42,
  username: 'zyc',
  nickname: '学习者',
  is_guest: 0,
  is_admin: 0,
  subscription_expires_at: null,
  max_devices: null,
  created_at: '2026-01-01 00:00:00',
  last_active_at: '2026-09-16 10:00:00',
  device_count: 2,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetConnection.mockResolvedValue(mockConnection)
  mockConnection.beginTransaction.mockResolvedValue()
  mockConnection.commit.mockResolvedValue()
  mockConnection.rollback.mockResolvedValue()
  mockConnection.release.mockReset()
  // 默认：requireAdmin 查库放行（is_admin=1）
  setExecuteHandlers([{ match: ['SELECT is_admin FROM users'], returns: [{ is_admin: 1 }] }])
})

// =====================================================================
// 鉴权
// =====================================================================
describe('requireAdmin', () => {
  it('非 admin → 404（不暴露管理端点存在）', async () => {
    setExecuteHandlers([{ match: ['SELECT is_admin FROM users'], returns: [{ is_admin: 0 }] }])
    const res = await supertest(makeApp()).get('/api/admin/users')
    expect(res.status).toBe(404)
  })

  it('用户不存在（rows 空）→ 404', async () => {
    setExecuteHandlers([{ match: ['SELECT is_admin FROM users'], returns: [] }])
    const res = await supertest(makeApp()).get('/api/admin/users')
    expect(res.status).toBe(404)
  })
})

// =====================================================================
// GET /api/admin/users
// =====================================================================
describe('GET /api/admin/users', () => {
  it('默认列表：字段映射 + 分页元信息', async () => {
    setExecuteHandlers([
      { match: ['SELECT is_admin FROM users'], returns: [{ is_admin: 1 }] },
      // COUNT 查询同时含 "FROM users u"，必须排在列表 handler 之前
      { match: ['COUNT(*) AS total'], returns: [{ total: 1 }] },
      { match: ['FROM users u'], returns: [USER_ROW] },
    ])
    const res = await supertest(makeApp()).get('/api/admin/users')
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(1)
    expect(res.body.users[0]).toMatchObject({
      id: 42,
      username: 'zyc',
      isGuest: false,
      isAdmin: false,
      subscriptionExpiresAt: null,
      deviceCount: 2,
    })
  })

  it('filter=expiring → SQL 带 7 天窗口', async () => {
    let captured = ''
    setExecuteHandlers([
      { match: ['SELECT is_admin FROM users'], returns: [{ is_admin: 1 }] },
      {
        match: ['FROM users u'],
        returns: (p) => {
          void p
          return []
        },
      },
      { match: ['COUNT(*) AS total'], returns: [{ total: 0 }] },
    ])
    mockExecute.mockImplementation(async (sql) => {
      captured = String(sql)
      // COUNT 查询同时含 "FROM users u"，COUNT 判断必须在前
      if (String(sql).includes('COUNT(*) AS total')) return [[{ total: 0 }], []]
      if (String(sql).includes('FROM users u')) return [[], []]
      return [[{ is_admin: 1 }], []]
    })
    const res = await supertest(makeApp()).get('/api/admin/users?filter=expiring')
    expect(res.status).toBe(200)
    expect(captured).toMatch(/BETWEEN NOW\(\) AND DATE_ADD\(NOW\(\), INTERVAL 7 DAY\)/)
  })
})

// =====================================================================
// POST /api/admin/users/:id/subscription
// =====================================================================
// 目标用户预检 SELECT 的固定 handler：非访客、月卡到期时间在未来（days 续期的正常路径）
function withTargetUser(overrides = {}) {
  return {
    match: ['SELECT is_guest, subscription_expires_at FROM users'],
    returns: [
      { is_guest: 0, subscription_expires_at: new Date(Date.now() + 5 * 86400000), ...overrides },
    ],
  }
}

describe('POST /api/admin/users/:id/subscription', () => {
  it('days=30 → GREATEST 基准续期 + 审计落库', async () => {
    setExecuteHandlers([
      { match: ['SELECT is_admin FROM users'], returns: [{ is_admin: 1 }] },
      withTargetUser(),
      { match: ['UPDATE users SET subscription_expires_at'], returns: { affectedRows: 1 } },
      { match: ['INSERT INTO admin_audit_log'], returns: { affectedRows: 1 } },
    ])
    const res = await supertest(makeApp())
      .post('/api/admin/users/42/subscription')
      .send({ days: 30 })
    expect(res.status).toBe(200)
    const renewCall = mockExecute.mock.calls.find(([sql]) =>
      String(sql).includes('UPDATE users SET subscription_expires_at')
    )
    // 未到期续期不吃亏：基准是 GREATEST(NOW(), 当前到期)
    expect(String(renewCall[0])).toMatch(
      /GREATEST\(NOW\(\), COALESCE\(subscription_expires_at, NOW\(\)\)\)/
    )
    expect(String(renewCall[0])).toMatch(/INTERVAL 30 DAY/)
    expect(renewCall[1]).toEqual([42])
    const auditCall = mockExecute.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO admin_audit_log')
    )
    expect(auditCall[1][0]).toBe(ADMIN_ID)
    expect(auditCall[1][1]).toBe('renew_subscription')
  })

  it('permanent=true → 置 NULL', async () => {
    setExecuteHandlers([
      { match: ['SELECT is_admin FROM users'], returns: [{ is_admin: 1 }] },
      withTargetUser(),
      { match: ['UPDATE users SET subscription_expires_at'], returns: { affectedRows: 1 } },
      { match: ['INSERT INTO admin_audit_log'], returns: { affectedRows: 1 } },
    ])
    const res = await supertest(makeApp())
      .post('/api/admin/users/42/subscription')
      .send({ permanent: true })
    expect(res.status).toBe(200)
    const renewCall = mockExecute.mock.calls.find(([sql]) =>
      String(sql).includes('UPDATE users SET subscription_expires_at')
    )
    expect(String(renewCall[0])).toMatch(/subscription_expires_at = NULL/)
    expect(String(renewCall[0])).not.toMatch(/GREATEST/)
  })

  it('永久账号 days 续期 → 400 拒绝（防 NOW()+N 天覆盖 NULL 静默降级），不发 UPDATE', async () => {
    setExecuteHandlers([
      { match: ['SELECT is_admin FROM users'], returns: [{ is_admin: 1 }] },
      withTargetUser({ subscription_expires_at: null }),
      { match: ['UPDATE users SET subscription_expires_at'], returns: { affectedRows: 1 } },
    ])
    const res = await supertest(makeApp())
      .post('/api/admin/users/42/subscription')
      .send({ days: 30 })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('永久')
    const renewCall = mockExecute.mock.calls.find(([sql]) =>
      String(sql).includes('UPDATE users SET subscription_expires_at')
    )
    expect(renewCall).toBeUndefined()
  })

  it('访客账号 → 400 拒绝（days 与 permanent 均不支持）', async () => {
    setExecuteHandlers([
      { match: ['SELECT is_admin FROM users'], returns: [{ is_admin: 1 }] },
      withTargetUser({ is_guest: 1 }),
    ])
    const daysRes = await supertest(makeApp())
      .post('/api/admin/users/42/subscription')
      .send({ days: 30 })
    expect(daysRes.status).toBe(400)
    const permRes = await supertest(makeApp())
      .post('/api/admin/users/42/subscription')
      .send({ permanent: true })
    expect(permRes.status).toBe(400)
  })

  it('days 越界（0 / 3651 / 非数字）→ 400', async () => {
    setExecuteHandlers([
      { match: ['SELECT is_admin FROM users'], returns: [{ is_admin: 1 }] },
      withTargetUser(),
    ])
    for (const days of [0, 3651, 'abc']) {
      const res = await supertest(makeApp()).post('/api/admin/users/42/subscription').send({ days })
      expect(res.status).toBe(400)
    }
  })

  it('用户不存在 → 404', async () => {
    setExecuteHandlers([
      { match: ['SELECT is_admin FROM users'], returns: [{ is_admin: 1 }] },
      { match: ['UPDATE users SET subscription_expires_at'], returns: { affectedRows: 0 } },
    ])
    const res = await supertest(makeApp())
      .post('/api/admin/users/42/subscription')
      .send({ days: 30 })
    expect(res.status).toBe(404)
  })
})

// =====================================================================
// POST /api/admin/users/:id/max-devices
// =====================================================================
describe('POST /api/admin/users/:id/max-devices', () => {
  it('value=null → 恢复全局默认（SQL 置 NULL）', async () => {
    setExecuteHandlers([
      { match: ['SELECT is_admin FROM users'], returns: [{ is_admin: 1 }] },
      { match: ['max_devices = NULL'], returns: { affectedRows: 1 } },
      { match: ['INSERT INTO admin_audit_log'], returns: { affectedRows: 1 } },
    ])
    const res = await supertest(makeApp())
      .post('/api/admin/users/42/max-devices')
      .send({ value: null })
    expect(res.status).toBe(200)
    const call = mockExecute.mock.calls.find(([sql]) => String(sql).includes('max_devices = NULL'))
    expect(call[1]).toEqual([42])
  })

  it('value=11 越界 → 400；value=3 正常', async () => {
    setExecuteHandlers([
      { match: ['SELECT is_admin FROM users'], returns: [{ is_admin: 1 }] },
      { match: ['UPDATE users SET max_devices'], returns: { affectedRows: 1 } },
      { match: ['INSERT INTO admin_audit_log'], returns: { affectedRows: 1 } },
    ])
    const bad = await supertest(makeApp())
      .post('/api/admin/users/42/max-devices')
      .send({ value: 11 })
    expect(bad.status).toBe(400)
    const ok = await supertest(makeApp()).post('/api/admin/users/42/max-devices').send({ value: 3 })
    expect(ok.status).toBe(200)
  })
})

// =====================================================================
// POST /api/admin/codes（生成）
// =====================================================================
describe('POST /api/admin/codes', () => {
  function mockInsertOk() {
    mockConnection.execute.mockResolvedValue([{ affectedRows: 2 }, []])
  }

  it('生成月卡 2 个 → 201，码形如 lf-XXXXXXXXXXXX，INSERT 占位符走参数', async () => {
    mockInsertOk()
    const res = await supertest(makeApp())
      .post('/api/admin/codes')
      .send({ trialHours: 720, count: 2, maxUses: 1, description: '测试批次' })
    expect(res.status).toBe(201)
    expect(res.body.codes).toHaveLength(2)
    for (const c of res.body.codes) {
      expect(c).toMatch(/^lf-[A-Z2-9]{12}$/) // 去掉易混淆 I/O/0/1 的字母表
    }
    const insertCall = mockConnection.execute.mock.calls.find(
      ([sql]) =>
        String(sql).includes('INSERT INTO experience_codes') &&
        String(sql).includes('(?, ?, ?, ?, ?)')
    )
    expect(String(insertCall[0])).toMatch(/\(\?, \?, \?, \?, \?\), \(\?, \?, \?, \?, \?\)/)
    // 参数顺序：code, description, type, max_uses, trial_hours
    expect(insertCall[1].slice(1, 5)).toEqual(['测试批次', 'activation', 1, 720])
    expect(mockConnection.commit).toHaveBeenCalled()
  })

  it('trialHours 非 0/720/2160/8760 → 400', async () => {
    const res = await supertest(makeApp())
      .post('/api/admin/codes')
      .send({ trialHours: 999, count: 1 })
    expect(res.status).toBe(400)
  })

  it('count 越界（0 / 201）→ 400', async () => {
    for (const count of [0, 201]) {
      const res = await supertest(makeApp())
        .post('/api/admin/codes')
        .send({ trialHours: 720, count })
      expect(res.status).toBe(400)
    }
  })
})

// =====================================================================
// PATCH /api/admin/codes/:id
// =====================================================================
describe('PATCH /api/admin/codes/:id', () => {
  it('{isActive, issuedNote} → 白名单两字段更新 + 审计', async () => {
    setExecuteHandlers([
      { match: ['SELECT is_admin FROM users'], returns: [{ is_admin: 1 }] },
      { match: ['UPDATE experience_codes'], returns: { affectedRows: 1 } },
      { match: ['INSERT INTO admin_audit_log'], returns: { affectedRows: 1 } },
    ])
    const res = await supertest(makeApp())
      .patch('/api/admin/codes/11')
      .send({ isActive: false, issuedNote: '发给了张三' })
    expect(res.status).toBe(200)
    const call = mockExecute.mock.calls.find(([sql]) =>
      String(sql).includes('UPDATE experience_codes')
    )
    expect(String(call[0])).toMatch(/is_active = \?/)
    expect(String(call[0])).toMatch(/issued_note = \?/)
    expect(String(call[0])).not.toMatch(/description = \?/) // 缺省字段不动
    expect(call[1]).toEqual([0, '发给了张三', 11])
  })

  it('空 body → 400；码不存在 → 404', async () => {
    setExecuteHandlers([
      { match: ['SELECT is_admin FROM users'], returns: [{ is_admin: 1 }] },
      { match: ['UPDATE experience_codes'], returns: { affectedRows: 0 } },
    ])
    const empty = await supertest(makeApp()).patch('/api/admin/codes/11').send({})
    expect(empty.status).toBe(400)
    const gone = await supertest(makeApp()).patch('/api/admin/codes/11').send({ isActive: true })
    expect(gone.status).toBe(404)
  })
})

// =====================================================================
// GET /api/admin/audit
// =====================================================================
describe('GET /api/admin/audit', () => {
  it('列表 + JOIN 管理员用户名', async () => {
    setExecuteHandlers([
      { match: ['SELECT is_admin FROM users'], returns: [{ is_admin: 1 }] },
      // COUNT 查询同时含 "FROM admin_audit_log"，排在列表 handler 之前
      { match: ['COUNT(*) AS total'], returns: [{ total: 1 }] },
      {
        match: ['FROM admin_audit_log'],
        returns: [
          {
            id: 1,
            admin_user_id: ADMIN_ID,
            admin_username: 'zyc',
            action: 'renew_subscription',
            target_type: 'user',
            target_id: 42,
            detail: '{"days":30}',
            ip: '1.2.3.4',
            created_at: '2026-09-17 00:00:00',
          },
        ],
      },
    ])
    const res = await supertest(makeApp()).get('/api/admin/audit')
    expect(res.status).toBe(200)
    expect(res.body.logs[0]).toMatchObject({ adminUsername: 'zyc', action: 'renew_subscription' })
  })
})

// =====================================================================
// TOTP 两步验证（GET status / POST setup / POST enable / POST disable）
// =====================================================================
describe('管理员 TOTP 端点', () => {
  const { generateTotpSecret, encryptTotpSecret, hotp, base32Decode } = require('../utils/totp')

  function currentCode(secret) {
    return hotp(base32Decode(secret), Math.floor(Date.now() / 1000 / 30))
  }

  it('status：按当前管理员 totp_secret 有无返回 enabled', async () => {
    setExecuteHandlers([
      { match: ['SELECT is_admin FROM users'], returns: [{ is_admin: 1 }] },
      { match: ['SELECT totp_secret FROM users'], returns: [{ totp_secret: 'enc' }] },
    ])
    const res = await supertest(makeApp()).get('/api/admin/totp/status')
    expect(res.status).toBe(200)
    expect(res.body.enabled).toBe(true)
  })

  it('setup：返回 32 位 base32 密钥与 otpauth URL，且不写库', async () => {
    setExecuteHandlers([
      { match: ['SELECT is_admin FROM users'], returns: [{ is_admin: 1 }] },
      { match: ['SELECT username FROM users'], returns: [{ username: 'zyc' }] },
    ])
    const res = await supertest(makeApp()).post('/api/admin/totp/setup')
    expect(res.status).toBe(200)
    expect(res.body.secret).toMatch(/^[A-Z2-7]{32}$/)
    expect(res.body.otpauthUrl).toMatch(/^otpauth:\/\/totp\/LingoForge:zyc\?secret=/)
    expect(
      mockExecute.mock.calls.some(([sql]) => String(sql).includes('UPDATE users SET totp_secret'))
    ).toBe(false)
  })

  it('enable：验证码与密钥匹配 → 加密落库 + 审计', async () => {
    const secret = generateTotpSecret()
    setExecuteHandlers([
      { match: ['SELECT is_admin FROM users'], returns: [{ is_admin: 1 }] },
      { match: ['UPDATE users SET totp_secret'], returns: { affectedRows: 1 } },
    ])
    const res = await supertest(makeApp())
      .post('/api/admin/totp/enable')
      .send({ secret, code: currentCode(secret) })
    expect(res.status).toBe(200)
    const call = mockExecute.mock.calls.find(([sql]) =>
      String(sql).includes('UPDATE users SET totp_secret')
    )
    // 落库的是密文，不得包含明文密钥
    expect(String(call[1][0])).not.toContain(secret)
    expect(String(call[1][0])).toMatch(/^[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/)
  })

  it('enable：验证码错误 / 密钥非法 → 400 不落库', async () => {
    const secret = generateTotpSecret()
    setExecuteHandlers([{ match: ['SELECT is_admin FROM users'], returns: [{ is_admin: 1 }] }])
    const wrongCode = await supertest(makeApp())
      .post('/api/admin/totp/enable')
      .send({ secret, code: '000000' })
    expect(wrongCode.status).toBe(400)
    // 000000 恰为当期正确值的极小概率由重试规避：再打一个非法形状
    const badShape = await supertest(makeApp())
      .post('/api/admin/totp/enable')
      .send({ secret, code: '12345' })
    expect(badShape.status).toBe(400)
    const badSecret = await supertest(makeApp())
      .post('/api/admin/totp/enable')
      .send({ secret: 'SHORT', code: '123456' })
    expect(badSecret.status).toBe(400)
    expect(
      mockExecute.mock.calls.some(([sql]) => String(sql).includes('UPDATE users SET totp_secret'))
    ).toBe(false)
  })

  it('disable：未启用 → 400；验证码正确 → 置 NULL + 审计', async () => {
    setExecuteHandlers([
      { match: ['SELECT is_admin FROM users'], returns: [{ is_admin: 1 }] },
      { match: ['SELECT totp_secret FROM users'], returns: [{ totp_secret: null }] },
    ])
    const notEnabled = await supertest(makeApp())
      .post('/api/admin/totp/disable')
      .send({ code: '123456' })
    expect(notEnabled.status).toBe(400)

    const secret = generateTotpSecret()
    setExecuteHandlers([
      { match: ['SELECT is_admin FROM users'], returns: [{ is_admin: 1 }] },
      {
        match: ['SELECT totp_secret FROM users'],
        returns: [{ totp_secret: encryptTotpSecret(secret) }],
      },
      { match: ['UPDATE users SET totp_secret'], returns: { affectedRows: 1 } },
    ])
    const ok = await supertest(makeApp())
      .post('/api/admin/totp/disable')
      .send({ code: currentCode(secret) })
    expect(ok.status).toBe(200)
    const call = mockExecute.mock.calls
      .filter(([sql]) => String(sql).includes('UPDATE users SET totp_secret'))
      .pop()
    expect(String(call[0])).toMatch(/totp_secret = NULL/)
  })

  it('disable：验证码错误 → 400 不动库', async () => {
    const secret = generateTotpSecret()
    setExecuteHandlers([
      { match: ['SELECT is_admin FROM users'], returns: [{ is_admin: 1 }] },
      {
        match: ['SELECT totp_secret FROM users'],
        returns: [{ totp_secret: encryptTotpSecret(secret) }],
      },
    ])
    const res = await supertest(makeApp()).post('/api/admin/totp/disable').send({ code: '000000' })
    expect(res.status).toBe(400)
    expect(
      mockExecute.mock.calls.some(([sql]) => String(sql).includes('UPDATE users SET totp_secret'))
    ).toBe(false)
  })

  it('非管理员 → 404（防探测，与其余管理端点一致）', async () => {
    setExecuteHandlers([{ match: ['SELECT is_admin FROM users'], returns: [{ is_admin: 0 }] }])
    const res = await supertest(makeApp()).get('/api/admin/totp/status')
    expect(res.status).toBe(404)
  })
})
