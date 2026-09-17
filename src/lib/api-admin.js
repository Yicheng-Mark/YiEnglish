// 管理后台 API 封装：薄 apiFetch + parseJsonResponse（对齐 api-wordbooks.js 惯例）
import { apiFetch, parseJsonResponse } from './api'

function qs(params) {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== ''
  )
  if (!entries.length) return ''
  return '?' + new URLSearchParams(Object.fromEntries(entries)).toString()
}

export function fetchAdminUsers(params = {}) {
  return parseJsonResponse(apiFetch(`/api/admin/users${qs(params)}`))
}

export function renewSubscription(userId, body) {
  return parseJsonResponse(
    apiFetch(`/api/admin/users/${userId}/subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  )
}

export function setMaxDevices(userId, value) {
  return parseJsonResponse(
    apiFetch(`/api/admin/users/${userId}/max-devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    })
  )
}

export function fetchAdminCodes(params = {}) {
  return parseJsonResponse(apiFetch(`/api/admin/codes${qs(params)}`))
}

export function createCodes(body) {
  return parseJsonResponse(
    apiFetch('/api/admin/codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  )
}

export function updateCode(codeId, body) {
  return parseJsonResponse(
    apiFetch(`/api/admin/codes/${codeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  )
}

export function fetchAdminAudit(params = {}) {
  return parseJsonResponse(apiFetch(`/api/admin/audit${qs(params)}`))
}
