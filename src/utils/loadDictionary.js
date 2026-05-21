import { loadErrorBookAsDictionary } from './errorBook.js';
import { loadReadingWordBookAsDictionary, enrichReadingWordBook } from './readingWordBook.js';
import { loadCorpusWordBookAsDictionary, enrichCorpusWordBook } from './corpusWordBook.js';
import { loadFavoriteWordsAsDictionary } from './favoriteWords.js';
import { loadReviewAsDictionary } from './reviewCards.js';

const loaders = {
  junior: () => import('../dictionaries/junior.json'),
  zhongkao: () => import('../dictionaries/zhongkao.json'),
  senior: () => import('../dictionaries/senior.json'),
  gaokao: () => import('../dictionaries/gaokao.json'),
  cet4: () => import('../dictionaries/cet4.json'),
  cet4freq: () => import('../dictionaries/cet4freq.json'),
  cet6: () => import('../dictionaries/cet6.json'),
  cet6freq: () => import('../dictionaries/cet6freq.json'),
  tem4: () => import('../dictionaries/tem4.json'),
  tem8: () => import('../dictionaries/tem8.json'),
  ielts: () => import('../dictionaries/ielts.json'),
  toefl: () => import('../dictionaries/toefl.json'),
  sat: () => import('../dictionaries/sat.json'),
  postgraduate: () => import('../dictionaries/postgraduate.json'),
  postgraduateCore: () => import('../dictionaries/postgraduateCore.json'),
  programmer: () => import('../dictionaries/programmer.json'),
  nautical: () => import('../dictionaries/nautical.json'),
  business: () => import('../dictionaries/business.json'),
  automotive: () => import('../dictionaries/automotive.json'),
  chef: () => import('../dictionaries/chef.json'),
  electrician: () => import('../dictionaries/electrician.json'),
  'error-book': () => Promise.resolve({ default: loadErrorBookAsDictionary() }),
  'reading-word-book': async () => {
    await enrichReadingWordBook();
    return { default: loadReadingWordBookAsDictionary() };
  },
  'corpus-word-book': async () => {
    await enrichCorpusWordBook();
    return { default: loadCorpusWordBookAsDictionary() };
  },
  'favorite-words': () => Promise.resolve({ default: loadFavoriteWordsAsDictionary() }),
  'review': () => loadReviewAsDictionary().then(d => ({ default: d })),
}

const cache = new Map()

const noCacheIds = new Set(['error-book', 'reading-word-book', 'corpus-word-book', 'favorite-words', 'review'])

const CHAPTER_SIZE = 25

function rechunkDictionary(data) {
  const allWords = data.chapters.flatMap(c => c.words)
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

export function isCached(id) { return cache.has(id) }
export function getCached(id) { return cache.get(id) || null }

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
