import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'lingoforge_corpus_settings'

const DEFAULTS = {
  subtitleSize: 16,           // 12-20
  videoLoop: false,           // <video loop>
  hideVideo: false,           // 隐藏视频画面（保留音频/字幕）
  showPhonetic: true,         // 单词卡是否显示音标
  showNotes: true,            // 字幕笔记
  dictationFollowMode: 'dictation', // 听写 vs 跟读: 'dictation' | 'follow'
  posHighlight: true,         // 词性颜色标记
}

function load() {
  if (typeof window === 'undefined') return { ...DEFAULTS }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw)
    return { ...DEFAULTS, ...parsed }
  } catch {
    return { ...DEFAULTS }
  }
}

export function useCorpusSettings() {
  const [settings, setSettings] = useState(load)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      /* quota error — ignore */
    }
  }, [settings])

  const updateSetting = useCallback((key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }, [])

  const toggleSetting = useCallback((key) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  return { settings, updateSetting, toggleSetting }
}
