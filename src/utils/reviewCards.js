import {
  apiFetchReviewCards,
  apiUpsertReviewCards,
  apiAddReviewCard,
  apiDeleteReviewCard,
} from '../lib/api-review'
import { idbPut, idbClear, idbBulkPut, idbDelete } from './idb.js'
import { buildDictWordMap } from './dictWordMap.js'

const STORAGE_KEY = 'lingoforge_review_cards'
const DAY_MS = 24 * 60 * 60 * 1000
const CHAPTER_SIZE = 25

// 内存缓存：{ [wordName]: cardObj }
let _cache = null

// 同一单词的服务端写操作必须保持用户操作顺序。HTTP 请求即使按 add/upsert → delete
// 发起，也可能在服务端乱序完成，导致较慢的旧写入在删除后把卡片“复活”。
// 队列为空时直接调用 mutation，保持首次同步请求仍在当前调用栈中启动。
const serverMutationQueue = new Map()

function enqueueServerMutation(wordName, mutation, failureMessage) {
  const previous = serverMutationQueue.get(wordName)
  let current
  if (previous) {
    current = previous.catch(() => {}).then(mutation)
  } else {
    try {
      current = Promise.resolve(mutation())
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

function isMigrated() {
  return localStorage.getItem(STORAGE_KEY + '_migrated') === '1'
}

function ensureCache() {
  if (_cache !== null) return
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    const data = saved ? JSON.parse(saved) : null
    // 老版本格式/半损坏数据可能是数组或缺 cards 字段：兜底为空表，
    // 否则消费端 Object.values(undefined) 抛 TypeError 会让 Home 整页崩
    _cache =
      data &&
      typeof data === 'object' &&
      !Array.isArray(data) &&
      data.cards &&
      typeof data.cards === 'object'
        ? data.cards
        : {}
  } catch {
    _cache = {}
  }
}

// --- 落盘 debounce：内存为唯一数据源（读立即可见），全量 stringify 节流写 ---
// 打字时每个新词都会走 addWordToReview，若每次都全量 stringify + localStorage.setItem，
// 复习卡积累后会明显卡顿（见 errorBook.js 同类优化）。IDB 单卡 put 开销小，保持即时。
const PERSIST_DEBOUNCE_MS = 2000
let persistTimer = null

function writeStorageNow() {
  try {
    ensureCache()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ cards: _cache }))
  } catch {}
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

// 页面隐藏/关闭时兜底 flush，避免丢最近 2s 的复习卡
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') persistNow()
  })
  window.addEventListener('pagehide', persistNow)
}

function getCards() {
  ensureCache()
  return { cards: _cache }
}

export function addWordToReview(wordName, dictId) {
  try {
    const card = {
      wordName,
      dictId,
      nextReview: Date.now() + DAY_MS,
      interval: 1,
      easeFactor: 2.5,
      repetitions: 0,
      lastReviewAt: null,
      lastQuality: null,
    }

    ensureCache()
    if (_cache[wordName]) return
    _cache[wordName] = card
    if (isMigrated()) {
      idbPut('reviewCards', card).catch((e) => console.warn('[IDB] reviewCards put failed:', e))
    }
    schedulePersist()

    enqueueServerMutation(
      wordName,
      () => apiAddReviewCard(wordName, dictId),
      'Sync review add failed:'
    )
  } catch (e) {
    console.error('Failed to add word to review:', e)
  }
}

