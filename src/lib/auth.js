const TOKEN_KEY = 'lingoforge_token'
const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

export function saveToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export async function apiLogin(email, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '登录失败')
  if (data.token) saveToken(data.token)
  return data
}

export async function apiSendCode(email, type) {
  const res = await fetch(`${API_BASE}/api/auth/send-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, type }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '发送失败')
  return data
}

export async function apiRegister(email, code, password, nickname) {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, code, password, nickname }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '注册失败')
  if (data.token) saveToken(data.token)
  return data
}

export async function apiResetPassword(email, code, password) {
  const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, code, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '重置失败')
  return data
}

export async function apiGetProfile() {
  const headers = {}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'include', headers })
  if (!res.ok) return null
  return res.json()
}

export async function apiLogout() {
  saveToken(null)
  await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' })
}

export async function apiUpdateProfile(updates) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API_BASE}/api/auth/profile`, {
    method: 'PATCH',
    credentials: 'include',
    headers,
    body: JSON.stringify(updates),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '更新失败')
  return data
}

export async function apiResetLearning() {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API_BASE}/api/auth/reset-learning`, {
    method: 'POST',
    credentials: 'include',
    headers,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '重置失败')
  return data
}
