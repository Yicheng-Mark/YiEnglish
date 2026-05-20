import { apiFetch } from './api'

// Floating button position (local UI state, stays in localStorage)
const STORAGE_KEYS = {
  position: 'lingoforge_ai_position',
}

export function getPosition() {
  const saved = localStorage.getItem(STORAGE_KEYS.position)
  if (saved) {
    try { return JSON.parse(saved) } catch { /* ignore */ }
  }
  return { x: window.innerWidth - 80, y: window.innerHeight - 140 }
}

export function setPosition(pos) {
  localStorage.setItem(STORAGE_KEYS.position, JSON.stringify(pos))
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
