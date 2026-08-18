// @vitest-environment jsdom
// useReadingStore 订阅广播与阅读进度防回退测试。
//
// 回归背景：
// 1) 时长累计改为节流落盘时把 listeners 广播也一并移除，实时显示时长的组件数值会冻结；
// 2) 老数据形态（有 readProgress 无 lastReadAt）重访时会被较低进度覆盖。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const KEY = 'lingoforge_reading'

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

beforeEach(() => {
  localStorage.clear()
  vi.resetModules()
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('时长累计 · 广播与节流', () => {
  it('addReadingSeconds 后订阅组件的重渲染快照包含新值（回归：修复前数值冻结）', async () => {
    const mod = await import('./useReadingStore')
    const { result } = renderHook(() => mod.useReadingStore())
    expect(result.current.dailyReadingSeconds[todayKey()]).toBeUndefined()

    act(() => {
      mod.getReadingStoreActions().addReadingSeconds(30)
    })

    // 断言渲染快照而非 getter：getter 读实时缓存，无法捕获"忘记广播"的回归
    expect(result.current.dailyReadingSeconds[todayKey()]).toBe(30)
    expect(result.current.getTotalReadingSeconds()).toBe(30)
  })

  it('广播即时，落盘仍按 30s 节流', async () => {
    vi.useFakeTimers()
    const mod = await import('./useReadingStore')
    const { result } = renderHook(() => mod.useReadingStore())

    act(() => {
      mod.getReadingStoreActions().addTypingSeconds(45)
    })
    expect(result.current.dailyTypingSeconds[todayKey()]).toBe(45) // 已广播
    expect(localStorage.getItem(KEY)).toBeNull() // 尚未落盘（节流中）

    act(() => {
      vi.advanceTimersByTime(30 * 1000)
    })
    const persisted = JSON.parse(localStorage.getItem(KEY))
    expect(persisted.dailyTypingSeconds[todayKey()]).toBe(45) // 节流窗口到点落盘
  })

  it('非法输入（0/负数/NaN）被忽略', async () => {
    const mod = await import('./useReadingStore')
    const { result } = renderHook(() => mod.useReadingStore())
    act(() => {
      const actions = mod.getReadingStoreActions()
      actions.addListeningSeconds(0)
      actions.addListeningSeconds(-5)
      actions.addListeningSeconds(NaN)
    })
    expect(result.current.getTotalListeningSeconds()).toBe(0)
  })
})

describe('setProgress · 进度只增不减', () => {
  function seedLegacy() {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        readProgress: { a1: 80 },
        lastReadAt: {}, // 老数据形态：有进度、无阅读时间戳
        bookmarks: [],
        dailyReadingSeconds: {},
        dailyTypingSeconds: {},
        dailyListeningSeconds: {},
        filters: {},
      })
    )
  }

  it('老数据缺 lastReadAt 时，较低进度不覆盖较高进度（回归）', async () => {
    seedLegacy()
    const mod = await import('./useReadingStore')
    const { result } = renderHook(() => mod.useReadingStore())

    act(() => result.current.setProgress('a1', 50))
    expect(result.current.readProgress.a1).toBe(80) // 不回退

    act(() => result.current.setProgress('a1', 90))
    expect(result.current.readProgress.a1).toBe(90) // 变高才更新
  })

  it('首次阅读允许任意进度', async () => {
    const mod = await import('./useReadingStore')
    const { result } = renderHook(() => mod.useReadingStore())
    act(() => result.current.setProgress('b1', 10))
    expect(result.current.readProgress.b1).toBe(10)
  })
})
