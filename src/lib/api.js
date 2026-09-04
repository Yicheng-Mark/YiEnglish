import { toast } from 'sonner'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

let isRefreshing = false
let refreshSubscribers = []

function onRefreshed(success) {
  refreshSubscribers.forEach((cb) => cb(success))
  refreshSubscribers = []
}

async function silentRefresh() {
  if (isRefreshing) {
    return new Promise((resolve) => refreshSubscribers.push(resolve))
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

function throwUnauthorized(data = {}) {
  if (data.code === 'TRIAL_EXPIRED') {
    toast.error('体验时间已结束，欢迎注册继续使用')
  }
  window.dispatchEvent(new CustomEvent('auth:unauthorized'))
  throw new Error(data.error || '请先登录')
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
        const retried = await fetch(`${API_BASE}${path}`, {
          ...options,
          headers,
          credentials: 'include',
        })
        // 刷新只尝试一次；若新 token 仍被拒绝，必须结束前端登录态，
        // 不能把 401 当普通 Response 交给调用方后继续显示已登录用户。
        if (retried.status === 401) {
          const retryData = await retried.json().catch(() => ({}))
          throwUnauthorized(retryData)
        }
        return retried
      }
    }
    throwUnauthorized(data)
  }

  return res
}

/**
 * Parse a JSON API response and reject unsuccessful HTTP responses.
 *
 * apiFetch intentionally returns non-401 Response objects so callers that need
 * status-specific handling can inspect them. JSON convenience wrappers should
 * use this helper instead, otherwise a 4xx/5xx JSON body looks like a success.
 */
export async function parseJsonResponse(res) {
  const data = await res.json().catch((error) => {
    if (res.ok) throw error
    return null
  })

  if (!res.ok) {
    throw new Error(data?.error || `请求失败 (${res.status})`)
  }

  return data
}

export async function fetchProgress(dictId) {
  const res = await apiFetch(`/api/progress/${dictId}`)
  return parseJsonResponse(res)
}

export async function saveProgress(dictId, chapterId, words) {
  const res = await apiFetch('/api/progress', {
    method: 'POST',
    body: JSON.stringify({ dictId, chapterId, words }),
  })
  return parseJsonResponse(res)
}

export async function resetProgress(dictId) {
  const res = await apiFetch(`/api/progress/${dictId}`, {
    method: 'DELETE',
  })
  return parseJsonResponse(res)
}