export function updateReviewCard(wordName, quality) {
  try {
    const data = getCards()
    const card = data.cards[wordName]
    if (!card) return

    // legacy 卡片可能缺字段，解构补默认值避免 NaN 扩散
    let { interval = 0, easeFactor = 2.5, repetitions = 0 } = card

    if (quality >= 3) {
      repetitions += 1
      // 标准 SM-2 EF 更新：q=5 → +0.1，q=4 → 不变，q=3 → -0.14，下限 1.3
      easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))
      if (repetitions === 1) interval = 1
      else if (repetitions === 2) interval = 6
      else interval = Math.round(interval * easeFactor)
    } else {
      repetitions = 0
      interval = 1
    }

    card.interval = interval
    card.easeFactor = easeFactor
    card.repetitions = repetitions
    card.lastReviewAt = Date.now()
    card.lastQuality = quality
    card.nextReview = Date.now() + interval * DAY_MS

    // card 是 _cache 内的引用，上面的变更已直接反映到内存
    if (isMigrated()) {
      idbPut('reviewCards', card).catch((e) => console.warn('[IDB] reviewCards put failed:', e))
    }
    schedulePersist()

    const payload = [
      {
        wordName,
        dictId: card.dictId,
        nextReview: card.nextReview,
        interval,
        easeFactor,
        repetitions,
        lastReviewAt: card.lastReviewAt,
        lastQuality: quality,
      },
    ]
    enqueueServerMutation(
      wordName,
      () => apiUpsertReviewCards(payload),
      'Sync review update failed:'
    )
  } catch (e) {
    console.error('Failed to update review card:', e)
  }
}

export function removeFromReviewCards(wordName) {
  try {
    ensureCache()
    if (!_cache[wordName]) return
    delete _cache[wordName]
    // 删除是破坏性操作，立即落盘避免防抖窗口内进程退出导致复活
    persistNow()
    if (isMigrated()) {
      idbDelete('reviewCards', wordName).catch((e) =>
        console.warn('[IDB] reviewCards delete failed:', e)
      )
    }
    enqueueServerMutation(
      wordName,
      () => apiDeleteReviewCard(wordName),
      'Sync review delete failed:'
    )
  } catch (e) {
    console.error('Failed to remove review card:', e)
  }
}

export function getDueReviewCount() {
  const data = getCards()
  const now = Date.now()
  return Object.values(data.cards).filter((c) => c.nextReview <= now).length
}

export function getTotalReviewCount() {
  const data = getCards()
  return Object.keys(data.cards).length
}

export async function getDueReviewWords() {
  const data = getCards()
  const now = Date.now()
  const dueCards = Object.values(data.cards)
    .filter((c) => c.nextReview <= now)
    .sort((a, b) => a.nextReview - b.nextReview)

  if (dueCards.length === 0) return []

  const map = await buildDictWordMap()
  return dueCards.map((card) => {
    const lookup = map.get(card.wordName.toLowerCase())
    return {
      name: card.wordName,
      trans: lookup?.trans || [],
      notation: lookup?.notation || '',
      usphone: lookup?.usphone || '',
      ukphone: lookup?.ukphone || '',
      us: lookup?.us || '',
      uk: lookup?.uk || '',
    }
  })
}

export async function loadReviewAsDictionary() {
  const words = await getDueReviewWords()

  if (words.length === 0) {
    return {
      name: '复习计划',
      description: '间隔重复复习',
      chapters: [],
    }
  }

  const chapters = []
  for (let i = 0; i < words.length; i += CHAPTER_SIZE) {
    const chunk = words.slice(i, i + CHAPTER_SIZE)
    const idx = Math.floor(i / CHAPTER_SIZE)
    chapters.push({
      id: idx,
      name: `第 ${idx + 1} 章`,
      words: chunk,
    })
  }

  return {
    name: '复习计划',
    description: '间隔重复复习',
    chapters,
  }
}

export async function syncReviewCardsFromServer() {
  try {
    const data = await apiFetchReviewCards()
    const cards =
      data && typeof data === 'object' && data.cards && typeof data.cards === 'object'
        ? data.cards
        : {}
    // 服务端数据是权威版本：覆盖内存并取消待写的防抖，直接落盘
    _cache = cards
    persistNow()
    if (isMigrated()) {
      const items = Object.values(_cache)
      await idbClear('reviewCards')
      await idbBulkPut('reviewCards', items)
    }
  } catch (e) {
    console.warn('Sync review cards from server failed:', e)
  }
}
