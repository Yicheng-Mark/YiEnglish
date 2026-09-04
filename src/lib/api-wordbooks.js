import { apiFetch, parseJsonResponse } from './api'

export async function fetchWordBook(bookType) {
  const res = await apiFetch(`/api/wordbooks/${bookType}`)
  return parseJsonResponse(res)
}

export async function addWordToBook(bookType, wordInfo, { keepalive = false } = {}) {
  const res = await apiFetch(`/api/wordbooks/${bookType}`, {
    method: 'POST',
    body: JSON.stringify(wordInfo),
    // 卸载兜底 flush 时浏览器不保证普通 fetch 完成，keepalive 让请求存活到页面关闭后
    ...(keepalive ? { keepalive: true } : {}),
  })
  return parseJsonResponse(res)
}

export async function removeWordFromBook(bookType, wordName) {
  const res = await apiFetch(`/api/wordbooks/${bookType}/${encodeURIComponent(wordName)}`, {
    method: 'DELETE',
  })
  return parseJsonResponse(res)
}

export async function clearWordBook(bookType) {
  const res = await apiFetch(`/api/wordbooks/${bookType}?clearAll=true`, {
    method: 'DELETE',
  })
  return parseJsonResponse(res)
}

export async function replaceWordBook(bookType, words) {
  const res = await apiFetch(`/api/wordbooks/${bookType}`, {
    method: 'PUT',
    body: JSON.stringify({ words }),
  })
  return parseJsonResponse(res)
}
