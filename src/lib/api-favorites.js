import { apiFetch } from './api'

export async function fetchFavoriteDicts() {
  const res = await apiFetch('/api/favorites')
  return res.json()
}

export async function toggleFavoriteDict(dictId) {
  const res = await apiFetch('/api/favorites/toggle', {
    method: 'POST',
    body: JSON.stringify({ dictId }),
  })
  return res.json()
}
