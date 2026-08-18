// 词典词表 Map 的共享构建器。
// 原实现曾在 reviewCards / corpusWordBook / readingWordBook 三处逐字重复，
// 抽出为单一模块；并发调用共享同一次加载，全部词典加载失败时不缓存（下次调用可重试）。
const DICT_IDS = [
  'junior',
  'zhongkao',
  'senior',
  'gaokao',
  'cet4',
  'cet4freq',
  'cet6',
  'cet6freq',
  'tem4',
  'tem8',
  'ielts',
  'toefl',
  'sat',
  'postgraduate',
  'postgraduateCore',
  'programmer',
]

let dictWordMap = null
let loadingPromise = null

export function buildDictWordMap() {
  if (dictWordMap) return dictWordMap
  if (loadingPromise) return loadingPromise

  loadingPromise = (async () => {
    const map = new Map()
    for (const id of DICT_IDS) {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}dictionaries/${id}.json`)
        if (!res.ok) continue
        const dict = await res.json()
        dict.chapters?.forEach((ch) => {
          ch.words?.forEach((w) => {
            if (w?.name) map.set(w.name.toLowerCase(), w)
          })
        })
      } catch {
        // ignore missing dictionaries
      }
    }
    // 全部加载失败（map 为空）时不缓存，让下次调用重试
    if (map.size > 0) dictWordMap = map
    return map
  })().finally(() => {
    loadingPromise = null
  })

  return loadingPromise
}
