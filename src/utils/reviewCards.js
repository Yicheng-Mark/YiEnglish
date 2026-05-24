import { apiFetchReviewCards, apiUpsertReviewCards, apiAddReviewCard } from '../lib/api-review'

const STORAGE_KEY = 'lingoforge_review_cards'
const DAY_MS = 24 * 60 * 60 * 1000
const CHAPTER_SIZE = 25

let dictWordMap = null

async function buildDictWordMap() {
  if (dictWordMap) return dictWordMap
  dictWordMap = new Map()
  const dictIds = ['junior', 'zhongkao', 'senior', 'gaokao', 'cet4', 'cet4freq', 'cet6', 'cet6freq', 'tem4', 'tem8', 'ielts', 'toefl', 'sat', 'postgraduate', 'postgraduateCore', 'programmer']
  for (const id of dictIds) {
    try {
      const mod = await import(`../dictionaries/${id}.json`)
      const dict = mod.default ?? mod
      dict.chapters?.forEach((ch) => {
        ch.words?.forEach((w) => {
          if (w?.name) dictWordMap.set(w.name.toLowerCase(), w)
        })
      })
    } catch { /* ignore */ }
  }
  return dictWordMap
}

function getCards() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : { cards: {} }
  } catch {
    return { cards: {} }
  }
}

function saveCards(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function addWordToReview(wordName, dictId) {
  try {
    const data = getCards()
    if (data.cards[wordName]) return
    data.cards[wordName] = {
      wordName,
      dictId,
      nextReview: Date.now() + DAY_MS,
      interval: 1,
      easeFactor: 2.5,
      repetitions: 0,
      lastReviewAt: null,
      lastQuality: null,
    }
    saveCards(data)

    apiAddReviewCard(wordName, dictId).catch(e => console.warn('Sync review add failed:', e))
  } catch (e) {
    console.error('Failed to add word to review:', e)
  }
}

export function updateReviewCard(wordName, quality) {
  try {
    const data = getCards()
    const card = data.cards[wordName]
    if (!card) return

    let { interval, easeFactor, repetitions } = card

    if (quality >= 3) {
      repetitions += 1
      if (quality === 5) {
        easeFactor = Math.max(1.3, easeFactor + 0.1)
      }
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

    saveCards(data)

    apiUpsertReviewCards([{ wordName, dictId: card.dictId, nextReview: card.nextReview, interval, easeFactor, repetitions, lastReviewAt: card.lastReviewAt, lastQuality: quality }]).catch(e => console.warn('Sync review update failed:', e))
  } catch (e) {
    console.error('Failed to update review card:', e)
  }
}

export function getDueReviewCount() {
  const data = getCards()
  const now = Date.now()
  return Object.values(data.cards).filter(c => c.nextReview <= now).length
}

export function getTotalReviewCount() {
  const data = getCards()
  return Object.keys(data.cards).length
}

export async function getDueReviewWords() {
  const data = getCards()
  const now = Date.now()
  const dueCards = Object.values(data.cards)
    .filter(c => c.nextReview <= now)
    .sort((a, b) => a.nextReview - b.nextReview)

  if (dueCards.length === 0) return []

  const map = await buildDictWordMap()
  return dueCards.map(card => {
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.warn('Sync review cards from server failed:', e)
  }
}
