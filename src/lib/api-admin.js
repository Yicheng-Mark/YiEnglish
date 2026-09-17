// 管理后台 API 封装：薄 apiFetch + parseJsonResponse（对齐 api-wordbooks.js 惯例——
// 注意 await：apiFetch 返回 Promise<Response>，直接喂 parseJsonResponse 会得到
// "e.json is not a function"）
import { apiFetch, parseJsonResponse } from './api'

function qs(params) {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== ''
  )
  if (!entries.length) return ''
  return '?' + new URLSearchParams(Object.fromEntries(entries)).toString()
}

export async function fetchAdminUsers(params = {}) {
  return parseJsonResponse(await apiFetch(`/api/admin/users${qs(params)}`))
}

export async function renewSubscription(userId, body) {
  return parseJsonResponse(
    await apiFetch(`/api/admin/users/${userId}/subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  )
}

export async function setMaxDevices(userId, value) {
  return parseJsonResponse(
    await apiFetch(`/api/admin/users/${userId}/max-devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    })
  )
}

export async function fetchAdminCodes(params = {}) {
  return parseJsonResponse(await apiFetch(`/api/admin/codes${qs(params)}`))
}

export async function createCodes(body) {
  return parseJsonResponse(
    await apiFetch('/api/admin/codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  )
}

export async function updateCode(codeId, body) {
  return parseJsonResponse(
    await apiFetch(`/api/admin/codes/${codeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  )
}

export async function fetchAdminAudit(params = {}) {
  return parseJsonResponse(await apiFetch(`/api/admin/audit${qs(params)}`))
}

// ---- 两步验证（TOTP，作用于当前管理员本人） ----

export async function fetchTotpStatus() {
  return parseJsonResponse(await apiFetch('/api/admin/totp/status'))
}

// 生成新密钥（不落库；enable 时才持久化）
export async function setupTotp() {
  return parseJsonResponse(await apiFetch('/api/admin/totp/setup', { method: 'POST' }))
}

export async function enableTotp(secret, code) {
  return parseJsonResponse(
    await apiFetch('/api/admin/totp/enable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, code }),
    })
  )
}

export async function disableTotp(code) {
  return parseJsonResponse(
    await apiFetch('/api/admin/totp/disable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
  )
}
