// @vitest-environment jsdom
// useStudyTracker 的时长统计回归测试。
//
// 回归背景：flush() 调用 pause() 后 sessionStart 被清空但无人重启计时，
// 30s 周期定时器在首轮 flush 之后全部空转，一个持续可见的会话只被记 30 秒。
// 此文件锁定「持续可见的会话按完整时长入账」与 visibility 感知语义。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const { addReadingSeconds } = vi.hoisted(() => ({ addReadingSeconds: vi.fn() }))
vi.mock('./useReadingStore', () => ({
  useReadingStore: () => ({ addReadingSeconds }),
}))

import useStudyTracker from './useStudyTracker'

// jsdom 的 visibilityState/hidden 是原型 getter，用自有属性覆盖后派发事件驱动 hook。
// hook 的处理器读 document.hidden，flush 的重启判断读 visibilityState，两者都要覆盖。
function setVisibility(state) {
  Object.defineProperty(document, 'hidden', { value: state === 'hidden', configurable: true })
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

function totalRecorded() {
  return addReadingSeconds.mock.calls.flat().reduce((a, b) => a + b, 0)
}

beforeEach(() => {
  vi.useFakeTimers()
  addReadingSeconds.mockClear()
  setVisibility('visible')
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('useStudyTracker', () => {
  it('持续可见的会话：每 30s flush 后继续计时（回归：修复前只记首个 30s）', async () => {
    const { unmount } = renderHook(() => useStudyTracker('article-1'))
    await vi.advanceTimersByTimeAsync(90 * 1000)
    // 定时器在挂载时起跳，30/60/90s 各触发一次 flush，且每次都重启了计时
    expect(addReadingSeconds.mock.calls).toEqual([[30], [30], [30]])
    unmount()
  })

  it('卸载时把不足一个周期的剩余时长入账', async () => {
    const { unmount } = renderHook(() => useStudyTracker('article-1'))
    await vi.advanceTimersByTimeAsync(45 * 1000) // t=30 已 flush 30s，剩 15s
    expect(addReadingSeconds).toHaveBeenCalledTimes(1)
    unmount()
    expect(addReadingSeconds.mock.calls).toEqual([[30], [15]])
  })

  it('后台标签页不计时，回到前台后恢复（总时长与实际可见时长一致）', async () => {
    const { unmount } = renderHook(() => useStudyTracker('article-1'))
    await vi.advanceTimersByTimeAsync(10 * 1000)
    setVisibility('hidden') // flush 10s，此后不再累计
    await vi.advanceTimersByTimeAsync(120 * 1000)
    expect(addReadingSeconds.mock.calls).toEqual([[10]])

    setVisibility('visible')
    await vi.advanceTimersByTimeAsync(65 * 1000)
    unmount()
    // 回归点：恢复可见后计时必须继续，总量 = 10s（前台第一段）+ 65s（前台第二段）
    expect(totalRecorded()).toBe(10 + 65)
  })

  it('sessionKey 为空时不计时', async () => {
    const { unmount } = renderHook(() => useStudyTracker(null))
    await vi.advanceTimersByTimeAsync(120 * 1000)
    expect(addReadingSeconds).not.toHaveBeenCalled()
    unmount()
  })
})
