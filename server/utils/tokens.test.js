import { describe, it, expect, vi, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'

// ── 环境与 mock 准备 ──────────────────────────────────────────────
// tokens.js 在加载时 require('../config')，而 config.js 会 dotenv.config() 读取
// .env.local，从而用真实 JWT_SECRET 覆盖测试期望。
// 关键约束：
//  1) vi.stubEnv 不会被 Vitest 提升至 import 之前，无法及时生效；
//  2) vi.mock 工厂被提升执行，不能引用闭包外部的 const（TDZ），且经实测无法拦截
//     CJS 模块内部的 require()。
// 因此采用两条自包含、可靠的技术：
//  • vi.hoisted：在 import 前设置 process.env.*。dotenv.config() 默认不覆盖
//    已存在的环境变量，故测试密钥会保留，config.js 读到的即是它。
//  • 共享对象打补丁：db.js 导出的 pool 与 tokens.js 中 require('../db') 拿到的是
//    同一引用，直接替换 db.execute 即可让 issueTokens 走假实现，无需 mock 注册。
const { TEST_SECRET } = vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-jwt-secret-for-tokens-spec'
  process.env.JWT_ACCESS_EXPIRES = '30m'
  process.env.JWT_REFRESH_EXPIRES = '7d'
  process.env.NODE_ENV = 'test'
  return { TEST_SECRET: 'test-jwt-secret-for-tokens-spec' }
})

import * as tokensModule from './tokens'
const tokens = tokensModule
// 与 tokens.js 内 const pool = require('../db') 共享同一对象引用
const db = require('../db')

describe('signAccessToken', () => {
  it('签发后能用 jsonwebtoken 正确解码出 userId', () => {
    const token = tokens.signAccessToken('user-123')
    const decoded = jwt.verify(token, TEST_SECRET)
    expect(decoded.userId).toBe('user-123')
    // 非访客不应内嵌 isGuest 标记
    expect(decoded.isGuest).toBeUndefined()
    expect(decoded.trialExp).toBeUndefined()
  })

  it('访客模式内嵌 isGuest:true 与 trialExp', () => {
    const iso = '2026-12-31T23:59:59.000Z'
    const token = tokens.signAccessToken('guest-1', true, iso)
    const decoded = jwt.verify(token, TEST_SECRET)
    expect(decoded.userId).toBe('guest-1')
    expect(decoded.isGuest).toBe(true)
    expect(decoded.trialExp).toBe(iso)
  })

  it('访客但未传 trialExp 时不内嵌该字段', () => {
    const token = tokens.signAccessToken('guest-2', true)
    const decoded = jwt.verify(token, TEST_SECRET)
    expect(decoded.isGuest).toBe(true)
    expect(decoded.trialExp).toBeUndefined()
  })

  it('包含有效的过期时间（iat/exp）', () => {
    const token = tokens.signAccessToken('user-456')
    const decoded = jwt.verify(token, TEST_SECRET)
    expect(typeof decoded.iat).toBe('number')
    expect(typeof decoded.exp).toBe('number')
    // 30m = 1800s
    expect(decoded.exp - decoded.iat).toBe(30 * 60)
  })
})

describe('access token 校验', () => {
  it('无效 token 校验失败', () => {
    expect(() => jwt.verify('not-a-valid-token', TEST_SECRET)).toThrow()
    // 用错误密钥也应失败
    const token = tokens.signAccessToken('user-1')
    expect(() => jwt.verify(token, 'wrong-secret')).toThrow()
  })

  it('过期 token 校验失败', () => {
    // 直接用 jsonwebtoken 签发一个已过期的同结构 token 模拟过期
    const expired = jwt.sign({ userId: 'u' }, TEST_SECRET, { expiresIn: '-1s' })
    expect(() => jwt.verify(expired, TEST_SECRET)).toThrow()
  })
})

describe('signRefreshToken', () => {
  it('返回足够长的随机十六进制字符串', () => {
    const t = tokens.signRefreshToken()
    // 48 字节 → 96 个 hex 字符
    expect(t).toMatch(/^[0-9a-f]+$/)
    expect(t.length).toBe(96)
  })

  it('两次生成的 token 不同（随机性）', () => {
    const a = tokens.signRefreshToken()
    const b = tokens.signRefreshToken()
    expect(a).not.toBe(b)
  })
})

