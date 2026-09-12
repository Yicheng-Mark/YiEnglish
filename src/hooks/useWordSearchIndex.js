import { useCallback, useEffect, useRef, useState } from 'react'
import { dictionaryMeta as defaultDictionaryMeta } from '../dictionaries/meta.js'
import { loadDictionary as defaultLoadDictionary } from '../utils/loadDictionary.js'
import { loadWordIndex as defaultLoadWordIndex } from '../utils/dictWordMap.js'
import {
  buildWordIndex as defaultBuildWordIndex,
  searchWordIndex as defaultSearchWordIndex,
} from '../utils/wordIndex.js'

const DEFAULT_PRIORITY_IDS = ['cet4', 'cet6', 'gaokao', 'postgraduate', 'ielts']

// 从合并索引（word-index.json）构建与旧 buildWordIndex 同构的搜索条目：
// 每个单词 × 每部收录词典一条（保持旧实现多词典条目的结构与跳转能力），
// 章节信息取该词在该词典扁平词序中的首次出现位置——词典加载后经 25 词一章的
// rechunk，扁平序号 floor(pos/25) / pos%25 即 chapterId / wordIndex。
// 输出顺序与旧实现的追加顺序一致：优先词典在前，其余按 dictionaryMeta 顺序，
// 保证同长度同命中桶内的稳定排序结果不变。
function buildSearchEntriesFromWordIndex(index, dictionaryMeta, priorityIds) {
  const perDict = new Map() // dictId → entries[]
  for (const key in index) {
    const entry = index[key]
    if (!entry || typeof entry !== 'object' || !Array.isArray(entry.dictIds)) continue
    const word = entry.name || key
    const phonetic = entry.usphone || entry.ukphone || ''
    const definition = Array.isArray(entry.trans) ? entry.trans.join('；') : ''
    // 清洗音标符号后再拼接，提升搜索命中率（与旧 buildWordIndex 同式）
    const searchText = `${word} ${phonetic.replace(/[/[\]ˈˌ]/g, '')} ${definition}`.toLowerCase()
    for (let i = 0; i < entry.dictIds.length; i++) {
      const dictId = entry.dictIds[i]
      const loc = (Array.isArray(entry.locs) && entry.locs[i]) || [0, 0]
      const item = {
        word,
        // 预计算小写词名：搜索过滤与排序键都用它（与旧实现一致）
        wordLower: key,
        phonetic,
        definition,
        dictId,
        dictName: dictId,
        chapterIndex: loc[0],
        chapterId: loc[0],
        wordIndex: loc[1],
        searchText,
      }
      let arr = perDict.get(dictId)
      if (!arr) {
        arr = []
        perDict.set(dictId, arr)
      }
      arr.push(item)
    }
  }

  const orderedIds = [
    ...priorityIds,
    ...dictionaryMeta.map((meta) => meta.id).filter((id) => !priorityIds.includes(id)),
  ]
  const out = []
  for (const id of orderedIds) {
    const arr = perDict.get(id)
    if (arr) {
      // 补 dictName（词典显示名，仅 UI 展示用）
      const meta = dictionaryMeta.find((m) => m.id === id)
      if (meta) for (const item of arr) item.dictName = meta.name
      out.push(...arr)
    }
  }
  // 防御：索引里可能出现 meta 未注册的词典 id，追加避免静默丢失
  for (const [id, arr] of perDict) {
    if (!orderedIds.includes(id)) out.push(...arr)
  }
  return out
}

/**
 * Lazily builds the cross-dictionary search index after the first non-empty query.
 * Index construction deliberately has its own lifecycle: changing or clearing the
 * query must not cancel an in-flight build and leave the search permanently locked.
 *
 * 数据源：优先单请求拉取预生成合并索引（word-index.json，25 部词典去重合并）；
 * 失败（索引未部署/损坏）时回退旧的逐词典批量加载路径。
 */
