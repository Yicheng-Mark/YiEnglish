// 过期访客清理测试：mock db（require.cache 注入），验证 SQL 语义与返回值。
import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockExecute = vi.fn()
injectCache('../db', { execute: mockExecute })
injectCache('./logger', { info: vi.fn() })

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

const { cleanupExpiredGuests, RETAIN_DAYS } = require('./cleanupGuests')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('cleanupExpiredGuests', () => {
  it('只删 is_guest=1 且试用到期超 30 天的账号', async () => {
    mockExecute.mockResolvedValue([{ affectedRows: 3 }, []])
    const removed = await cleanupExpiredGuests()
    expect(removed).toBe(3)
    const [sql] = mockExecute.mock.calls[0]
    expect(String(sql)).toMatch(/is_guest = 1/)
    expect(String(sql)).toMatch(new RegExp(`INTERVAL ${RETAIN_DAYS} DAY`))
    // 子查询基于 trial_activations.expires_at（权威到期源）
    expect(String(sql)).toMatch(/FROM trial_activations/)
  })

  it('无待清理行 → affectedRows 0，正常返回', async () => {
    mockExecute.mockResolvedValue([{ affectedRows: 0 }, []])
    await expect(cleanupExpiredGuests()).resolves.toBe(0)
  })
})
