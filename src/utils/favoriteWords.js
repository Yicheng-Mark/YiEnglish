import { addWordToBook, removeWordFromBook, fetchWordBook } from '../lib/api-wordbooks'
import { idbDelete, idbClear, idbBulkPut } from './idb.js'

const STORAGE_KEY = 'lingoforge_favorite_words'

// 内存缓存为唯一数据源：所有变更先改内存，2s debounce 落盘（localStorage 全量 +
// IDB 增量合批）——照 errorBook.js 的既有模式。词本打字模式的「答对自动移除」
// 每词触发一次写，若每次全量 stringify + setItem + 逐词 DELETE，词本积累后
// 会有每词一顿的抖动。
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

// --- 落盘 debounce ---
const PERSIST_DEBOUNCE_MS = 2000
let persistTimer = null
// 有未落盘变更才写：pagehide/visibilitychange 兜底在无变更时跳过，避免每次切标签页白做一次全量 stringify
let persistDirty = false

// IDB 写入合批：2s 窗口内同词多次变更只落最终一条，逐词 idbPut 会排队
// IDB 事务，密集写入时抖动输入延迟
const pendingIdbPuts = new Map()

function flushIdbPuts() {
  if (pendingIdbPuts.size === 0) return
  const values = Array.from(pendingIdbPuts.values())
  pendingIdbPuts.clear()
  idbBulkPut('favoriteWords', values).catch((e) =>
    console.warn('[IDB] favoriteWords bulk put failed:', e)
  )
}

function writeStorageNow() {
  // _cache === null（登出断开/本会话从未触碰）时不得落盘：
  // 写 {"words":null} 会覆盖存量词本，ensureCache 读回即被清空
  if (_cache === null) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ words: _cache }))
    persistDirty = false
  } catch (e) {
    console.error('Failed to persist favorite words:', e)
  }
  flushIdbPuts()
}

function schedulePersist() {
  persistDirty = true
  if (persistTimer) return
  persistTimer = setTimeout(() => {
    persistTimer = null
    writeStorageNow()
  }, PERSIST_DEBOUNCE_MS)
}

function persistNow() {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  writeStorageNow()
}

// --- 服务端写按词串行（移植 errorBook.js 的 enqueueServerMutation 模式）---
// 同一词条的服务端写必须保持用户操作顺序：add 在途时本地删词，若 add 晚于
// delete 到达服务端，词条会「复活」。队列空时直接调用，保持首次请求仍在当前调用栈启动。
const serverMutationQueue = new Map()
// 会话代号：登出重置后自增，丢弃旧会话仍在排队的 mutation——
// 慢网络下 in-flight add 的链式 delete 可能在新账号登录后才发出，
// 不加守卫会用新账号的 cookie 删新账号的同名词
let serverMutationEpoch = 0

function enqueueServerMutation(wordName, mutation, failureMessage) {
  const epoch = serverMutationEpoch
  const guarded = () => {
    if (epoch !== serverMutationEpoch) return
    return mutation()
  }
  const previous = serverMutationQueue.get(wordName)
  let current
  if (previous) {
    current = previous.catch(() => {}).then(guarded)
  } else {
    try {
      current = Promise.resolve(guarded())
    } catch (error) {
      current = Promise.reject(error)
    }
  }
  serverMutationQueue.set(wordName, current)
  current.then(
    () => {
      if (serverMutationQueue.get(wordName) === current) serverMutationQueue.delete(wordName)
    },
    (error) => {
      console.warn(failureMessage, error)
      if (serverMutationQueue.get(wordName) === current) serverMutationQueue.delete(wordName)
    }
  )
  return current
}

// 页面隐藏/关闭时兜底 flush，避免丢最近 2s 的变更
if (typeof window !== 'undefined') {
  const flushAll = () => {
    if (!persistDirty) return
    persistNow()
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAll()
  })
  window.addEventListener('pagehide', flushAll)
  window.addEventListener('beforeunload', flushAll)
}

export function getFavoriteWords() {
  ensureCache()
  return { words: _cache }
}

export function addToFavoriteWords(wordInfo) {
  try {
    ensureCache()
    const existingIndex = _cache.findIndex((w) => w.name === wordInfo.name)
    if (existingIndex !== -1) {
      _cache[existingIndex] = {
        ..._cache[existingIndex],
        ...wordInfo,
        addTime: _cache[existingIndex].addTime || Date.now(),
      }
      if (isMigrated()) pendingIdbPuts.set(wordInfo.name, _cache[existingIndex])
    } else {
      const entry = { ...wordInfo, addTime: Date.now() }
      _cache.unshift(entry)
      if (isMigrated()) pendingIdbPuts.set(wordInfo.name, entry)
    }
    schedulePersist()
    enqueueServerMutation(
      wordInfo.name,
      () => addWordToBook('favorite', wordInfo),
      'Sync favorite add failed:'
    )
  } catch (e) {
    console.error('Failed to add to favorite words:', e)
  }
}

export function removeFromFavoriteWords(wordName) {
  try {
    ensureCache()
    _cache = _cache.filter((w) => w.name !== wordName)
    // 先丢弃待写批次中的同词条目，避免 bulk put 迟到把刚删的词写回
    pendingIdbPuts.delete(wordName)
    schedulePersist()
    if (isMigrated()) {
      idbDelete('favoriteWords', wordName).catch((e) =>
        console.warn('[IDB] favoriteWords delete failed:', e)
      )
    }
    enqueueServerMutation(
      wordName,
      () => removeWordFromBook('favorite', wordName),
      'Sync favorite remove failed:'
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

// 登出时断开当前会话内存态：先 flush 把 2s 防抖窗口内未落盘的变更写完
// （写的仍是本账号自己的 key），再清空内存缓存与定时器（下次读取时重新从
// localStorage bootstrap）。不删除 localStorage/IDB 里的用户数据本身。
export function resetFavoriteWordsCache() {
  if (_cache !== null) persistNow()
  serverMutationEpoch++
  persistDirty = false
  _cache = null
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  pendingIdbPuts.clear()
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
    // 服务端数据是权威版本：取消本地待写批次，直接覆盖落盘
    pendingIdbPuts.clear()
    _cache = data.words || []
    persistNow()
    if (isMigrated()) {
      await idbClear('favoriteWords')
      await idbBulkPut('favoriteWords', _cache)
    }
  } catch (e) {
    console.warn('Sync favorite words from server failed:', e)
  }
}