export default function useWordSearchIndex(query, dependencies = {}) {
  const dictionaryMeta = dependencies.dictionaryMeta ?? defaultDictionaryMeta
  const loadDictionary = dependencies.loadDictionary ?? defaultLoadDictionary
  const loadWordIndex = dependencies.loadWordIndex ?? defaultLoadWordIndex
  const buildWordIndex = dependencies.buildWordIndex ?? defaultBuildWordIndex
  const searchWordIndex = dependencies.searchWordIndex ?? defaultSearchWordIndex
  const priorityIds = dependencies.priorityIds ?? DEFAULT_PRIORITY_IDS
  const batchSize = dependencies.batchSize ?? 4

  const indexRef = useRef([])
  const [indexedCount, setIndexedCount] = useState(0)
  const [results, setResults] = useState([])
  const [showResults, setShowResults] = useState(false)
  const [buildRequested, setBuildRequested] = useState(false)
  const [buildAttempt, setBuildAttempt] = useState(0)
  const [buildFailed, setBuildFailed] = useState(false)

  // Query/UI state is independent from the long-running index build below.
  useEffect(() => {
    const normalized = query.trim()
    if (!normalized) {
      setResults([])
      setShowResults(false)
      return
    }
    setShowResults(true)
    setBuildRequested(true)
  }, [query])

  useEffect(() => {
    if (!buildRequested) return undefined

    let cancelled = false
    setBuildFailed(false)

    const loadBatch = async (ids) => {
      const loaded = await Promise.all(ids.map((id) => loadDictionary(id).catch(() => null)))
      return loaded.filter(Boolean)
    }

    const appendIndex = (dictionaries) => {
      if (dictionaries.length === 0) return
      indexRef.current = indexRef.current.concat(buildWordIndex(dictionaries))
      setIndexedCount((count) => count + dictionaries.length)
    }

    ;(async () => {
      // 优先：单请求合并索引，一次建完全量搜索条目
      try {
        const index = await loadWordIndex()
        if (cancelled) return
        const entries = buildSearchEntriesFromWordIndex(index, dictionaryMeta, priorityIds)
        if (entries.length === 0) throw new Error('word-index 为空')
        indexRef.current = entries
        // 索引覆盖 meta 全部词典：一次性置满，搜索结果空态显示「未找到」而非「加载中」
        setIndexedCount(dictionaryMeta.length)
        return
      } catch {
        // 回退：旧全量逐词典批量路径（索引未部署/损坏时兜底）
      }

      const registeredIds = new Set(dictionaryMeta.map((meta) => meta.id))
      const prioritized = priorityIds.filter((id) => registeredIds.has(id))
      const priorityDictionaries = await loadBatch(prioritized)
      if (cancelled) return
      appendIndex(priorityDictionaries)

      const remaining = dictionaryMeta.filter((meta) => !prioritized.includes(meta.id))
      for (let index = 0; index < remaining.length; index += batchSize) {
        const batch = remaining.slice(index, index + batchSize)
        const dictionaries = await loadBatch(batch.map((meta) => meta.id))
        if (cancelled) return
        appendIndex(dictionaries)
      }

      if (!cancelled && indexRef.current.length === 0) {
        setBuildFailed(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    batchSize,
    buildAttempt,
    buildRequested,
    buildWordIndex,
    dictionaryMeta,
    loadDictionary,
    loadWordIndex,
    priorityIds,
  ])

  useEffect(() => {
    const normalized = query.trim()
    if (!normalized || indexRef.current.length === 0) return
    setResults(searchWordIndex(indexRef.current, normalized, 10))
  }, [indexedCount, query, searchWordIndex])

  const retry = useCallback(() => {
    indexRef.current = []
    setIndexedCount(0)
    setResults([])
    setBuildFailed(false)
    setBuildAttempt((attempt) => attempt + 1)
  }, [])

  return {
    results,
    showResults,
    setShowResults,
    indexedCount,
    buildFailed,
    retry,
  }
}
