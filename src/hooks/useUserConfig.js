import { useState, useEffect, useCallback } from 'react';
import { fetchSettings, updateSettings } from '../lib/api-settings'

const DEFAULT_CONFIG = {
  soundEnabled: true,
  showTranslation: true,
  showPhonetic: true,
  dictationMode: false,
  wordRepeatCount: 1,
  autoRemoveErrorWord: true,
};

const VALID_THEMES = ['light', 'gray', 'star', 'warm'];

function loadInitialTheme() {
  if (typeof window === 'undefined') return 'light';
  try {
    const saved = localStorage.getItem('lingoforge-theme');
    if (saved && VALID_THEMES.includes(saved)) return saved;
    const legacy = localStorage.getItem('theme');
    if (legacy === 'dark') return 'star';
    if (legacy === 'light') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'star' : 'light';
  } catch {
    return 'light';
  }
}

function syncSettingUpdate(partial) {
  updateSettings(partial).catch(e => console.warn('Sync settings failed:', e))
}

export function useUserConfig() {
  const [config, setConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('typingword_config');
      return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : DEFAULT_CONFIG;
    } catch { return DEFAULT_CONFIG; }
  });

  const [theme, setThemeState] = useState(loadInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'gray' || theme === 'star') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem('lingoforge-theme', theme); } catch {}
  }, [theme]);

  const setTheme = useCallback((next) => {
    if (!VALID_THEMES.includes(next)) return;
    setThemeState(next);
    syncSettingUpdate({ theme: next })
  }, []);

  const updateConfig = (key, value) => {
    setConfig(prev => {
      const next = { ...prev, [key]: value };
      localStorage.setItem('typingword_config', JSON.stringify(next));
      syncSettingUpdate({ [key]: value })
      return next;
    });
  };

  const toggleConfig = (key) => updateConfig(key, !config[key]);

  return { config, theme, setTheme, updateConfig, toggleConfig };
}

export async function syncSettingsFromServer() {
  try {
    const settings = await fetchSettings()
    const config = {
      soundEnabled: settings.soundEnabled ?? DEFAULT_CONFIG.soundEnabled,
      showTranslation: settings.showTranslation ?? DEFAULT_CONFIG.showTranslation,
      showPhonetic: settings.showPhonetic ?? DEFAULT_CONFIG.showPhonetic,
      dictationMode: settings.dictationMode ?? DEFAULT_CONFIG.dictationMode,
      wordRepeatCount: settings.wordRepeatCount ?? DEFAULT_CONFIG.wordRepeatCount,
      autoRemoveErrorWord: settings.autoRemoveErrorWord ?? DEFAULT_CONFIG.autoRemoveErrorWord,
    }
    localStorage.setItem('typingword_config', JSON.stringify(config))
    if (settings.theme && VALID_THEMES.includes(settings.theme)) {
      localStorage.setItem('lingoforge-theme', settings.theme)
    }
  } catch (e) {
    console.warn('Sync settings from server failed:', e)
  }
}
