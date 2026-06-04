import { useEffect, useState } from 'react'

const STORAGE_KEY = 'lingoforge_reading'

const defaultFilters = { category: '全部', year: '全部', search: '', bookmarkOnly: false }

const defaultState = {
  readProgress: {},
  lastReadAt: {},
  bookmarks: [],
  dailyReadingSeconds: {},
  dailyTypingSeconds: {},
  dailyListeningSeconds: {},
  filters: { ...defaultFilters },
}

function todayKey() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function loadFromStorage() {
  if (typeof window === 'undefined') return { ...defaultState }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...defaultState }
    const parsed = JSON.parse(raw)
    return {
      readProgress: parsed.readProgress && typeof parsed.readProgress === 'object' ? parsed.readProgress : {},
      lastReadAt: parsed.lastReadAt && typeof parsed.lastReadAt === 'object' ? parsed.lastReadAt : {},
      bookmarks: Array.isArray(parsed.bookmarks) ? parsed.bookmarks : [],
      dailyReadingSeconds: parsed.dailyReadingSeconds && typeof parsed.dailyReadingSeconds === 'object' ? parsed.dailyReadingSeconds : {},
      dailyTypingSeconds: parsed.dailyTypingSeconds && typeof parsed.dailyTypingSeconds === 'object' ? parsed.dailyTypingSeconds : {},
      dailyListeningSeconds: parsed.dailyListeningSeconds && typeof parsed.dailyListeningSeconds === 'object' ? parsed.dailyListeningSeconds : {},
      filters: parsed.filters && typeof parsed.filters === 'object' ? { ...defaultFilters, ...parsed.filters } : { ...defaultFilters },
    }
  } catch {
    return { ...defaultState }
  }
}

let cache = loadFromStorage()
let bookmarksSet = new Set(cache.bookmarks)
const listeners = new Set()

function persist() {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
    } catch {
      /* ignore quota errors */
    }
  }
  listeners.forEach((fn) => fn())
}

// Module-level helper functions for time tracking
function _addTypingSeconds(seconds) {
  const sec = Math.floor(seconds)
  if (!Number.isFinite(sec) || sec < 1) return
  const key = todayKey()
  const prev = cache.dailyTypingSeconds[key] || 0
  cache = {
    ...cache,
    dailyTypingSeconds: { ...cache.dailyTypingSeconds, [key]: prev + sec },
  }
  persist()
}

function _addReadingSeconds(seconds) {
  const sec = Math.floor(seconds)
  if (!Number.isFinite(sec) || sec < 1) return
  const key = todayKey()
  const prev = cache.dailyReadingSeconds[key] || 0
  cache = {
    ...cache,
    dailyReadingSeconds: { ...cache.dailyReadingSeconds, [key]: prev + sec },
  }
  persist()
}

function _addListeningSeconds(seconds) {
  const sec = Math.floor(seconds)
  if (!Number.isFinite(sec) || sec < 1) return
  const key = todayKey()
  const prev = cache.dailyListeningSeconds[key] || 0
  cache = {
    ...cache,
    dailyListeningSeconds: { ...cache.dailyListeningSeconds, [key]: prev + sec },
  }
  persist()
}

export function getReadingStoreActions() {
  return {
    addTypingSeconds: _addTypingSeconds,
    addReadingSeconds: _addReadingSeconds,
    addListeningSeconds: _addListeningSeconds,
  }
}

export function useReadingStore() {
  const [, setTick] = useState(0)

  useEffect(() => {
    const fn = () => setTick((t) => t + 1)
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  }, [])

  return {
    readProgress: cache.readProgress,
    lastReadAt: cache.lastReadAt,
    bookmarks: cache.bookmarks,
    dailyReadingSeconds: cache.dailyReadingSeconds,
    dailyTypingSeconds: cache.dailyTypingSeconds,
    dailyListeningSeconds: cache.dailyListeningSeconds,
    filters: cache.filters,
    getProgress(id) {
      return cache.readProgress[id] || 0
    },
    getLastReadAt(id) {
      return cache.lastReadAt[id] || null
    },
    isBookmarked(id) {
      return bookmarksSet.has(id)
    },
    setProgress(id, percent) {
      const clamped = Math.max(0, Math.min(100, Math.round(percent)))
      const prev = cache.readProgress[id] || 0
      // Only update if percent grew, or first read
      if (clamped <= prev && cache.lastReadAt[id]) {
        // still update lastReadAt to reflect re-visit
        cache = {
          ...cache,
          lastReadAt: { ...cache.lastReadAt, [id]: new Date().toISOString() },
        }
      } else {
        cache = {
          ...cache,
          readProgress: { ...cache.readProgress, [id]: clamped },
          lastReadAt: { ...cache.lastReadAt, [id]: new Date().toISOString() },
        }
      }
      persist()
    },
    toggleBookmark(id) {
      if (bookmarksSet.has(id)) {
        bookmarksSet.delete(id)
        cache = { ...cache, bookmarks: cache.bookmarks.filter((x) => x !== id) }
      } else {
        bookmarksSet.add(id)
        cache = { ...cache, bookmarks: [...cache.bookmarks, id] }
      }
      persist()
    },
    setFilters(partial) {
      cache = { ...cache, filters: { ...cache.filters, ...partial } }
      persist()
    },
    addReadingSeconds: _addReadingSeconds,
    getDailySeconds(dateKey) {
      return cache.dailyReadingSeconds[dateKey] || 0
    },
    getDailyTypingSeconds(dateKey) {
      return cache.dailyTypingSeconds[dateKey] || 0
    },
    getDailyListeningSeconds(dateKey) {
      return cache.dailyListeningSeconds[dateKey] || 0
    },
    getTotalReadingSeconds() {
      return Object.values(cache.dailyReadingSeconds).reduce((sum, n) => sum + (n || 0), 0)
    },
    getTotalTypingSeconds() {
      return Object.values(cache.dailyTypingSeconds).reduce((sum, n) => sum + (n || 0), 0)
    },
    getTotalListeningSeconds() {
      return Object.values(cache.dailyListeningSeconds).reduce((sum, n) => sum + (n || 0), 0)
    },
    getTotalStudySeconds() {
      return (
        Object.values(cache.dailyReadingSeconds).reduce((sum, n) => sum + (n || 0), 0) +
        Object.values(cache.dailyTypingSeconds).reduce((sum, n) => sum + (n || 0), 0) +
        Object.values(cache.dailyListeningSeconds).reduce((sum, n) => sum + (n || 0), 0)
      )
    },
    addTypingSeconds: _addTypingSeconds,
    addListeningSeconds: _addListeningSeconds,
    getCompletedArticleCount() {
      return Object.values(cache.readProgress).filter((p) => p >= 100).length
    },
  }
}

/**
 * Format an ISO date as a short relative-style label, e.g. "今天" / "昨天" / "5月3日".
 * @param {string|null|undefined} iso
 */
export function formatLastRead(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const now = new Date()
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diffDays = Math.round((startOf(now) - startOf(date)) / 86400000)
  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  if (diffDays > 0 && diffDays < 7) return `${diffDays} 天前`
  return `${date.getMonth() + 1}月${date.getDate()}日`
}
