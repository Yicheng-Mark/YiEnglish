const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

export async function apiFetch(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })

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
