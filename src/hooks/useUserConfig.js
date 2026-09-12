import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchSettings, updateSettings } from '../lib/api-settings'

const DEFAULT_CONFIG = {
  soundEnabled: true,
  showTranslation: true,
  showPhonetic: true,
  hideEnglish: false,
  wordRepeatCount: 1,
  autoRemoveErrorWord: true,
}

const VALID_THEMES = ['light', 'warm']

// 登录/会话恢复后 syncSettingsFromServer 把服务端设置写回 localStorage，
// 通过该事件通知已挂载的 useUserConfig 实例重读本地存档（config + theme），
// 使跨设备同步的设置/主题即时生效，无需整页刷新
const SETTINGS_SYNCED_EVENT = 'lingoforge:settings-synced'

function readConfigFromStorage() {
  try {
    const saved = localStorage.getItem('typingword_config')
    return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : DEFAULT_CONFIG
  } catch {
    return DEFAULT_CONFIG
  }
}

function loadInitialTheme() {
  if (typeof window === 'undefined') return 'light'
  try {
    const saved = localStorage.getItem('lingoforge-theme')
    // 旧存档（gray/star/legacy dark）随暗夜模式下线统一回落明亮
    if (saved && VALID_THEMES.includes(saved)) return saved
  } catch {
    return 'light'
  }
  return 'light'
}

function syncSettingUpdate(partial) {
  updateSettings(partial).catch((e) => console.warn('Sync settings failed:', e))
}

export function useUserConfig() {
  const [config, setConfig] = useState(readConfigFromStorage)
  // config 镜像 ref：让 updateConfig/toggleConfig 的引用在挂载后恒定（useCallback 空依赖），
  // 不再因每次渲染新建函数而击穿 TypingToolbar 等子组件的 memo（打字每键全量重渲染工具栏）
  const configRef = useRef(config)

  const [theme, setThemeState] = useState(loadInitialTheme)

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('lingoforge-theme', theme)
    } catch {}
  }, [theme])

  // 登录/会话恢复后服务端设置写回 localStorage → 重读本地存档（见 syncSettingsFromServer）
  useEffect(() => {
    const onSettingsSynced = () => {
      const next = readConfigFromStorage()
      configRef.current = next
      setConfig(next)
      setThemeState(loadInitialTheme())
    }
    window.addEventListener(SETTINGS_SYNCED_EVENT, onSettingsSynced)
    return () => window.removeEventListener(SETTINGS_SYNCED_EVENT, onSettingsSynced)
  }, [])

  const setTheme = useCallback((next) => {
    if (!VALID_THEMES.includes(next)) return
    setThemeState(next)
    syncSettingUpdate({ theme: next })
  }, [])

  const updateConfig = useCallback((key, value) => {
    setConfig((prev) => {
      const next = { ...prev, [key]: value }
      configRef.current = next
      try {
        localStorage.setItem('typingword_config', JSON.stringify(next))
      } catch {}
      syncSettingUpdate({ [key]: value })
      return next
    })
  }, [])

  const toggleConfig = useCallback(
    (key) => updateConfig(key, !configRef.current[key]),
    [updateConfig]
  )

  return { config, theme, setTheme, updateConfig, toggleConfig }
}

export async function syncSettingsFromServer() {
  try {
    const settings = await fetchSettings()
    const config = {
      soundEnabled: settings.soundEnabled ?? DEFAULT_CONFIG.soundEnabled,
      showTranslation: settings.showTranslation ?? DEFAULT_CONFIG.showTranslation,
      showPhonetic: settings.showPhonetic ?? DEFAULT_CONFIG.showPhonetic,
      hideEnglish: settings.hideEnglish ?? DEFAULT_CONFIG.hideEnglish,
      wordRepeatCount: settings.wordRepeatCount ?? DEFAULT_CONFIG.wordRepeatCount,
      autoRemoveErrorWord: settings.autoRemoveErrorWord ?? DEFAULT_CONFIG.autoRemoveErrorWord,
    }
    localStorage.setItem('typingword_config', JSON.stringify(config))
    if (settings.theme && VALID_THEMES.includes(settings.theme)) {
      localStorage.setItem('lingoforge-theme', settings.theme)
    }
    // 通知已挂载的 useUserConfig 实例重读 localStorage（跨设备同步的设置/主题即时生效）
    window.dispatchEvent(new Event(SETTINGS_SYNCED_EVENT))
  } catch (e) {
    console.warn('Sync settings from server failed:', e)
  }
}
