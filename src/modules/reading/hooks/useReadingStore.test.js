// @vitest-environment jsdom
// useReadingStore 订阅广播与阅读进度防回退测试。
//
// 回归背景：
// 1) 时长累计改为节流落盘时把 listeners 广播也一并移除，实时显示时长的组件数值会冻结；
// 2) 老数据形态（有 readProgress 无 lastReadAt）重访时会被较低进度覆盖。
// 3) 时长用例的 day key 必须只取一次并在写入/断言两侧共用：旧写法在 advance 30s
//    后重新取 todayKey()，套件起跑在本地午夜前 30s 内时 key 翻转，曾致全量偶发
//    「expected undefined to be 45」（满载全量耗时长，撞上午夜窗口的概率放大）。
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
    const dayKey = todayKey() // 只取一次，写入与断言共用
    expect(result.current.dailyReadingSeconds[dayKey]).toBeUndefined()

    act(() => {
      mod.getReadingStoreActions().addReadingSeconds(30)
    })

    // 断言渲染快照而非 getter：getter 读实时缓存，无法捕获"忘记广播"的回归
    expect(result.current.dailyReadingSeconds[dayKey]).toBe(30)
    expect(result.current.getTotalReadingSeconds()).toBe(30)

    // 收尾清理：addReadingSeconds 在模块内部排了一个真实 30s 节流落盘定时器，
    // 测试侧无法从外部取消；补一次 setProgress（persist 会 clearTimeout）把它
    // 冲掉，避免本文件跑完后残留的真实定时器在环境拆除后仍触发写 localStorage
    act(() => {
      result.current.setProgress('cleanup-only', 1)
    })
  })

  it('广播即时，落盘仍按 30s 节流', async () => {
    vi.useFakeTimers()
    // 时钟钉在正午安全点，advance 30s 不跨天；day key 只取一次
    vi.setSystemTime(new Date('2026-09-18T12:00:00'))
    const dayKey = todayKey()
    const mod = await import('./useReadingStore')
    const { result } = renderHook(() => mod.useReadingStore())

    act(() => {
      mod.getReadingStoreActions().addTypingSeconds(45)
    })
    expect(result.current.dailyTypingSeconds[dayKey]).toBe(45) // 已广播
    expect(localStorage.getItem(KEY)).toBeNull() // 尚未落盘（节流中）

    act(() => {
      vi.advanceTimersByTime(30 * 1000)
    })
    const persisted = JSON.parse(localStorage.getItem(KEY))
    expect(persisted.dailyTypingSeconds[dayKey]).toBe(45) // 节流窗口到点落盘
  })

  it('跨午夜的 30s 节流窗口：落盘 key 与断言 key 一致（回归：偶发 expected undefined to be 45）', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-17T23:59:50')) // 30s 窗口必然跨天
    const dayKey = todayKey() // 09-17，与 addTypingSeconds 落键同一时刻
    const mod = await import('./useReadingStore')
    const { result } = renderHook(() => mod.useReadingStore())

    act(() => {
      mod.getReadingStoreActions().addTypingSeconds(45)
    })
    expect(result.current.dailyTypingSeconds[dayKey]).toBe(45)

    act(() => {
      vi.advanceTimersByTime(30 * 1000) // 时钟翻到 09-18 00:00:20
    })
    const persisted = JSON.parse(localStorage.getItem(KEY))
    // 落盘 JSON 记的是写入时刻的 09-17 key；断言用同一 key，不受跨天翻转影响
    expect(persisted.dailyTypingSeconds[dayKey]).toBe(45)
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
