import { apiFetch } from './api'

export async function fetchWordBook(bookType) {
  const res = await apiFetch(`/api/wordbooks/${bookType}`)
  return res.json()
}

export async function addWordToBook(bookType, wordInfo) {
  const res = await apiFetch(`/api/wordbooks/${bookType}`, {
    method: 'POST',
    body: JSON.stringify(wordInfo),
  })
  return res.json()
}

export async function removeWordFromBook(bookType, wordName) {
  const res = await apiFetch(`/api/wordbooks/${bookType}/${encodeURIComponent(wordName)}`, {
    method: 'DELETE',
  })
  return res.json()
}

export async function clearWordBook(bookType) {
  const res = await apiFetch(`/api/wordbooks/${bookType}?clearAll=true`, {
    method: 'DELETE',
  })
  return res.json()
}

export async function replaceWordBook(bookType, words) {
  const res = await apiFetch(`/api/wordbooks/${bookType}`, {
    method: 'PUT',
    body: JSON.stringify({ words }),
  })
  return res.json()
}
