import { apiFetch, parseJsonResponse } from './api'

export async function fetchFavoriteDicts() {
  const res = await apiFetch('/api/favorites')
  return parseJsonResponse(res)
}

export async function toggleFavoriteDict(dictId) {
  const res = await apiFetch('/api/favorites/toggle', {
    method: 'POST',
    body: JSON.stringify({ dictId }),
  })
  return parseJsonResponse(res)
}
