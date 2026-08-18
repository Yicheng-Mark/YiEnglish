import { useState, useEffect } from 'react'
import { fetchFavoriteDicts, toggleFavoriteDict } from '../lib/api-favorites'

const STORAGE_KEY = 'lf_favorite_dicts'

const listeners = new Set()

let cache = loadFromStorage()

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      if (Array.isArray(data)) return data
    }
  } catch {
    /* ignore */
  }
  return []
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
  } catch (e) {
    // 配额满 / 隐私模式：内存态保持一致并照常广播，落盘失败不阻断交互
    console.warn('Persist favorite dicts failed:', e)
  }
  listeners.forEach((fn) => fn())
}

export function getFavorites() {
  return cache
}

export function isFavorite(dictId) {
  return cache.includes(dictId)
}

export function toggleFavorite(dictId) {
  if (cache.includes(dictId)) {
    cache = cache.filter((id) => id !== dictId)
  } else {
    cache = [...cache, dictId]
  }
  persist()

  toggleFavoriteDict(dictId).catch((e) => console.warn('Sync favorite dict failed:', e))
}

export function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useFavorites() {
  const [, forceUpdate] = useState(0)
  useEffect(() => {
    const unsub = subscribe(() => forceUpdate((n) => n + 1))
    return unsub
  }, [])
  return { favorites: getFavorites(), isFavorite, toggleFavorite }
}

export async function syncFavoriteDictsFromServer() {
  try {
    const data = await fetchFavoriteDicts()
    cache = data.dicts || []
    persist()
  } catch (e) {
    console.warn('Sync favorite dicts from server failed:', e)
  }
}
