import { loadErrorBookAsDictionary } from './errorBook.js'
import { loadReadingWordBookAsDictionary, enrichReadingWordBook } from './readingWordBook.js'
import { loadCorpusWordBookAsDictionary, enrichCorpusWordBook } from './corpusWordBook.js'
import { loadFavoriteWordsAsDictionary } from './favoriteWords.js'
import { loadReviewAsDictionary } from './reviewCards.js'

// 字典 JSON 已移至 public/dictionaries/，按需 fetch（不再打进 JS bundle）：
// 既缩小构建产物（省去 legacy 双份），又能被浏览器/CDN 长缓存、单独缓存。
// BASE_URL 适配非根路径部署。
async function fetchDictionary(id) {
  const res = await fetch(`${import.meta.env.BASE_URL}dictionaries/${id}.json`)
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
  toefl: () => fetchDictionary('toefl'),
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
  const mod = await loader()
  const data = mod.default ?? mod
  const result = noCacheIds.has(id) ? data : rechunkDictionary(data)
  if (!noCacheIds.has(id)) cache.set(id, result)
  return result
}

export async function loadChapter(dictId, chapterId) {
  const dict = await loadDictionary(dictId)
  if (!dict) return null
  return dict.chapters.find((c) => c.id === Number(chapterId))
}
