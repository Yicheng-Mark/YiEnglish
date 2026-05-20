import { apiFetch } from './api'

export async function fetchSettings() {
  const res = await apiFetch('/api/settings')
  return res.json()
}

export async function updateSettings(partial) {
  const res = await apiFetch('/api/settings', {
    method: 'PATCH',
    body: JSON.stringify(partial),
  })
  return res.json()
}
