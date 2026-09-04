import { apiFetch, parseJsonResponse } from './api'

export async function apiFetchReviewCards() {
  const res = await apiFetch('/api/review')
  return parseJsonResponse(res)
}

export async function apiAddReviewCard(wordName, dictId) {
  const res = await apiFetch('/api/review/add', {
    method: 'POST',
    body: JSON.stringify({ wordName, dictId }),
  })
  return parseJsonResponse(res)
}

export async function apiUpsertReviewCards(cards) {
  const res = await apiFetch('/api/review/upsert', {
    method: 'POST',
    body: JSON.stringify({ cards }),
  })
  return parseJsonResponse(res)
}

export async function apiResetReviewCards() {
  const res = await apiFetch('/api/review', {
    method: 'DELETE',
  })
  return parseJsonResponse(res)
}

export async function apiDeleteReviewCard(wordName) {
  const res = await apiFetch(`/api/review/${encodeURIComponent(wordName)}`, {
    method: 'DELETE',
  })
  return parseJsonResponse(res)
}
