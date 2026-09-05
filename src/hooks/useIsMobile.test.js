// @vitest-environment jsdom
// useIsMobile 测试：多条件判定逻辑（UA / 触屏 / iPadOS（Mac UA + 多点触控）/
// 视口短边 < 1024 / coarse pointer），以及手机/平板再细分（screen 短边 768 分界、
// 横屏长边 >= 1000 视为平板用桌面布局）与 resize 重判。
import { describe, it, expect, afterEach, vi } from 'vitest'
import { renderHook, act, fireEvent } from '@testing-library/react'
import useIsMobile from './useIsMobile.js'

function setup({
  ua,
  touch = false,
  maxTouchPoints = 0,
  innerWidth,
  innerHeight,
  screenW,
  screenH,
  coarse = false,
} = {}) {
  vi.stubGlobal('navigator', { userAgent: ua, maxTouchPoints })
  vi.stubGlobal('screen', { width: screenW, height: screenH })
  window.innerWidth = innerWidth
  window.innerHeight = innerHeight
  window.matchMedia = vi.fn(() => ({ matches: coarse }))
  if (touch) {
    window.ontouchstart = null
  } else {
    delete window.ontouchstart
  }
}

const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36'
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile Safari/537.36'
const MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'

afterEach(() => {
  vi.unstubAllGlobals()
  delete window.ontouchstart
})

describe('isMobile 判定', () => {
  it('Android 手机 UA → 移动端', () => {
    setup({ ua: ANDROID_UA, innerWidth: 375, innerHeight: 812, screenW: 375, screenH: 812 })
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('桌面 UA、无触屏 → 桌面端', () => {
    setup({ ua: DESKTOP_UA, innerWidth: 1920, innerHeight: 1080, screenW: 1920, screenH: 1080 })
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it('iPadOS 13+（Mac UA + maxTouchPoints）竖屏 → 移动端', () => {
    setup({
      ua: MAC_UA,
      maxTouchPoints: 5,
      innerWidth: 820,
      innerHeight: 1180,
      screenW: 820,
      screenH: 1180,
    })
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('iPadOS 横屏 → 用桌面布局', () => {
    setup({
      ua: MAC_UA,
      maxTouchPoints: 5,
      innerWidth: 1180,
      innerHeight: 820,
      screenW: 820,
      screenH: 1180,
    })
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it('桌面 UA 但带触屏且视口短边 < 1024 → 视为移动设备', () => {
    setup({
      ua: DESKTOP_UA,
      touch: true,
      innerWidth: 900,
      innerHeight: 700,
      screenW: 900,
      screenH: 700,
    })
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('触屏但视口短边 >= 1024 且非 coarse pointer → 桌面端', () => {
    setup({
      ua: DESKTOP_UA,
      touch: true,
      innerWidth: 1280,
      innerHeight: 1024,
      screenW: 1280,
      screenH: 1024,
    })
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it('触屏 + coarse pointer（短边再大也算移动设备）→ 平板竖屏为移动端', () => {
    setup({
      ua: DESKTOP_UA,
      touch: true,
      coarse: true,
      innerWidth: 1100,
      innerHeight: 1400,
      screenW: 1100,
      screenH: 1400,
    })
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('手机横屏且 screen 长边 >= 1000 → 视为平板，用桌面布局', () => {
    setup({ ua: ANDROID_UA, innerWidth: 1024, innerHeight: 600, screenW: 1024, screenH: 600 })
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it('手机横屏但 screen 长边 < 1000 → 仍是移动端', () => {
    setup({ ua: ANDROID_UA, innerWidth: 932, innerHeight: 430, screenW: 932, screenH: 430 })
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('resize → 重新判定（手机竖屏转大屏横屏后切到桌面布局）', () => {
    setup({ ua: ANDROID_UA, innerWidth: 375, innerHeight: 812, screenW: 375, screenH: 812 })
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)

    act(() => {
      window.innerWidth = 1200
      window.innerHeight = 800
      screen.width = 1200
      screen.height = 800
      fireEvent(window, new Event('resize'))
    })
    expect(result.current).toBe(false)
  })
})
