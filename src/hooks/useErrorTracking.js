import { useCallback } from 'react'
import { idbBulkPut, idbGetAll, idbDelete } from '../utils/idb'

const STORE = 'errorDetails'

// QWERTY 键盘邻接表
const ADJACENT = {
  q: 'w',
  w: 'qe',
  e: 'wr',
  r: 'et',
  t: 'ry',
  y: 'tu',
  u: 'yi',
  i: 'uo',
  o: 'ip',
  p: 'o',
  a: 'sq',
  s: 'adw',
  d: 'sfe',
  f: 'dgr',
  g: 'fht',
  h: 'gjy',
  j: 'hku',
  k: 'jli',
  l: 'k',
  z: 'x',
  x: 'zc',
  c: 'xv',
  v: 'cb',
  b: 'vn',
  n: 'bm',
  m: 'n',
}

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u'])

function classifyError(word, letterIndex, expected, typed) {
  // 1. 双写遗漏：期望字母与前一个字母相同（用户漏打重复字母）
  if (letterIndex > 0 && expected === word[letterIndex - 1]) {
    return 'doubleLetter'
  }
  // 2. 元音混淆
  if (VOWELS.has(expected) && VOWELS.has(typed)) {
    return 'vowel'
  }
  // 3. 相邻键位（expected/typed 可能为 undefined —— 空章节/加载中时触发，需防御）
  if (typeof expected !== 'string' || typeof typed !== 'string') return 'other'
  const e = expected.toLowerCase()
  const t = typed.toLowerCase()
  if (ADJACENT[e] && ADJACENT[e].includes(t)) {
    return 'adjacentKey'
  }
  // 4. 其他
  return 'other'
}

// 内存缓存：避免每次 getErrorStats 都读 IDB
let _cache = null
let _cacheTimestamp = 0
const CACHE_TTL = 3000 // 3 秒

// errorDetails 每次错键插一行、从不清理会无限增长：写入路径上低频触发
// 30 天保留期的过期清理（每 N 次写一次，全量读出后按 timestamp 删旧记录）
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000
const PRUNE_EVERY_N_WRITES = 50
let writeCount = 0

function pruneExpiredErrors() {
  const cutoff = Date.now() - RETENTION_MS
  idbGetAll(STORE)
    .then((all) => {
      for (const e of all) {
        if (e && typeof e.timestamp === 'number' && e.timestamp < cutoff) {
          idbDelete(STORE, e.id).catch(() => {})
        }
      }
    })
    .catch(() => {})
}

function invalidateCache() {
  _cache = null
  _cacheTimestamp = 0
}

// 错键明细合批：每个错键插一行，连续打错时逐键开 IDB 事务会排队抖动输入延迟。
// 缓冲后统一落盘（单事务批量 put），页面隐藏/关闭时兜底 flush 防
// 丢失最近 2s 的明细
let pendingDetails = []
let detailFlushTimer = null
const DETAILS_FLUSH_MS = 2000

function flushErrorDetails() {
  if (detailFlushTimer) {
    clearTimeout(detailFlushTimer)
    detailFlushTimer = null
  }
  if (pendingDetails.length === 0) return
  const batch = pendingDetails
  pendingDetails = []
  idbBulkPut(STORE, batch).catch(() => {})
}

function scheduleErrorDetailsFlush() {
  if (detailFlushTimer) return
  detailFlushTimer = setTimeout(flushErrorDetails, DETAILS_FLUSH_MS)
}

if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushErrorDetails()
  })
  window.addEventListener('pagehide', flushErrorDetails)
}

export default function useErrorTracking() {
  const onError = useCallback((wordObj, expected, typed, letterIndex) => {
    // 空/加载中场景 expected/typed 可能为 undefined，跳过避免崩溃并污染统计
    if (typeof expected !== 'string' || typeof typed !== 'string') return
    const word = typeof wordObj === 'string' ? wordObj : wordObj.name
    const entry = {
      word,
      letterIndex,
      expected,
      typed,
      timestamp: Date.now(),
      pattern: classifyError(word, letterIndex, expected, typed),
    }
    // 进内存缓冲，2s 批量落盘（不再逐键开 IDB 事务）
    pendingDetails.push(entry)
    scheduleErrorDetailsFlush()
    writeCount += 1
    if (writeCount % PRUNE_EVERY_N_WRITES === 0) pruneExpiredErrors()
    invalidateCache()
  }, [])

  const getRecentErrors = useCallback(async (days = 30) => {
    const all = await idbGetAll(STORE)
    // 合并尚未落盘的缓冲行，保证统计/导出与实际错键一致
    const merged = pendingDetails.length ? all.concat(pendingDetails) : all
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    return merged.filter((e) => e.timestamp >= cutoff)
  }, [])

  const getErrorStats = useCallback(async () => {
    // 使用缓存
    const now = Date.now()
    if (_cache && now - _cacheTimestamp < CACHE_TTL) {
      return _cache
    }

    const recent = await getRecentErrors(30)
    const total = recent.length

    const byPattern = { doubleLetter: 0, vowel: 0, adjacentKey: 0, other: 0 }
    const wordMap = {} // word -> { totalErrors, errorMap: { letterIndex: count } }

    for (const err of recent) {
      byPattern[err.pattern] = (byPattern[err.pattern] || 0) + 1

      if (!wordMap[err.word]) {
        wordMap[err.word] = { word: err.word, totalErrors: 0, errorMap: {} }
      }
      wordMap[err.word].totalErrors += 1
      wordMap[err.word].errorMap[err.letterIndex] =
        (wordMap[err.word].errorMap[err.letterIndex] || 0) + 1
    }

    // Top 5 错误最多的单词
    const topWords = Object.values(wordMap)
      .sort((a, b) => b.totalErrors - a.totalErrors)
      .slice(0, 5)

    const result = { total, byPattern, topWords }
    _cache = result
    _cacheTimestamp = now
    return result
  }, [getRecentErrors])

  return { onError, getErrorStats, getRecentErrors }
}
