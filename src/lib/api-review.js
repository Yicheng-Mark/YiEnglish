import { apiFetch } from './api'

export async function apiFetchReviewCards() {
  const res = await apiFetch('/api/review')
  return res.json()
}

export async function apiAddReviewCard(wordName, dictId) {
  const res = await apiFetch('/api/review/add', {
    method: 'POST',
    body: JSON.stringify({ wordName, dictId }),
  })
  return res.json()
}

export async function apiUpsertReviewCards(cards) {
  const res = await apiFetch('/api/review/upsert', {
    method: 'POST',
    body: JSON.stringify({ cards }),
  })
  return res.json()
}

export async function apiResetReviewCards() {
  const res = await apiFetch('/api/review', {
    method: 'DELETE',
  })
  return res.json()
}
