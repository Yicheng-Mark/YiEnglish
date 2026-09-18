// 词典词表 Map 的共享构建器。
// 原实现曾在 reviewCards / corpusWordBook / readingWordBook 三处逐字重复，
// 抽出为单一模块；并发调用共享同一次加载，全部词典加载失败时不缓存（下次调用可重试）。
//
// 数据源：优先拉取 scripts/gen-word-index.mjs 预生成的合并索引 word-index.json
//（单请求替代词典的全量下载与主线程解析，去重后体积约为源词典的 1/3）。
// 索引缺失/损坏时回退旧全量路径，保证与词典 JSON 的部署节奏不同步时功能不受影响。
import { loadDictionary } from './loadDictionary.js'
import { fetchWithAuth } from '../lib/api'

// 25 部词典全量白名单。此前只列 18 部主词典，漏了 7 部专业词典：索引里约 39%
// 的词条只存在于专业词典，复习计划词本（存词名+dictId，出题时反查释义）取不到
// trans → 选择题出现空白题干/空白选项。追加在尾部：18 部主词典仍 first-wins 优先。
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
  'nautical',
  'marine_engineering',
  'automotive',
  'electrician',
  'business',
  'foreign_trade',
  'chef',
]

let dictWordMap = null
let loadingPromise = null

// —— 合并索引（word-index.json）路径 ——————————————————————

let wordIndexCache = null
let wordIndexPending = null

// 拉取预生成索引。模块级缓存：语料播放器/共享词表/首页搜索/阅读页共享同一次 fetch + parse。
// 经 /api/dictionaries 认证下发：正式账号拿全量 word-index.json，体验用户由服务端
// 换发体验版 word-index-trial.json（对前端透明，路径不变）。
export function loadWordIndex() {
  if (wordIndexCache) return Promise.resolve(wordIndexCache)
  if (wordIndexPending) return wordIndexPending
  wordIndexPending = (async () => {
    const res = await fetchWithAuth(`${import.meta.env.BASE_URL}api/dictionaries/word-index.json`)
    if (!res.ok) throw new Error(`Failed to load word-index: ${res.status}`)
    const data = await res.json()
    // 形状校验：必须是普通对象。404 页面 HTML / 意外 JSON / 空数组都在这里失败 → 走 fallback
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('word-index.json 结构非法')
    }
    wordIndexCache = data
    return data
  })()
  // 失败不缓存（含索引文件未部署的 404），后续调用重试或直接走 fallback
  wordIndexPending.catch(() => {
    wordIndexPending = null
  })
  return wordIndexPending
}

// 索引条目 → 与原词典 word 对象同构的字段子集。
// 消费方（findWordInMap / WordPopup / enrich*）只读 name/usphone/ukphone/us/uk/trans。
export function indexEntryToWord(key, entry) {
  const word = { name: entry.name || key, trans: entry.trans }
  if (entry.usphone) word.usphone = entry.usphone
  if (entry.ukphone) word.ukphone = entry.ukphone
  if (entry.us) word.us = entry.us
  if (entry.uk) word.uk = entry.uk
  return word
}

// 该词是否被 dictIds 中的任一词典收录（entry.alt 时 dictIds 不含 alt 侧词典，
// 但 alt 仅出现在「主词典是该消费方没有的 postgraduateCore」场景，见生成脚本说明）
function entryCoversDict(entry, dictIdSet) {
  return Array.isArray(entry.dictIds) && entry.dictIds.some((id) => dictIdSet.has(id))
}

// 从合并索引构建词表 Map：只收录 DICT_IDS 白名单词典中的词，条目字段即索引主条目
//（首个含词词典胜出，与旧路径 first-wins 语义一致）
export function buildDictWordMapFromIndex(index) {
  const dictIdSet = new Set(DICT_IDS)
  const map = new Map()
  for (const key in index) {
    const entry = index[key]
    if (!entry || typeof entry !== 'object' || !entryCoversDict(entry, dictIdSet)) continue
    map.set(key, indexEntryToWord(key, entry))
  }
  return map
}

// 旧实现：全量拉取 18 部词典按迭代序 first-wins 合并。
// 保留导出：既作 word-index.json 不可用时的 fallback，也供「索引优先级与旧路径等价」测试对拍。
export async function buildDictWordMapFromDicts() {
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
  return map
}

export function buildDictWordMap() {
  if (dictWordMap) return dictWordMap
  if (loadingPromise) return loadingPromise

  loadingPromise = (async () => {
    try {
      // 优先单请求合并索引
      const index = await loadWordIndex()
      const map = buildDictWordMapFromIndex(index)
      if (map.size > 0) dictWordMap = map
      return map
    } catch {
      // 回退旧全量路径（内部含「全失败不缓存」的既有语义）
      const map = await buildDictWordMapFromDicts()
      if (map.size > 0) dictWordMap = map
      return map
    }
  })().finally(() => {
    loadingPromise = null
  })

  return loadingPromise
}
