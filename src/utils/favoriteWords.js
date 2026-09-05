import { addWordToBook, removeWordFromBook, fetchWordBook } from '../lib/api-wordbooks'
import { idbPut, idbDelete, idbClear, idbBulkPut } from './idb.js'

const STORAGE_KEY = 'lingoforge_favorite_words'

// 内存缓存：words 数组
let _cache = null

function isMigrated() {
  return localStorage.getItem(STORAGE_KEY + '_migrated') === '1'
}

function ensureCache() {
  if (_cache !== null) return
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    _cache = saved ? JSON.parse(saved).words || [] : []
  } catch {
    _cache = []
  }
}

export function getFavoriteWords() {
  if (isMigrated()) {
    ensureCache()
    return { words: _cache }
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : { words: [] }
  } catch {
    return { words: [] }
  }
}

export function addToFavoriteWords(wordInfo) {
  try {
    if (isMigrated()) {
      ensureCache()
      const existingIndex = _cache.findIndex((w) => w.name === wordInfo.name)
      if (existingIndex !== -1) {
        _cache[existingIndex] = {
          ..._cache[existingIndex],
          ...wordInfo,
          addTime: _cache[existingIndex].addTime || Date.now(),
        }
        idbPut('favoriteWords', _cache[existingIndex]).catch((e) =>
          console.warn('[IDB] favoriteWords put failed:', e)
        )
      } else {
        const entry = { ...wordInfo, addTime: Date.now() }
        _cache.unshift(entry)
        idbPut('favoriteWords', entry).catch((e) =>
          console.warn('[IDB] favoriteWords put failed:', e)
        )
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ words: _cache }))
    } else {
      const data = getFavoriteWords()
      const words = data.words || []
      const existingIndex = words.findIndex((w) => w.name === wordInfo.name)
      if (existingIndex !== -1) {
        words[existingIndex] = {
          ...words[existingIndex],
          ...wordInfo,
          addTime: words[existingIndex].addTime || Date.now(),
        }
      } else {
        words.unshift({
          ...wordInfo,
          addTime: Date.now(),
        })
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ words }))
    }

    addWordToBook('favorite', wordInfo).catch((e) => console.warn('Sync favorite add failed:', e))
  } catch (e) {
    console.error('Failed to add to favorite words:', e)
  }
}

export function removeFromFavoriteWords(wordName) {
  try {
    if (isMigrated()) {
      ensureCache()
      _cache = _cache.filter((w) => w.name !== wordName)
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ words: _cache }))
      idbDelete('favoriteWords', wordName).catch((e) =>
        console.warn('[IDB] favoriteWords delete failed:', e)
      )
    } else {
      const data = getFavoriteWords()
      const words = (data.words || []).filter((w) => w.name !== wordName)
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ words }))
    }

    removeWordFromBook('favorite', wordName).catch((e) =>
      console.warn('Sync favorite remove failed:', e)
    )
  } catch (e) {
    console.error('Failed to remove from favorite words:', e)
  }
}

export function isInFavoriteWords(wordName) {
  const data = getFavoriteWords()
  return (data.words || []).some((w) => w.name === wordName)
}

export function getFavoriteWordsCount() {
  return getFavoriteWords().words?.length || 0
}

// 登出时断开当前会话内存态：清空模块级内存缓存（下次读取时重新从
// localStorage bootstrap）。不删除 localStorage/IDB 里的用户数据本身。
export function resetFavoriteWordsCache() {
  _cache = null
}

const CHAPTER_SIZE = 25

export function loadFavoriteWordsAsDictionary() {
  const data = getFavoriteWords()
  const words = data.words || []

  if (words.length === 0) {
    return {
      name: '收藏词本',
      description: '你收藏的词汇',
      chapters: [],
    }
  }

  const chapters = []
  for (let i = 0; i < words.length; i += CHAPTER_SIZE) {
    const chunk = words.slice(i, i + CHAPTER_SIZE)
    const chapterIndex = Math.floor(i / CHAPTER_SIZE)
    chapters.push({
      id: chapterIndex,
      name: `第 ${chapterIndex + 1} 章`,
      words: chunk.map((w) => ({
        name: w.name,
        trans: w.trans,
        notation: w.notation,
        usphone: w.usphone,
        ukphone: w.ukphone,
        us: w.us,
        uk: w.uk,
      })),
    })
  }

  return {
    name: '收藏词本',
    description: '你收藏的词汇',
    chapters,
  }
}

export async function syncFavoriteWordsFromServer() {
  try {
    const data = await fetchWordBook('favorite')
    if (isMigrated()) {
      _cache = data.words || []
      await idbClear('favoriteWords')
      await idbBulkPut('favoriteWords', _cache)
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.warn('Sync favorite words from server failed:', e)
  }
}
