// @vitest-environment jsdom
// useTypingGestures（移动端触摸手势）测试：横向滑动切词（边界钳制）、
// tap 唤醒键盘并聚焦隐藏输入、滑动后 350ms 内抑制 click、isFinished/非移动端熔断。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ saveLocalProgress: vi.fn() }))
vi.mock('../utils/localProgress.js', () => ({ saveLocalProgress: mocks.saveLocalProgress }))

import useTypingGestures from './useTypingGestures.js'

function renderGestures(overrides = {}) {
  const input = document.createElement('input')
  const focusSpy = vi.spyOn(input, 'focus')
  const hiddenInputRef = { current: input }
  const props = {
    isMobile: true,
    isFinished: false,
    wordIndex: 1,
    wordsLength: 3,
    jumpTo: vi.fn(),
    keyboardActive: false,
    setKeyboardActive: vi.fn(),
    currentWord: { name: 'cat' },
    dictId: 'cet4',
    chapterId: 2,
    hiddenInputRef,
    ...overrides,
  }
  const result = renderHook((p) => useTypingGestures(p), { initialProps: props })
  return { ...result, props, focusSpy }
}

function touchEvent(x, y, startX = 0, startY = 0) {
  return {
    touches: [{ clientX: x, clientY: y }],
    changedTouches: [{ clientX: x, clientY: y }],
    _start: { clientX: startX, clientY: startY },
  }
}

// 驱动一次 start → end 手势
function swipe(h, endX, endY, startX, startY) {
  act(() => h.result.current.handleTouchStart({ touches: [{ clientX: startX, clientY: startY }] }))
  act(() => h.result.current.handleTouchEnd(touchEvent(endX, endY)))
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('handleTouchStart', () => {
  it('记录触摸起点', () => {
    const h = renderGestures()
    act(() => h.result.current.handleTouchStart({ touches: [{ clientX: 10, clientY: 20 }] }))
    expect(h.result.current.touchStartRef.current).toMatchObject({ x: 10, y: 20 })
  })

  it('isFinished → 不记录', () => {
    const h = renderGestures({ isFinished: true })
    act(() => h.result.current.handleTouchStart({ touches: [{ clientX: 10, clientY: 20 }] }))
    expect(h.result.current.touchStartRef.current).toBeNull()
  })
})

describe('横向滑动切词', () => {
  it('右滑（dx>50 且横向主导）→ jumpTo(index-1)，350ms 内抑制 click', () => {
    const h = renderGestures({ wordIndex: 1 })
    swipe(h, 120, 5, 0, 0)
    expect(h.props.jumpTo).toHaveBeenCalledWith(0)
    expect(h.result.current.suppressClickRef.current).toBe(true)
    act(() => vi.advanceTimersByTime(350))
    expect(h.result.current.suppressClickRef.current).toBe(false)
  })

  it('首个词右滑 → 不越界', () => {
    const h = renderGestures({ wordIndex: 0 })
    swipe(h, 120, 5, 0, 0)
    expect(h.props.jumpTo).not.toHaveBeenCalled()
  })

  it('左滑 → 保存当前词进度并 jumpTo(index+1)', () => {
    const h = renderGestures({ wordIndex: 1 })
    swipe(h, 0, 5, 120, 0)
    expect(mocks.saveLocalProgress).toHaveBeenCalledWith('cet4', 2, ['cat'])
    expect(h.props.jumpTo).toHaveBeenCalledWith(2)
  })

  it('最后一个词左滑 → 不越界、不存进度', () => {
    const h = renderGestures({ wordIndex: 2, wordsLength: 3 })
    swipe(h, 0, 5, 120, 0)
    expect(h.props.jumpTo).not.toHaveBeenCalled()
    expect(mocks.saveLocalProgress).not.toHaveBeenCalled()
  })

  it('纵向位移更大 → 不视为横滑', () => {
    const h = renderGestures()
    swipe(h, 60, 200, 0, 0)
    expect(h.props.jumpTo).not.toHaveBeenCalled()
  })

  it('未达 50px 阈值 → 不切词', () => {
    const h = renderGestures()
    swipe(h, 30, 0, 0, 0)
    expect(h.props.jumpTo).not.toHaveBeenCalled()
  })
})

describe('tap 唤醒键盘', () => {
  it('键盘未激活时 tap → setKeyboardActive(true) 并聚焦隐藏输入', () => {
    const h = renderGestures()
    swipe(h, 5, 3, 0, 0) // 位移 < 10px
    expect(h.props.setKeyboardActive).toHaveBeenCalledWith(true)
    act(() => vi.advanceTimersByTime(0))
    expect(h.focusSpy).toHaveBeenCalledWith(expect.objectContaining({ preventScroll: true }))
  })

  it('键盘已激活时 tap → 不重复唤醒', () => {
    const h = renderGestures({ keyboardActive: true })
    swipe(h, 5, 3, 0, 0)
    expect(h.props.setKeyboardActive).not.toHaveBeenCalled()
    expect(h.focusSpy).not.toHaveBeenCalled()
  })
})

describe('熔断', () => {
  it('非移动端 → start/end 均 no-op', () => {
    const h = renderGestures({ isMobile: false })
    swipe(h, 120, 5, 0, 0)
    expect(h.props.jumpTo).not.toHaveBeenCalled()
    expect(h.props.setKeyboardActive).not.toHaveBeenCalled()
  })

  it('isFinished → end no-op', () => {
    const h = renderGestures({ isFinished: false })
    act(() => h.result.current.handleTouchStart({ touches: [{ clientX: 0, clientY: 0 }] }))
    h.rerender({ ...h.props, isFinished: true })
    act(() => h.result.current.handleTouchEnd(touchEvent(120, 5)))
    expect(h.props.jumpTo).not.toHaveBeenCalled()
  })

  it('无 start 记录 → end 直接返回', () => {
    const h = renderGestures()
    act(() => h.result.current.handleTouchEnd(touchEvent(120, 5)))
    expect(h.props.jumpTo).not.toHaveBeenCalled()
  })
})
