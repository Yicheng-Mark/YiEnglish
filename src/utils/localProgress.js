import { idbPut, idbDelete } from './idb.js'

const PROGRESS_KEY = 'lf_progress'

// 内存缓存：{ "dictId:chapterId": [word1, word2] }
// 打字时每完成一个单词都会走 saveLocalProgress，若每次都全量 stringify +
// localStorage.setItem，进度积累后会明显卡顿（见 errorBook.js 同类优化）。
// 变更先改内存（读立即可见），再节流落盘/写 IDB。
let _cache = null

function isMigrated() {
  return localStorage.getItem(PROGRESS_KEY + '_migrated') === '1'
}

function ensureCache() {
  if (_cache !== null) return
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    _cache = raw ? JSON.parse(raw) : {}
  } catch {
    _cache = {}
  }
}

// --- 落盘 debounce：localStorage 全量写 + IDB 增量 put 合并为同一次刷盘 ---
const PERSIST_DEBOUNCE_MS = 2000
let persistTimer = null
const pendingIdbKeys = new Set()

function writeStorageNow() {
  try {
    ensureCache()
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(_cache))
  } catch (e) {
    console.warn('[localProgress] persist error', e)
  }
}

function flushIdbPuts() {
  if (pendingIdbKeys.size === 0) return
  ensureCache()
  for (const key of pendingIdbKeys) {
    idbPut('progress', { dictChapter: key, words: _cache[key] || [] }).catch((e) =>
      console.warn('[IDB] progress put failed:', e)
    )
  }
  pendingIdbKeys.clear()
}

function schedulePersist(idbKey) {
  if (idbKey) pendingIdbKeys.add(idbKey)
  if (persistTimer) return
  persistTimer = setTimeout(() => {
    persistTimer = null
    writeStorageNow()
    flushIdbPuts()
  }, PERSIST_DEBOUNCE_MS)
}

function persistNow() {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  writeStorageNow()
  flushIdbPuts()
}

// 页面隐藏/关闭时兜底 flush，避免丢最近 2s 的进度
if (typeof window !== 'undefined') {
  const flushAll = () => persistNow()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAll()
  })
  window.addEventListener('pagehide', flushAll)
}

export function saveLocalProgress(dictId, chapterId, words) {
  try {
    const key = `${dictId}:${chapterId}`
    ensureCache()
    if (!_cache[key]) _cache[key] = []
    const set = new Set(_cache[key])
    for (const w of words) set.add(w)
    _cache[key] = [...set]
    // 仅迁移模式写 IDB；未迁移模式保持只写 localStorage
    schedulePersist(isMigrated() ? key : null)
  } catch (e) {
    console.warn('[localProgress] save error', e)
  }
}

export function getLocalProgress(dictId) {
  try {
    ensureCache()
    const chapters = {}
    for (const [key, words] of Object.entries(_cache)) {
      if (key.startsWith(`${dictId}:`)) {
        const chapterId = key.split(':')[1]
        chapters[chapterId] = words.length
      }
    }
    return chapters
  } catch (e) {
    console.warn('[localProgress] read error', e)
    return {}
  }
}

// 重置某词库的全部本地进度（ChapterSelect「重置进度」用）：
// 内存 + localStorage + IDB 三处同步清理，避免数据源不一致
export function clearLocalProgress(dictId) {
  try {
    ensureCache()
    const idbKeys = []
    for (const key of Object.keys(_cache)) {
      if (key.startsWith(`${dictId}:`)) {
        idbKeys.push(key)
        delete _cache[key]
      }
    }
    persistNow()
    if (isMigrated()) {
      for (const key of idbKeys) {
        idbDelete('progress', key).catch((e) => console.warn('[IDB] progress delete failed:', e))
      }
    }
  } catch (e) {
    console.warn('[localProgress] clear error', e)
  }
}