describe('hashToken', () => {
  it('对相同输入产出相同哈希（确定性）', () => {
    const t = 'abc-123'
    expect(tokens.hashToken(t)).toBe(tokens.hashToken(t))
  })

  it('哈希不等于原 token', () => {
    const t = 'plaintext-refresh-token'
    expect(tokens.hashToken(t)).not.toBe(t)
  })

  it('不同输入产出不同哈希', () => {
    expect(tokens.hashToken('a')).not.toBe(tokens.hashToken('b'))
  })

  it('输出为 64 位十六进制（SHA-256）', () => {
    expect(tokens.hashToken('x')).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('cookie 配置常量', () => {
  it('导出正确的 cookie 名称', () => {
    expect(tokens.ACCESS_COOKIE).toBe('lf_access_token')
    expect(tokens.REFRESH_COOKIE).toBe('lf_refresh_token')
    expect(tokens.DEVICE_COOKIE).toBe('lf_device_id')
  })

  it('ACCESS_MAX_AGE（30m）与 REFRESH_MAX_AGE（7d）符合 config 配置', () => {
    const min = 60 * 1000
    const day = 24 * 60 * 60 * 1000
    // access token 自身有效期 30 分钟
    expect(tokens.ACCESS_MAX_AGE).toBe(30 * min)
    // refresh 有效期 7 天
    expect(tokens.REFRESH_MAX_AGE).toBe(7 * day)
  })
})

describe('issueTokens cookie 下发', () => {
  let poolExecute
  beforeEach(() => {
    // 替换共享 pool.execute（与 tokens.js 持有同一对象引用）
    poolExecute = vi.fn().mockResolvedValue([{}])
    db.execute = poolExecute
  })

  it('下发 access cookie（httpOnly、path=/api、maxAge 对齐 refresh）', async () => {
    const res = { cookie: vi.fn(), clearCookie: vi.fn() }
    await tokens.issueTokens(res, 1, false, {})

    const accessCall = res.cookie.mock.calls.find(([name]) => name === tokens.ACCESS_COOKIE)
    expect(accessCall).toBeTruthy()
    const [, accessToken, opts] = accessCall
    // 内容是可被 jsonwebtoken 校验的真实 token
    expect(() => jwt.verify(accessToken, TEST_SECRET)).not.toThrow()
    expect(opts.httpOnly).toBe(true)
    expect(opts.path).toBe('/api')
    expect(opts.sameSite).toBe('lax')
    // access cookie 寿命对齐 refresh（7d），而非 access token 的 30m
    expect(opts.maxAge).toBe(tokens.REFRESH_MAX_AGE)
  })

  it('下发 refresh cookie（path=/api/auth，覆盖 refresh 与 logout）', async () => {
    const res = { cookie: vi.fn(), clearCookie: vi.fn() }
    await tokens.issueTokens(res, 1, false, {})

    const refreshCall = res.cookie.mock.calls.find(([name]) => name === tokens.REFRESH_COOKIE)
    expect(refreshCall).toBeTruthy()
    const [, refreshToken, opts] = refreshCall
    expect(refreshToken).toMatch(/^[0-9a-f]{96}$/)
    expect(opts.httpOnly).toBe(true)
    expect(opts.path).toBe('/api/auth')
    expect(opts.sameSite).toBe('lax')
    expect(opts.maxAge).toBe(tokens.REFRESH_MAX_AGE)
    // 发新 cookie 时清掉旧版本的窄 path，避免 /refresh 收到两个同名值。
    expect(res.clearCookie).toHaveBeenCalledWith(
      tokens.REFRESH_COOKIE,
      expect.objectContaining({ path: '/api/auth/refresh' })
    )
  })

  it('将 refresh token 的 SHA-256 哈希写入数据库', async () => {
    const res = { cookie: vi.fn(), clearCookie: vi.fn() }
    await tokens.issueTokens(res, 1, false, { deviceId: 'dev-1' })

    expect(poolExecute).toHaveBeenCalledTimes(1)
    const sql = poolExecute.mock.calls[0][0]
    const params = poolExecute.mock.calls[0][1]
    expect(sql).toContain('INSERT INTO refresh_tokens')
    // params[0]=userId, params[1]=tokenHash, params[2]=expiresAt, params[3]=deviceId
    expect(params[0]).toBe(1)
    expect(params[1]).toMatch(/^[0-9a-f]{64}$/)
    // 下发的 refresh cookie 是明文，入库的是其哈希，两者应不同但哈希一致
    const refreshCall = res.cookie.mock.calls.find(([name]) => name === tokens.REFRESH_COOKIE)
    expect(tokens.hashToken(refreshCall[1])).toBe(params[1])
    expect(params[3]).toBe('dev-1')
  })
})

describe('clearCookies', () => {
  it('同时清理当前与旧版 refresh path，确保登出不会残留会话 cookie', () => {
    const res = { clearCookie: vi.fn() }
    tokens.clearCookies(res)

    expect(res.clearCookie).toHaveBeenCalledWith(
      tokens.ACCESS_COOKIE,
      expect.objectContaining({ path: '/api' })
    )
    expect(res.clearCookie).toHaveBeenCalledWith(
      tokens.REFRESH_COOKIE,
      expect.objectContaining({ path: '/api/auth' })
    )
    expect(res.clearCookie).toHaveBeenCalledWith(
      tokens.REFRESH_COOKIE,
      expect.objectContaining({ path: '/api/auth/refresh' })
    )
  })
})

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

describe('resolveDeviceId 优先级', () => {
  it('合法 cookie 优先，body 与自动生成均不参与', () => {
    const req = {
      cookies: { lf_device_id: 'from-cookie' },
      body: { deviceId: 'from-body' },
    }
    expect(tokens.resolveDeviceId(req)).toBe('from-cookie')
  })

  it('无 cookie 时不再信任 body.deviceId（可伪造绕过每设备一次试用），现场生成 UUID', () => {
    const req = { cookies: {}, body: { deviceId: 'from-body' } }
    const id = tokens.resolveDeviceId(req)
    expect(id).toMatch(UUID_RE)
    expect(id).not.toBe('from-body')
  })

  it('cookie 与 body 都缺失时自动生成（UUID 形态）', () => {
    const req = { cookies: {}, body: {} }
    const id = tokens.resolveDeviceId(req)
    expect(id).toMatch(UUID_RE)
    // 多次调用产出不同 id（随机性）
    expect(tokens.resolveDeviceId({ cookies: {}, body: {} })).not.toBe(id)
  })

  it('cookie 为空白字符串时自动生成 UUID（不再回退 body）', () => {
    const req = { cookies: { lf_device_id: '   ' }, body: { deviceId: 'from-body' } }
    const id = tokens.resolveDeviceId(req)
    expect(id).toMatch(UUID_RE)
    expect(id).not.toBe('from-body')
  })

  it('cookie 超过 64 字符（DB 列 VARCHAR(64) 上限）→ 重新生成 UUID，避免超长入库 500', () => {
    const req = { cookies: { lf_device_id: 'x'.repeat(100) }, body: {} }
    const id = tokens.resolveDeviceId(req)
    expect(id).toMatch(UUID_RE)
    expect(id.length).toBeLessThanOrEqual(64)
  })

  it('body.deviceId 为任意非字符串类型（对象等）均被忽略', () => {
    const id = tokens.resolveDeviceId({ cookies: {}, body: { deviceId: { evil: true } } })
    expect(id).toMatch(UUID_RE)
  })
})

describe('ensureDeviceCookie', () => {
  it('cookie 已存在时不重新下发，返回已有值', () => {
    const res = { cookie: vi.fn() }
    const req = { cookies: { lf_device_id: 'existing' } }
    const id = tokens.ensureDeviceCookie(req, res, 'new-id')
    expect(id).toBe('existing')
    expect(res.cookie).not.toHaveBeenCalled()
  })

  it('cookie 缺失时 Set-Cookie 并返回入参 id', () => {
    const res = { cookie: vi.fn() }
    const req = { cookies: {} }
    const id = tokens.ensureDeviceCookie(req, res, 'fresh-id')
    expect(id).toBe('fresh-id')
    expect(res.cookie).toHaveBeenCalledTimes(1)
    const [name, value, opts] = res.cookie.mock.calls[0]
    expect(name).toBe(tokens.DEVICE_COOKIE)
    expect(value).toBe('fresh-id')
    expect(opts.httpOnly).toBe(true)
    expect(opts.path).toBe('/')
    expect(opts.sameSite).toBe('lax')
    // 1 年
    expect(opts.maxAge).toBe(365 * 24 * 60 * 60 * 1000)
  })

  it('cookie 值不合法（超长 >64）时不复用，重签 cookie 并返回入参 id', () => {
    const res = { cookie: vi.fn() }
    const req = { cookies: { lf_device_id: 'x'.repeat(100) } }
    const id = tokens.ensureDeviceCookie(req, res, 'fresh-id')
    expect(id).toBe('fresh-id')
    expect(res.cookie).toHaveBeenCalledTimes(1)
    expect(res.cookie.mock.calls[0][1]).toBe('fresh-id')
  })

  it('cookie 值为空白字符串时视为缺失，重签 cookie', () => {
    const res = { cookie: vi.fn() }
    const req = { cookies: { lf_device_id: '   ' } }
    const id = tokens.ensureDeviceCookie(req, res, 'fresh-id')
    expect(id).toBe('fresh-id')
    expect(res.cookie).toHaveBeenCalledTimes(1)
  })
})
