// @vitest-environment jsdom
// useScrollingFlag 契约测试：滚动期间 body[data-scrolling] 置位、停滚 120ms 后移除、
// 连续滚动重置定时器、卸载清理监听/定时器/属性。
// fake timers 需覆盖 requestAnimationFrame（滚动置位走 rAF 合帧）。
import { describe, it, expect, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useScrollingFlag } from './useScrollingFlag.js'

const scrolling = () => document.body.getAttribute('data-scrolling')

function scroll() {
  window.dispatchEvent(new Event('scroll'))
}

// 触发一次 rAF 合帧（onScroll 中 requestAnimationFrame 的回调）
function nextFrame() {
  return vi.advanceTimersByTimeAsync(16)
}

afterEach(() => {
  vi.useRealTimers()
  document.body.removeAttribute('data-scrolling')
})

describe('useScrollingFlag', () => {
  it('滚动后 body 得 data-scrolling，停 120ms 后移除', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame'] })
    renderHook(() => useScrollingFlag())

    expect(scrolling()).toBeNull()
    scroll()
    await nextFrame()
    expect(scrolling()).toBe('true')

    await vi.advanceTimersByTimeAsync(120)
    expect(scrolling()).toBeNull()
  })

  it('连续滚动重置定时器：停滚前 120ms 内再滚不会提前移除标记', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame'] })
    renderHook(() => useScrollingFlag())

    scroll()
    await nextFrame()
    expect(scrolling()).toBe('true')

    // 第一轮置位 100ms 后再次滚动（新一轮 rAF 重置 120ms 定时器）
    await vi.advanceTimersByTimeAsync(100)
    scroll()
    await nextFrame()
    await vi.advanceTimersByTimeAsync(100)
    // 距第一次滚动已 200ms：若无重置逻辑标记早已被移除
    expect(scrolling()).toBe('true')

    await vi.advanceTimersByTimeAsync(50)
    expect(scrolling()).toBeNull()
  })

  it('卸载清理：移除监听、清定时器、移除 body 属性', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame'] })
    const { unmount } = renderHook(() => useScrollingFlag())

    scroll()
    await nextFrame()
    expect(scrolling()).toBe('true')

    unmount()
    expect(scrolling()).toBeNull()

    // 卸载后再滚动不应重新置位（监听已移除）
    scroll()
    await nextFrame()
    await vi.advanceTimersByTimeAsync(200)
    expect(scrolling()).toBeNull()
  })
})
