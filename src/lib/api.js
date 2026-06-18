import { toast } from 'sonner'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

let isRefreshing = false
let refreshSubscribers = []

function onRefreshed(success) {
  refreshSubscribers.forEach(cb => cb(success))
  refreshSubscribers = []
}

async function silentRefresh() {
  if (isRefreshing) {
    return new Promise(resolve => refreshSubscribers.push(resolve))
  }
  isRefreshing = true
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
    const ok = res.ok
    onRefreshed(ok)
    return ok
  } catch {
    onRefreshed(false)
    return false
  } finally {
    isRefreshing = false
  }
}

export async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) }
  if (options.body) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  })

  if (res.status === 401) {
    const data = await res.json().catch(() => ({}))
    if (data.code === 'TOKEN_EXPIRED') {
      const refreshed = await silentRefresh()
      if (refreshed) {
        return fetch(`${API_BASE}${path}`, {
          ...options,
          headers,
          credentials: 'include',
        })
      }
    }
    if (data.code === 'TRIAL_EXPIRED') {
      toast.error('体验时间已结束，欢迎注册继续使用')
    }
    window.dispatchEvent(new CustomEvent('auth:unauthorized'))
    throw new Error(data.error || '请先登录')
  }

  return res
}

export async function fetchProgress(dictId) {
  const res = await apiFetch(`/api/progress/${dictId}`)
  return res.json()
}

export async function saveProgress(dictId, chapterId, words) {
  const res = await apiFetch('/api/progress', {
    method: 'POST',
    body: JSON.stringify({ dictId, chapterId, words }),
  })
  return res.json()
}

export async function resetProgress(dictId) {
  const res = await apiFetch(`/api/progress/${dictId}`, {
    method: 'DELETE',
  })
  return res.json()
}
