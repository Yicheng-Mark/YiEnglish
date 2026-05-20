import { getToken } from './auth'

export async function apiFetch(path, options = {}) {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(path, { ...options, headers, credentials: 'include' })

  if (res.status === 401) {
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
    throw new Error('登录已过期')
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
