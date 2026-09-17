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
    // 透传 refresh 自身的失败原因（如 SUBSCRIPTION_EXPIRED/TRIAL_EXPIRED）：
    // 调用方据此用真实原因 toast，而不是沿用原 401 的「登录已过期」
    const data = await res.json().catch(() => ({}))
    const result = { ok: res.ok, code: data.code, error: data.error }
    onRefreshed(result)
    return result
  } catch {
    onRefreshed({ ok: false })
    return { ok: false }
  } finally {
    isRefreshing = false
  }
}

function throwUnauthorized(data = {}) {
  if (data.code === 'TRIAL_EXPIRED') {
    toast.error('体验时间已结束，欢迎注册继续使用')
  } else if (data.code === 'SUBSCRIPTION_EXPIRED') {
    toast.error('账号已到期')
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
    // SUBSCRIPTION_EXPIRED 一并走静默刷新：middleware 只比对 token 内嵌的到期快照，
    // 手工 SQL 续期过的账号要靠 refresh（查库权威）拿新 token 透明恢复；
    // 真到期则 refresh 也 401 + 服务端清 cookie，走统一登出
    if (data.code === 'TOKEN_EXPIRED' || data.code === 'SUBSCRIPTION_EXPIRED') {
      const refreshed = await silentRefresh()
      if (refreshed.ok) {
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
      // refresh 被拒的真实原因（账号已到期/体验结束）优先于原 401 的 code，保证 toast 文案正确
      if (refreshed.code) {
        throwUnauthorized({ code: refreshed.code, error: refreshed.error })
      }
    }
    throwUnauthorized(data)
  }

  return res
}

/**
 * 带 401 静默续期的内容类 GET：词库 JSON / 合并索引等服务端下发数据用。
 *
 * 与 apiFetch 的差异：401 不触发登出——内容请求多发生在页面加载早期
 * （会话恢复完成前或 access token 刚过期的窗口），这里只做一次
 * TOKEN_EXPIRED → 静默刷新 → 重试；仍 401 则原样返回 Response，
 * 由调用方按 !res.ok 抛错（loadDictionary / loadWordIndex 既有语义）。
 */
export async function fetchWithAuth(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, { ...options, credentials: 'include' })
  if (res.status !== 401) return res
  const data = await res.json().catch(() => ({}))
  if (data.code === 'TOKEN_EXPIRED') {
    const refreshed = await silentRefresh()
    if (refreshed.ok) {
      return fetch(`${API_BASE}${path}`, { ...options, credentials: 'include' })
    }
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
    // 页面关闭/刷新时兜底 flush 也要能送达：keepalive 允许请求在页面卸载后继续完成
    keepalive: true,
  })
  return parseJsonResponse(res)
}

export async function resetProgress(dictId) {
  const res = await apiFetch(`/api/progress/${dictId}`, {
    method: 'DELETE',
  })
  return parseJsonResponse(res)
}
