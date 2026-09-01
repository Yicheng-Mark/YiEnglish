// @vitest-environment jsdom
// useDebounce：值变化后延迟更新、延迟窗口内多次变更只生效最后一次、卸载取消。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDebounce } from './useDebounce.js'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useDebounce', () => {
  it('初始返回当前值，延迟到达后更新', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 300), {
      initialProps: { v: 'a' },
    })
    expect(result.current).toBe('a')
    rerender({ v: 'b' })
    expect(result.current).toBe('a') // 窗口内仍是旧值
    act(() => vi.advanceTimersByTime(300))
    expect(result.current).toBe('b')
  })

  it('窗口内连续变更 → 只有最后一次生效', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 300), {
      initialProps: { v: 'a' },
    })
    rerender({ v: 'b' })
    act(() => vi.advanceTimersByTime(200))
    rerender({ v: 'c' }) // 重置计时
    act(() => vi.advanceTimersByTime(200))
    expect(result.current).toBe('a') // 距最后一次变更仅 200ms
    act(() => vi.advanceTimersByTime(100))
    expect(result.current).toBe('c')
  })

  it('卸载 → 取消挂起的更新', () => {
    const { result, rerender, unmount } = renderHook(({ v }) => useDebounce(v, 300), {
      initialProps: { v: 'a' },
    })
    rerender({ v: 'b' })
    unmount()
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current).toBe('a')
  })
})
