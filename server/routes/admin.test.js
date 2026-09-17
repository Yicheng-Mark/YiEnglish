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
describe('POST /api/admin/users/:id/subscription', () => {
  it('days=30 → GREATEST 基准续期 + 审计落库', async () => {
    setExecuteHandlers([
      { match: ['SELECT is_admin FROM users'], returns: [{ is_admin: 1 }] },
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

  it('days 越界（0 / 3651 / 非数字）→ 400', async () => {
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
