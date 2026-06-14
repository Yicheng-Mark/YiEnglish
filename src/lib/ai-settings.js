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

// Daily chat usage —— 失败时不再伪装成「0/0 用完」，而是返回明确状态让 UI 区分处理
// 返回结构：
//   { status: 'ok', used, limit, remaining }  正常
//   { status: 'error' }                        加载失败（不该锁死 UI）
//   { status: 'forbidden' }                    体验账号（AI 为正式账号功能）
export async function fetchChatUsage() {
  let res
  try {
    res = await apiFetch('/api/chat/usage')
  } catch {
    // apiFetch 在 401 刷新失败 / 网络层错误时 throw —— 这是「加载失败」不是「次数用完」
    return { status: 'error' }
  }
  if (!res.ok) {
    // 403 = 体验账号（TRIAL_FORBIDDEN），其余 4xx/5xx = 加载失败
    const data = await res.json().catch(() => ({}))
    if (res.status === 403 && data.code === 'TRIAL_FORBIDDEN') return { status: 'forbidden' }
    return { status: 'error' }
  }
  // 防御：后端可能误返回 HTML（曾因进程未重启导致），res.json() 会抛 → 视为加载失败
  const data = await res.json().catch(() => null)
  if (!data || typeof data.limit !== 'number' || typeof data.remaining !== 'number') {
    return { status: 'error' }
  }
  return { status: 'ok', used: data.used ?? 0, limit: data.limit, remaining: data.remaining }
}

// 根据 usage 状态派生 UI 展示信息（placeholder / 提示 / 是否禁用）。
// loading 与 error 都不锁死输入框——真超限时后端会 429 拦截，前端 onError 有处理。
// 返回 { placeholder, hint, inputDisabled, sendDisabled, retryable }
export function deriveUsageUI(usage, displayName = 'AI 助手') {
  const status = usage?.status || 'loading'
  const base = { retryable: false }
  switch (status) {
    case 'ok':
      return {
        ...base,
        placeholder: usage.remaining > 0 ? `和 ${displayName} 对话...` : '今日对话次数已用完',
        hint: `剩余 ${usage.remaining}/${usage.limit} 次`,
        inputDisabled: usage.remaining <= 0,
        sendDisabled: usage.remaining <= 0,
      }
    case 'forbidden':
      return {
        ...base,
        placeholder: 'AI 助手为正式账号功能',
        hint: '正式账号功能',
        inputDisabled: true,
        sendDisabled: true,
      }
    case 'error':
      return {
        ...base,
        placeholder: `和 ${displayName} 对话...`,
        hint: '次数加载失败 · 点击重试',
        inputDisabled: false,
        sendDisabled: false,
        retryable: true,
      }
    case 'loading':
    default:
      return {
        ...base,
        placeholder: `和 ${displayName} 对话...`,
        hint: '加载中…',
        inputDisabled: false,
        sendDisabled: false,
      }
  }
}
