import {
  addWordToBook,
  removeWordFromBook,
  clearWordBook,
  fetchWordBook,
} from '../lib/api-wordbooks'
import { idbDelete, idbClear, idbBulkPut } from './idb.js'

const STORAGE_KEY = 'typingword_wrong'

// 内存缓存：所有变更先改内存，再节流落盘/合批上云。
// 打字时每打错一个键都会走 addToErrorBook，若每次都全量
// stringify + localStorage.setItem + POST，错题本积累后会明显卡顿。
let _cache = null

function isMigrated() {
  return localStorage.getItem(STORAGE_KEY + '_migrated') === '1'
}

/** 从 localStorage 加载缓存（迁移后 localStorage 数据仍保留，可做 bootstrap） */
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

// errorBook 的 IDB 写入合批：同一词连续打错只需最终落盘一条（entry 引用被后续
// wrongCount 递增原地修改，flush 时天然是最新的）；逐键 idbPut 会排队
// IDB 事务，连续打错时抖动输入延迟
const pendingIdbPuts = new Map()

function flushIdbPuts() {
  if (pendingIdbPuts.size === 0) return
  const values = Array.from(pendingIdbPuts.values())
  pendingIdbPuts.clear()
  idbBulkPut('errorBook', values).catch((e) => console.warn('[IDB] errorBook bulk put failed:', e))
}

function writeStorageNow() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ words: _cache }))
  } catch (e) {
    console.error('Failed to persist error book:', e)
  }
  // 与 localStorage 共用同一个 2s debounce 批次
  flushIdbPuts()
}

