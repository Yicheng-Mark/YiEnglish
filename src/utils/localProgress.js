const PROGRESS_KEY = 'lf_progress'

export function saveLocalProgress(dictId, chapterId, words) {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    const data = raw ? JSON.parse(raw) : {}
    const key = `${dictId}:${chapterId}`
    if (!data[key]) data[key] = []
    const set = new Set(data[key])
    for (const w of words) set.add(w)
    data[key] = [...set]
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(data))
  } catch (e) {
    console.warn('[localProgress] save error', e)
  }
}

export function getLocalProgress(dictId) {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (!raw) return {}
    const data = JSON.parse(raw)
    const chapters = {}
    for (const [key, words] of Object.entries(data)) {
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
