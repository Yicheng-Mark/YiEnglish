import { apiFetch } from './api'

// Floating button position (local UI state, stays in localStorage)
const STORAGE_KEYS = {
  position: 'lingoforge_ai_position',
  hidden: 'lingoforge_ai_hidden',
}

export function getPosition() {
  const saved = localStorage.getItem(STORAGE_KEYS.position)
  if (saved) {
    try { return JSON.parse(saved) } catch { /* ignore */ }
  }
  return { x: window.innerWidth - 80, y: window.innerHeight - 140 }
}

export function setPosition(pos) {
  try { localStorage.setItem(STORAGE_KEYS.position, JSON.stringify(pos)) } catch {}
}

export function isAIAssistantHidden() {
  return localStorage.getItem(STORAGE_KEYS.hidden) !== 'false'
}

export function setAIAssistantHidden(hidden) {
  try { localStorage.setItem(STORAGE_KEYS.hidden, hidden ? 'true' : 'false') } catch {}
  window.dispatchEvent(new Event('ai-visibility-change'))
}

// Style/persona management via API
let stylesCache = null

export async function fetchStyles() {
  try {
    const res = await apiFetch('/api/style')
    const data = await res.json()
    stylesCache = data
    return data
  } catch {
    // Fallback to cached data or defaults
    return stylesCache || {
      current: { style_key: 'teacher', name: '严肃', avatar: '👔', description: '专业、严谨' },
      all: [
        { style_key: 'teacher', name: '严肃', avatar: '👔', description: '专业、严谨' },
        { style_key: 'cute', name: '活泼', avatar: '🎉', description: '活泼、有趣' },
        { style_key: 'gentle', name: '温柔', avatar: '🌸', description: '温柔、耐心' },
        { style_key: 'custom', name: '自定义', avatar: '✨', description: '自定义' },
      ],
    }
  }
}

export async function switchStyle(styleKey) {
  const res = await apiFetch('/api/style', {
    method: 'POST',
    body: JSON.stringify({ styleKey }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `切换失败 (${res.status})`)
  }
  return res.json()
}

export async function updateCustomName(customName) {
  const res = await apiFetch('/api/style/name', {
    method: 'PATCH',
    body: JSON.stringify({ customName }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `更新失败 (${res.status})`)
  }
  return res.json()
}

export async function updateGender(gender) {
  const res = await apiFetch('/api/style/gender', {
    method: 'PATCH',
    body: JSON.stringify({ gender }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `更新失败 (${res.status})`)
  }
  return res.json()
}

export async function updateCustomPrompt(customPrompt) {
  const res = await apiFetch('/api/style/custom-prompt', {
    method: 'PATCH',
    body: JSON.stringify({ customPrompt }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `更新失败 (${res.status})`)
  }
  return res.json()
}

export async function resetStyleSettings() {
  const res = await apiFetch('/api/style/reset', {
    method: 'POST',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `重置失败 (${res.status})`)
  }
  return res.json()
}

export async function resetPersonality() {
  const res = await apiFetch('/api/style/reset-personality', {
    method: 'POST',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `重置失败 (${res.status})`)
  }
  return res.json()
}

export async function clearMemory() {
  const res = await apiFetch('/api/chat/clear-memory', {
    method: 'POST',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `清除失败 (${res.status})`)
  }
  return res.json()
}

// Chat history via API
export async function fetchChatHistory(limit = 50) {
  try {
    const res = await apiFetch(`/api/chat/history?limit=${limit}`)
    const data = await res.json()
    return data.messages || []
  } catch {
    return []
  }
}

// Daily chat usage
export async function fetchChatUsage() {
  try {
    const res = await apiFetch('/api/chat/usage')
    return await res.json() // { used, limit, remaining }
  } catch {
    return { used: 0, limit: 0, remaining: 0 }
  }
}
