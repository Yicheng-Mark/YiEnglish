import { loadErrorBookAsDictionary } from './errorBook.js'
import { loadReadingWordBookAsDictionary, enrichReadingWordBook } from './readingWordBook.js'
import { loadCorpusWordBookAsDictionary, enrichCorpusWordBook } from './corpusWordBook.js'
import { loadFavoriteWordsAsDictionary } from './favoriteWords.js'
import { loadReviewAsDictionary } from './reviewCards.js'
import { fetchWithAuth } from '../lib/api'

// 词库 JSON 经 /api/dictionaries 认证下发（server/routes/content.js）：
// 不打进 JS bundle 的初衷不变（按需加载 + 单独缓存），同时未登录访客无法
// 整包拉走词库数据，体验用户只拿到前 5 章的裁剪版。fetchWithAuth 自带
// access token 过期时的静默刷新重试，页面加载早期不会误报加载失败。
async function fetchDictionary(id) {
  const res = await fetchWithAuth(`${import.meta.env.BASE_URL}api/dictionaries/${id}.json`)
  if (!res.ok) throw new Error(`Failed to load dictionary ${id}: ${res.status}`)
  return { default: await res.json() }
}

const loaders = {
  junior: () => fetchDictionary('junior'),
  zhongkao: () => fetchDictionary('zhongkao'),
  senior: () => fetchDictionary('senior'),
  gaokao: () => fetchDictionary('gaokao'),
  cet4: () => fetchDictionary('cet4'),
  cet4freq: () => fetchDictionary('cet4freq'),
  cet6: () => fetchDictionary('cet6'),
  cet6freq: () => fetchDictionary('cet6freq'),
  tem4: () => fetchDictionary('tem4'),
  tem8: () => fetchDictionary('tem8'),
  ielts: () => fetchDictionary('ielts'),
  ieltsfreq: () => fetchDictionary('ieltsfreq'),
  toefl: () => fetchDictionary('toefl'),
  toeflfreq: () => fetchDictionary('toeflfreq'),
  sat: () => fetchDictionary('sat'),
  postgraduate: () => fetchDictionary('postgraduate'),
  postgraduateCore: () => fetchDictionary('postgraduateCore'),
  programmer: () => fetchDictionary('programmer'),
  nautical: () => fetchDictionary('nautical'),
  business: () => fetchDictionary('business'),
  automotive: () => fetchDictionary('automotive'),
  chef: () => fetchDictionary('chef'),
  electrician: () => fetchDictionary('electrician'),
  marine_engineering: () => fetchDictionary('marine_engineering'),
  foreign_trade: () => fetchDictionary('foreign_trade'),
  'error-book': () => Promise.resolve({ default: loadErrorBookAsDictionary() }),
  'reading-word-book': async () => {
    await enrichReadingWordBook()
    return { default: loadReadingWordBookAsDictionary() }
  },
  'corpus-word-book': async () => {
    await enrichCorpusWordBook()
    return { default: loadCorpusWordBookAsDictionary() }
  },
  'favorite-words': () => Promise.resolve({ default: loadFavoriteWordsAsDictionary() }),
  review: () => loadReviewAsDictionary().then((d) => ({ default: d })),
}

const cache = new Map()
// in-flight 去重：并发调用同一词典共享同一次 fetch + JSON.parse。
// 首页 hover 预取与搜索批量建索引并发时，避免同一多 MB JSON 被拉取解析两遍。
const pending = new Map()

const noCacheIds = new Set([
  'error-book',
  'reading-word-book',
  'corpus-word-book',
  'favorite-words',
  'review',
])

const CHAPTER_SIZE = 25

function rechunkDictionary(data) {
  const allWords = data.chapters.flatMap((c) => c.words)
  if (allWords.length === 0) return data

  const chapters = []
  for (let i = 0; i < allWords.length; i += CHAPTER_SIZE) {
    const chunk = allWords.slice(i, i + CHAPTER_SIZE)
    const idx = Math.floor(i / CHAPTER_SIZE)
    chapters.push({
      id: idx,
      name: `第 ${idx + 1} 章`,
      words: chunk,
    })
  }

  return { ...data, chapters, totalChapters: chapters.length }
}

export function isCached(id) {
  return cache.has(id)
}
export function getCached(id) {
  return cache.get(id) || null
}

export async function loadDictionary(id) {
  if (!noCacheIds.has(id) && cache.has(id)) return cache.get(id)
  const loader = loaders[id]
  if (!loader) return null
  // 功能词本（noCacheIds）每次都要新鲜数据，不做 in-flight 共享
  if (!noCacheIds.has(id) && pending.has(id)) return pending.get(id)
  const load = (async () => {
    const mod = await loader()
    const data = mod.default ?? mod
    return noCacheIds.has(id) ? data : rechunkDictionary(data)
  })()
  if (!noCacheIds.has(id)) {
    pending.set(id, load)
    load
      .then((result) => cache.set(id, result))
      // 失败不进缓存，允许下次重试（如瞬时断网恢复后）
      .catch(() => {})
      .finally(() => pending.delete(id))
  }
  return load
}

export async function loadChapter(dictId, chapterId) {
  const dict = await loadDictionary(dictId)
  if (!dict) return null
  return dict.chapters.find((c) => c.id === Number(chapterId))
}
