// 词典词表 Map 的共享构建器。
// 原实现曾在 reviewCards / corpusWordBook / readingWordBook 三处逐字重复，
// 抽出为单一模块；并发调用共享同一次加载，全部词典加载失败时不缓存（下次调用可重试）。
import { loadDictionary } from './loadDictionary.js'

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
  'ieltsfreq',
  'toefl',
  'toeflfreq',
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
    // 并行加载，且经 loadDictionary 复用全局缓存（与打字页/首页搜索共享，避免重复下载与解析）
    const dicts = await Promise.all(DICT_IDS.map((id) => loadDictionary(id).catch(() => null)))
    const map = new Map()
    for (const dict of dicts) {
      dict?.chapters?.forEach((ch) => {
        ch.words?.forEach((w) => {
          // first-wins：核心词典排在 freq 高频词表之前，超高频常用词保留核心词典的完整释义
          if (w?.name && !map.has(w.name.toLowerCase())) map.set(w.name.toLowerCase(), w)
        })
      })
    }
    // 全部加载失败（map 为空）时不缓存，让下次调用重试
    if (map.size > 0) dictWordMap = map
    return map
  })().finally(() => {
    loadingPromise = null
  })

  return loadingPromise
}
