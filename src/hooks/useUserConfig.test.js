// @vitest-environment jsdom
// useUserConfig 测试：初始配置合并/损坏兜底、主题解析 fallback 链（star 归一、legacy dark、
// prefers-color-scheme）、setTheme 白名单、gray 主题挂 dark 类、syncSettingsFromServer。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ fetchSettings: vi.fn(), updateSettings: vi.fn() }))
vi.mock('../lib/api-settings', () => ({
  fetchSettings: mocks.fetchSettings,
  updateSettings: mocks.updateSettings,
}))

import { useUserConfig, syncSettingsFromServer } from './useUserConfig.js'

const matchMediaMock = vi.fn().mockReturnValue({ matches: false })

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  mocks.updateSettings.mockResolvedValue()
  document.documentElement.className = ''
  document.documentElement.removeAttribute('data-theme')
  vi.stubGlobal('matchMedia', matchMediaMock)
  matchMediaMock.mockReturnValue({ matches: false })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('初始配置', () => {
  it('无存档 → 默认配置', () => {
    const { result } = renderHook(() => useUserConfig())
    expect(result.current.config).toEqual({
      soundEnabled: true,
      showTranslation: true,
      showPhonetic: true,
      hideEnglish: false,
      wordRepeatCount: 1,
      autoRemoveErrorWord: true,
    })
  })

  it('有存档 → 与默认值合并（增量字段不丢失兜底）', () => {
    localStorage.setItem('typingword_config', JSON.stringify({ soundEnabled: false }))
    const { result } = renderHook(() => useUserConfig())
    expect(result.current.config.soundEnabled).toBe(false)
    expect(result.current.config.wordRepeatCount).toBe(1)
  })

  it('存档损坏 → 默认配置不抛错', () => {
    localStorage.setItem('typingword_config', '{broken')
    const { result } = renderHook(() => useUserConfig())
    expect(result.current.config.soundEnabled).toBe(true)
  })
})

describe('主题解析 fallback 链', () => {
  it('lingoforge-theme = star（旧值）→ 归一为 gray', () => {
    localStorage.setItem('lingoforge-theme', 'star')
    const { result } = renderHook(() => useUserConfig())
    expect(result.current.theme).toBe('gray')
  })

  it('合法存档 → 直接采用', () => {
    localStorage.setItem('lingoforge-theme', 'warm')
    const { result } = renderHook(() => useUserConfig())
    expect(result.current.theme).toBe('warm')
  })

  it('存档非法 → 回退 legacy theme（dark → gray）', () => {
    localStorage.setItem('lingoforge-theme', 'neon')
    localStorage.setItem('theme', 'dark')
    const { result } = renderHook(() => useUserConfig())
    expect(result.current.theme).toBe('gray')
  })

  it('无任何存档 → 跟随系统 prefers-color-scheme', () => {
    matchMediaMock.mockReturnValue({ matches: true })
    const { result } = renderHook(() => useUserConfig())
    expect(result.current.theme).toBe('gray')
    expect(matchMediaMock).toHaveBeenCalledWith('(prefers-color-scheme: dark)')
  })
})

describe('setTheme', () => {
  it('非法值 → no-op（不更新不同步）', () => {
    const { result } = renderHook(() => useUserConfig())
    act(() => result.current.setTheme('dark'))
    expect(result.current.theme).toBe('light')
    expect(mocks.updateSettings).not.toHaveBeenCalled()
  })

  it('gray → 挂 dark 类 + data-theme + 持久化 + 服务端同步', () => {
    const { result } = renderHook(() => useUserConfig())
    act(() => result.current.setTheme('gray'))
    expect(result.current.theme).toBe('gray')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.getAttribute('data-theme')).toBe('gray')
    expect(localStorage.getItem('lingoforge-theme')).toBe('gray')
    expect(mocks.updateSettings).toHaveBeenCalledWith({ theme: 'gray' })
  })

  it('从 gray 切回 light → 移除 dark 类', () => {
    localStorage.setItem('lingoforge-theme', 'gray')
    const { result } = renderHook(() => useUserConfig())
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    act(() => result.current.setTheme('light'))
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})

describe('updateConfig / toggleConfig', () => {
  it('更新单字段 → 本地持久化 + 服务端同步', () => {
    const { result } = renderHook(() => useUserConfig())
    act(() => result.current.updateConfig('wordRepeatCount', 3))
    expect(result.current.config.wordRepeatCount).toBe(3)
    const saved = JSON.parse(localStorage.getItem('typingword_config'))
    expect(saved.wordRepeatCount).toBe(3)
    expect(mocks.updateSettings).toHaveBeenCalledWith({ wordRepeatCount: 3 })
  })

  it('toggleConfig 翻转布尔值', () => {
    const { result } = renderHook(() => useUserConfig())
    act(() => result.current.toggleConfig('soundEnabled'))
    expect(result.current.config.soundEnabled).toBe(false)
    act(() => result.current.toggleConfig('soundEnabled'))
    expect(result.current.config.soundEnabled).toBe(true)
  })
})

describe('syncSettingsFromServer', () => {
  it('服务端设置覆盖本地（缺失字段用默认值，theme 合法则写入）', async () => {
    mocks.fetchSettings.mockResolvedValue({
      soundEnabled: false,
      showTranslation: true,
      showPhonetic: true,
      hideEnglish: true,
      autoRemoveErrorWord: true,
      theme: 'warm',
      // wordRepeatCount 缺失 → 默认 1
    })
    await syncSettingsFromServer()
    const saved = JSON.parse(localStorage.getItem('typingword_config'))
    expect(saved).toEqual({
      soundEnabled: false,
      showTranslation: true,
      showPhonetic: true,
      hideEnglish: true,
      wordRepeatCount: 1,
      autoRemoveErrorWord: true,
    })
    expect(localStorage.getItem('lingoforge-theme')).toBe('warm')
  })

  it('服务端 theme 非法 → 不落盘', async () => {
    localStorage.setItem('lingoforge-theme', 'gray')
    mocks.fetchSettings.mockResolvedValue({
      theme: 'neon',
      soundEnabled: true,
    })
    await syncSettingsFromServer()
    expect(localStorage.getItem('lingoforge-theme')).toBe('gray')
  })

  it('请求失败 → 静默告警不抛错', async () => {
    mocks.fetchSettings.mockRejectedValue(new Error('network'))
    await expect(syncSettingsFromServer()).resolves.toBeUndefined()
  })
})
