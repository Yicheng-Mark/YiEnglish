// DB 限流（login/register 维度）单元测试：checkLoginRateLimit / checkRegisterRateLimit /
// logAttempt / cleanupStaleAttempts。db、config 注入 fake（require.cache 方式）。

import { describe, it, expect, beforeEach, vi } from 'vitest'

const FIXED_CONFIG = {
  LOGIN_RATE_LIMIT_MAX: 5,
  REGISTER_RATE_LIMIT_MAX: 3,
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
injectCache('../config', FIXED_CONFIG)

const {
  checkLoginRateLimit,
  checkRegisterRateLimit,
  logAttempt,
  cleanupStaleAttempts,
} = require('./rateLimit')

// execute 按 SQL 形状/参数分发：login 用户名维度 / login IP 维度 / register 维度
// （register 的标识只出现在绑定参数 `register:<ip>` 中，SQL 字符串不含它）
function setCounts({ loginUsername = 0, loginIp = 0, register = 0 } = {}) {
  mockExecute.mockImplementation(async (sql, params) => {
    const s = String(sql)
    if (s.includes('ip_address')) return [[{ cnt: loginIp }], []]
    if (Array.isArray(params) && String(params[0]).startsWith('register:')) {
      return [[{ cnt: register }], []]
    }
    return [[{ cnt: loginUsername }], []]
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockExecute.mockResolvedValue([[{ cnt: 0 }], []])
})

describe('checkLoginRateLimit', () => {
  it('用户名维度失败次数达上限 → 抛 429', async () => {
    setCounts({ loginUsername: 5 })
    await expect(checkLoginRateLimit('alice', '1.1.1.1')).rejects.toMatchObject({ status: 429 })
  })

  it('IP 维度失败次数达 4 倍上限 → 抛 429', async () => {
    setCounts({ loginUsername: 0, loginIp: 20 })
    await expect(checkLoginRateLimit('alice', '1.1.1.1')).rejects.toMatchObject({ status: 429 })
  })

  it('均低于阈值 → 正常放行（两次查询）', async () => {
    setCounts({ loginUsername: 4, loginIp: 19 })
    await expect(checkLoginRateLimit('alice', '1.1.1.1')).resolves.toBeUndefined()
    expect(mockExecute).toHaveBeenCalledTimes(2)
  })
})

describe('checkRegisterRateLimit', () => {
  it('注册维度达上限 → 抛 429', async () => {
    setCounts({ register: 3 })
    await expect(checkRegisterRateLimit('1.1.1.1')).rejects.toMatchObject({ status: 429 })
  })

  it('低于阈值 → 放行', async () => {
    setCounts({ register: 2 })
    await expect(checkRegisterRateLimit('1.1.1.1')).resolves.toBeUndefined()
  })
})

describe('logAttempt', () => {
  it('success=true 写 1，success=false 写 0', async () => {
    await logAttempt('demo_redeem:1.1.1.1', '1.1.1.1', true)
    expect(mockExecute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO login_attempts'),
      ['demo_redeem:1.1.1.1', '1.1.1.1', 1]
    )
    await logAttempt('login:alice', '1.1.1.1', false)
    expect(mockExecute).toHaveBeenLastCalledWith(
      expect.stringContaining('INSERT INTO login_attempts'),
      ['login:alice', '1.1.1.1', 0]
    )
  })

  it('写入失败不阻塞主流程（静默吞错）', async () => {
    mockExecute.mockRejectedValue(new Error('db down'))
    await expect(logAttempt('x', '1.1.1.1', false)).resolves.toBeUndefined()
  })
})

describe('cleanupStaleAttempts', () => {
  it('执行 24h 清理且失败静默', async () => {
    await cleanupStaleAttempts()
    expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM login_attempts'))
    mockExecute.mockRejectedValue(new Error('db down'))
    await expect(cleanupStaleAttempts()).resolves.toBeUndefined()
  })
})
