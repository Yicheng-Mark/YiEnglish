// 过期访客清理测试：mock db（require.cache 注入），验证 SQL 语义、IP 计数归档与事务行为。
import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockExecute = vi.fn()
const mockConnectionExecute = vi.fn()
const mockConnection = {
  beginTransaction: vi.fn().mockResolvedValue(),
  commit: vi.fn().mockResolvedValue(),
  rollback: vi.fn().mockResolvedValue(),
  release: vi.fn(),
  execute: mockConnectionExecute,
}
const mockGetConnection = vi.fn().mockResolvedValue(mockConnection)
injectCache('../db', { execute: mockExecute, getConnection: mockGetConnection })
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
  it('删除前先归档待删行的 IP 计数，且归档/删除同一事务内执行', async () => {
    mockConnectionExecute.mockResolvedValue([{ affectedRows: 3 }, []])

    const removed = await cleanupExpiredGuests()

    expect(removed).toBe(3)
    // 两步 SQL 都走事务连接（归档与删除原子，删除失败一并回滚，下轮不重复累加）
    expect(mockExecute).not.toHaveBeenCalled()
    expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1)
    expect(mockConnection.commit).toHaveBeenCalledTimes(1)

    const executedSql = mockConnectionExecute.mock.calls.map(([sql]) => String(sql))
    // 第一步：归档——按 ip 分组 UPSERT 累加进 trial_ip_totals，ip 为 NULL 的行排除
    const archiveSql = executedSql.find((s) => s.includes('INSERT INTO trial_ip_totals'))
    expect(archiveSql).toBeDefined()
    expect(archiveSql).toMatch(/WHERE ip IS NOT NULL/)
    expect(archiveSql).toMatch(/ON DUPLICATE KEY UPDATE total = total \+ VALUES\(total\)/)
    expect(archiveSql).toMatch(/GROUP BY ip/)
    expect(archiveSql).toMatch(new RegExp(`INTERVAL ${RETAIN_DAYS} DAY`))

    // 第二步：删除——只删 is_guest=1 且试用到期超 30 天的账号
    const deleteSql = executedSql.find((s) => s.startsWith('DELETE FROM users'))
    expect(deleteSql).toMatch(/is_guest = 1/)
    expect(deleteSql).toMatch(/FROM trial_activations/)
    expect(deleteSql).toMatch(new RegExp(`INTERVAL ${RETAIN_DAYS} DAY`))
  })

  it('无待清理行 → affectedRows 0，归档 UPSERT 仍执行（幂等空集）', async () => {
    mockConnectionExecute.mockResolvedValue([{ affectedRows: 0 }, []])
    await expect(cleanupExpiredGuests()).resolves.toBe(0)
    expect(
      mockConnectionExecute.mock.calls.some(([sql]) => String(sql).includes('trial_ip_totals'))
    ).toBe(true)
  })

  it('归档或删除失败 → 回滚并抛出（不留半成品，下轮重试不会重复计数）', async () => {
    mockConnectionExecute.mockRejectedValueOnce(new Error('db down'))
    await expect(cleanupExpiredGuests()).rejects.toThrow('db down')
    expect(mockConnection.rollback).toHaveBeenCalledTimes(1)
    expect(mockConnection.commit).not.toHaveBeenCalled()
    expect(mockConnection.release).toHaveBeenCalledTimes(1)
  })
})
