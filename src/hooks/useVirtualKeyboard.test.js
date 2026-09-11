// @vitest-environment jsdom
// useVirtualKeyboard 测试：visualViewport 键盘高度检测——基准捕获、收缩差值计算、
// threshold 噪声过滤、active=false 不挂监听、无 visualViewport 时 fallback window resize。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import useVirtualKeyboard from './useVirtualKeyboard.js'

const BASE_HEIGHT = 800

function makeVisualViewport(height) {
  const listeners = []
  const vv = {
    height,
    addEventListener: (_type, fn) => listeners.push(fn),
    removeEventListener: (_type, fn) => {
      const i = listeners.indexOf(fn)
      if (i !== -1) listeners.splice(i, 1)
    },
    resizeTo(h) {
      vv.height = h
      listeners.forEach((fn) => fn())
    },
    listenerCount: () => listeners.length,
  }
  return vv
}

let vv = null

function setupVv(height = BASE_HEIGHT) {
  vv = makeVisualViewport(height)
  window.visualViewport = vv
  return vv
}

beforeEach(() => {
  window.innerHeight = BASE_HEIGHT
  // rAF 同步结算且返回 null（不占用 rafId 槽位），每帧直接结算一次 setState，
  // 测试无需等待帧；cancelAnimationFrame 一并 stub 防卸载路径报错
  vi.stubGlobal('requestAnimationFrame', (cb) => {
    cb(0)
    return null
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete window.visualViewport
  vv = null
  window.innerHeight = BASE_HEIGHT
})

describe('useVirtualKeyboard', () => {
  it('初始（键盘未弹起）：keyboardHeight 0、viewportHeight null', () => {
    setupVv(BASE_HEIGHT)
    const { result } = renderHook(() => useVirtualKeyboard())
    expect(result.current).toEqual({ keyboardHeight: 0, viewportHeight: null })
  })

  it('键盘弹起：高度差即键盘高度，viewportHeight 为键盘上方可视高度', () => {
    setupVv(BASE_HEIGHT)
    const { result } = renderHook(() => useVirtualKeyboard())
    act(() => vv.resizeTo(500))
    expect(result.current.keyboardHeight).toBe(300)
    expect(result.current.viewportHeight).toBe(500)
  })

  it('键盘收起：复位 0 / null', () => {
    setupVv(BASE_HEIGHT)
    const { result } = renderHook(() => useVirtualKeyboard())
    act(() => vv.resizeTo(500))
    act(() => vv.resizeTo(BASE_HEIGHT))
    expect(result.current).toEqual({ keyboardHeight: 0, viewportHeight: null })
  })

  it('threshold 噪声过滤：收缩小于 threshold（地址栏伸缩）不算键盘弹起', () => {
    setupVv(BASE_HEIGHT)
    const { result } = renderHook(() => useVirtualKeyboard({ threshold: 150 }))
    act(() => vv.resizeTo(BASE_HEIGHT - 100))
    expect(result.current).toEqual({ keyboardHeight: 0, viewportHeight: null })
    act(() => vv.resizeTo(BASE_HEIGHT - 300))
    expect(result.current.keyboardHeight).toBe(300)
    expect(result.current.viewportHeight).toBe(500)
  })

  it('视口反而变高（如旋转）：负差值按 0 处理', () => {
    setupVv(BASE_HEIGHT)
    const { result } = renderHook(() => useVirtualKeyboard())
    act(() => vv.resizeTo(1000))
    expect(result.current).toEqual({ keyboardHeight: 0, viewportHeight: null })
  })

  it('active=false：不挂监听，状态保持初始值', () => {
    const view = setupVv(BASE_HEIGHT)
    const { result } = renderHook(() => useVirtualKeyboard({ active: false }))
    expect(view.listenerCount()).toBe(0)
    act(() => view.resizeTo(400))
    expect(result.current).toEqual({ keyboardHeight: 0, viewportHeight: null })
  })

  it('卸载后监听已全部移除，派发 resize 无副作用', () => {
    const view = setupVv(BASE_HEIGHT)
    const { unmount } = renderHook(() => useVirtualKeyboard())
    expect(view.listenerCount()).toBe(1)
    unmount()
    expect(view.listenerCount()).toBe(0)
    expect(() => act(() => view.resizeTo(400))).not.toThrow()
  })

  it('无 visualViewport（老浏览器）：fallback 到 window resize，用 innerHeight 差值', () => {
    const { result } = renderHook(() => useVirtualKeyboard())
    act(() => {
      window.innerHeight = 400
      window.dispatchEvent(new Event('resize'))
    })
    expect(result.current.keyboardHeight).toBe(BASE_HEIGHT - 400)
    expect(result.current.viewportHeight).toBe(400)
  })
})
