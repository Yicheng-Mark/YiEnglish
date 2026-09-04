import { apiFetch, parseJsonResponse } from './api'

export async function fetchSettings() {
  const res = await apiFetch('/api/settings')
  return parseJsonResponse(res)
}

export async function updateSettings(partial) {
  const res = await apiFetch('/api/settings', {
    method: 'PATCH',
    body: JSON.stringify(partial),
  })
  return parseJsonResponse(res)
}
