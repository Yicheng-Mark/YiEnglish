// @vitest-environment jsdom
// useErrorTracking 错键明细合批回归：连续错键不再逐键开 IDB 事务，
// 缓冲 2s 后单次 idbBulkPut；getRecentErrors 在落盘前也能读到缓冲行。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  idbBulkPut: vi.fn().mockResolvedValue(),
  idbGetAll: vi.fn().mockResolvedValue([]),
  idbDelete: vi.fn().mockResolvedValue(),
}))
vi.mock('../utils/idb', () => mocks)

import useErrorTracking from './useErrorTracking.js'

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  mocks.idbGetAll.mockResolvedValue([])
})

afterEach(() => {
  // 冲掉模块级缓冲，避免上一用例的待写行泄漏到下一用例
  act(() => {
    vi.advanceTimersByTime(2100)
  })
  vi.useRealTimers()
})

function wrongKey(hook, word, expected, typed, letterIndex) {
  act(() => {
    hook.current.onError({ name: word }, expected, typed, letterIndex)
  })
}

describe('错键明细合批落盘', () => {
  it('连续 3 个错键只触发一次批量写入，且落盘前不写 IDB', async () => {
    const { result } = renderHook(() => useErrorTracking())
    wrongKey(result, 'apple', 'a', 's', 0)
    wrongKey(result, 'apple', 'p', 'o', 1)
    wrongKey(result, 'banana', 'b', 'v', 0)

    // 缓冲期内零 IDB 事务（回归点：旧实现逐键 idbPut）
    expect(mocks.idbBulkPut).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(2100)
    })
    expect(mocks.idbBulkPut).toHaveBeenCalledTimes(1)
    const [store, batch] = mocks.idbBulkPut.mock.calls[0]
    expect(store).toBe('errorDetails')
    expect(batch).toHaveLength(3)
    expect(batch[0]).toMatchObject({ word: 'apple', expected: 'a', typed: 's' })
  })

  it('getRecentErrors 在批量落盘前也能读到缓冲中的错键', async () => {
    const { result } = renderHook(() => useErrorTracking())
    wrongKey(result, 'apple', 'a', 's', 0)
    const recent = await result.current.getRecentErrors(30)
    expect(recent).toHaveLength(1)
    expect(recent[0].word).toBe('apple')
    expect(mocks.idbBulkPut).not.toHaveBeenCalled()
  })

  it('expected/typed 非字符串直接跳过，不入缓冲', async () => {
    const { result } = renderHook(() => useErrorTracking())
    act(() => {
      result.current.onError({ name: 'apple' }, undefined, 'a', 0)
    })
    const recent = await result.current.getRecentErrors(30)
    expect(recent).toHaveLength(0)
    await act(async () => {
      vi.advanceTimersByTime(2100)
    })
    expect(mocks.idbBulkPut).not.toHaveBeenCalled()
  })
})
