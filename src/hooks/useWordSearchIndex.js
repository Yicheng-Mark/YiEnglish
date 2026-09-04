import { useCallback, useEffect, useRef, useState } from 'react'
import { dictionaryMeta as defaultDictionaryMeta } from '../dictionaries/meta.js'
import { loadDictionary as defaultLoadDictionary } from '../utils/loadDictionary.js'
import {
  buildWordIndex as defaultBuildWordIndex,
  searchWordIndex as defaultSearchWordIndex,
} from '../utils/wordIndex.js'

const DEFAULT_PRIORITY_IDS = ['cet4', 'cet6', 'gaokao', 'postgraduate', 'ielts']

/**
 * Lazily builds the cross-dictionary search index after the first non-empty query.
 * Index construction deliberately has its own lifecycle: changing or clearing the
 * query must not cancel an in-flight build and leave the search permanently locked.
 */
export default function useWordSearchIndex(query, dependencies = {}) {
  const dictionaryMeta = dependencies.dictionaryMeta ?? defaultDictionaryMeta
  const loadDictionary = dependencies.loadDictionary ?? defaultLoadDictionary
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