function schedulePersist() {
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

// --- 服务端同步合批：同一词连续打错只发最后一次，按增量上报 ---
const SYNC_DEBOUNCE_MS = 2000
const SYNC_RETRY_MS = 10 * 1000 // 失败重试间隔，比首次 debounce 长，避免连续打点失败时高频重试
const SYNC_RETRY_MAX = 3 // 连续失败重试轮数上限，超过后等下一次自然触发（再打错词/页面隐藏）
const pendingSyncDeltas = new Map() // word -> 自上次成功同步后新增的错误次数
let syncTimer = null
let syncRetryCount = 0
// 会话代号：登出重置后自增，用于丢弃旧会话在途请求的迟到失败恢复
let syncEpoch = 0

// 同一单词的服务端写操作必须保持用户操作顺序。add 在途时本地删词，若 add 晚于
// delete 到达服务端，词条会“复活”。按词串行化（移植 reviewCards.js 的
// enqueueServerMutation 模式）：队列空时直接调用，保持首次请求仍在当前调用栈启动。
const serverMutationQueue = new Map()

function enqueueServerMutation(wordName, mutation, failureMessage) {
  const epoch = syncEpoch
  // 登出重置后仍在排队的 mutation 属于旧会话，跳过执行避免写进新账号
  const guardedMutation = () => {
    if (epoch !== syncEpoch) return
    return mutation()
  }
  const previous = serverMutationQueue.get(wordName)
  let current
  if (previous) {
    current = previous.catch(() => {}).then(guardedMutation)
  } else {
    try {
      current = Promise.resolve(guardedMutation())
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

function queueServerSync(word) {
  pendingSyncDeltas.set(word, (pendingSyncDeltas.get(word) || 0) + 1)
  syncRetryCount = 0 // 有新的错词写入，说明链路重新活跃，重置失败计数
  if (syncTimer) return
  syncTimer = setTimeout(flushServerSync, SYNC_DEBOUNCE_MS)
}

function scheduleSyncRetry() {
  if (syncTimer) return
  syncRetryCount++
  if (syncRetryCount > SYNC_RETRY_MAX) return
  syncTimer = setTimeout(flushServerSync, SYNC_RETRY_MS)
}

function flushServerSync({ keepalive = false } = {}) {
  if (syncTimer) {
    clearTimeout(syncTimer)
    syncTimer = null
  }
  if (pendingSyncDeltas.size === 0) return
  const epoch = syncEpoch
  const words = Array.from(pendingSyncDeltas.keys())
  const deltas = new Map(pendingSyncDeltas)
  pendingSyncDeltas.clear()
  ensureCache()
  for (const word of words) {
    const entry = _cache.find((w) => w.name === word)
    // 词已被删除则跳过，避免把刚删的词同步回去
    if (!entry) continue
    const delta = deltas.get(word) || 1
    enqueueServerMutation(
      word,
      async () => {
        try {
          await addWordToBook(
            'error',
            {
              name: entry.name,
              trans: entry.trans,
              notation: entry.notation,
              dictName: entry.dictName,
              wrongCount: entry.wrongCount || 1, // 首次插入用的绝对值
              delta, // 已存在时按增量累加
            },
            { keepalive }
          )
          syncRetryCount = 0
        } catch (e) {
          // 登出重置后迟到的失败响应：增量属于旧会话，直接丢弃，不还回队列
          if (epoch !== syncEpoch) throw e
          // 失败且词仍在错题本中：把增量还回去并定时重试。
          // 不重新武装定时器的话，增量会一直滞留到用户下次打错同一词或页面隐藏
          if (Array.isArray(_cache) && _cache.some((w) => w.name === word)) {
            pendingSyncDeltas.set(word, (pendingSyncDeltas.get(word) || 0) + delta)
            scheduleSyncRetry()
          }
          throw e
        }
      },
      'Sync error add failed:'
    )
  }
}

// 页面隐藏/关闭时兜底 flush，避免丢最近 2s 的错题
if (typeof window !== 'undefined') {
  const flushAll = () => {
    persistNow()
    // 卸载阶段普通 fetch 会被浏览器随时终止，keepalive 请求允许在页面关闭后继续完成
    flushServerSync({ keepalive: true })
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAll()
  })
  window.addEventListener('pagehide', flushAll)
  window.addEventListener('beforeunload', flushAll)
}

export function addToErrorBook({ word, trans, notation, dictName }) {
  try {
    ensureCache()
    const migrated = isMigrated()
    const existingIndex = _cache.findIndex((w) => w.name === word)
    if (existingIndex !== -1) {
      _cache[existingIndex].wrongCount = (_cache[existingIndex].wrongCount || 1) + 1
      _cache[existingIndex].trans = Array.isArray(trans) ? trans : trans ? trans.split('; ') : []
      _cache[existingIndex].notation = notation || _cache[existingIndex].notation
      _cache[existingIndex].dictName = dictName || _cache[existingIndex].dictName
      _cache[existingIndex].lastWrongTime = Date.now()
      if (migrated) {
        // 挂 2s debounce 批次，不再逐键开 IDB 事务
        pendingIdbPuts.set(word, _cache[existingIndex])
      }
    } else {
      _cache.unshift({
        name: word,
        trans: Array.isArray(trans) ? trans : trans ? trans.split('; ') : [],
        notation: notation || '',
        dictName: dictName || '',
        wrongCount: 1,
        addTime: Date.now(),
        lastWrongTime: Date.now(),
      })
      if (migrated) {
        pendingIdbPuts.set(word, _cache[0])
      }
    }
    schedulePersist()
    queueServerSync(word)
  } catch (e) {
    console.error('Failed to add to error book:', e)
  }
}

export function getErrorBook() {
  ensureCache()
  return { words: _cache }
}

export function removeFromErrorBook(wordName) {
  try {
    ensureCache()
    _cache = _cache.filter((w) => w.name !== wordName)
    pendingSyncDeltas.delete(wordName)
    // 先丢弃待写批次中的同词条目，避免 bulk put 迟到把刚删的词写回
    pendingIdbPuts.delete(wordName)
    persistNow()
    if (isMigrated()) {
      idbDelete('errorBook', wordName).catch((e) =>
        console.warn('[IDB] errorBook delete failed:', e)
      )
    }

    // 删除进同一按词队列：等在途 add 完成后再发，避免 add 晚到把词条“复活”
    enqueueServerMutation(
      wordName,
      () => removeWordFromBook('error', wordName),
      'Sync error remove failed:'
    )
  } catch (e) {
    console.error('Failed to remove from error book:', e)
  }
}

export function clearErrorBook() {
  ensureCache()
  _cache = []
  pendingSyncDeltas.clear()
  persistNow()
  if (isMigrated()) {
    idbClear('errorBook').catch((e) => console.warn('[IDB] errorBook clear failed:', e))
  }

  clearWordBook('error').catch((e) => console.warn('Sync error clear failed:', e))
}

export function getErrorBookCount() {
  return getErrorBook().words?.length || 0
}

// 登出时断开当前会话内存态：清空内存缓存与待上云增量队列（丢弃而非上云，
// 避免旧账号的合批写入被推进下一个登录的账号）。
// 不删除 localStorage/IDB 里的用户数据本身，仅取消尚未落盘的防抖定时器。
export function resetErrorBookCache() {
  // 先 flush 本地把 2s 防抖窗口内未落盘的错题写完（写的仍是本账号自己的 key），
  // 再断开内存态；服务端增量维持丢弃（登出请求已清 cookie，推了也只会 401）
  if (_cache !== null) persistNow()
  _cache = null
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  if (syncTimer) {
    clearTimeout(syncTimer)
    syncTimer = null
  }
  pendingSyncDeltas.clear()
  syncRetryCount = 0
  syncEpoch++
  // 排队中尚未执行的旧会话 mutation 直接丢弃（epoch 守卫兜底在途链）
  serverMutationQueue.clear()
}

const CHAPTER_SIZE = 25

export function loadErrorBookAsDictionary() {
  const data = getErrorBook()
  const words = data.words || []

  if (words.length === 0) {
    return {
      name: '错题本',
      description: '专属错题练习',
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
    name: '错题本',
    description: '专属错题练习',
    chapters,
  }
}

export async function syncErrorBookFromServer() {
  try {
    const data = await fetchWordBook('error')
    _cache = data.words || []
    // 服务端数据是权威版本：取消本地待写/待同步，直接覆盖落盘
    pendingSyncDeltas.clear()
    pendingIdbPuts.clear()
    persistNow()
    if (isMigrated()) {
      await idbClear('errorBook')
      await idbBulkPut('errorBook', _cache)
    }
  } catch (e) {
    console.warn('Sync error book from server failed:', e)
  }
}
