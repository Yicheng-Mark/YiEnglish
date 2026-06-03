import { useMemo } from 'react'
import { DICT_PRIORITY, STOP_WORDS } from '../utils/wordColorMap.js'
import { findWordInMap } from '../../../utils/readingWordBook.js'

const PRIORITY_INDEX = (() => {
  const m = new Map()
  DICT_PRIORITY.forEach((id, idx) => m.set(id, idx))
  return m
})()

function pickPrimaryDict(dictIds) {
  if (!dictIds || dictIds.size === 0) return null
  let best = null
  let bestRank = Infinity
  for (const id of dictIds) {
    const rank = PRIORITY_INDEX.get(id) ?? Infinity
    if (rank < bestRank) {
      bestRank = rank
      best = id
    }
  }
  return best
}

// 从字幕英文中提取所有"有词典出处"的去重单词，按词典优先级排序
// 返回：[{ word, wordData, dictIds:Set<string>, primaryDictId:string|null }]
export function useWordExtractor({ subtitles, wordMap, dictSourcesMap }) {
  return useMemo(() => {
    if (!Array.isArray(subtitles) || subtitles.length === 0) return []
    if (!wordMap || wordMap.size === 0) return []

    const seen = new Map() // word -> { firstIndex, dictIds }

    for (let s = 0; s < subtitles.length; s++) {
      const en = subtitles[s]?.en
      if (!en) continue
      const re = /[a-zA-Z]+(?:['-][a-zA-Z0-9]+)*/g
      let m
      while ((m = re.exec(en)) !== null) {
        const w = m[0].toLowerCase().replace(/[^a-z'-]/g, '')
        if (!w || w.length < 3) continue
        if (STOP_WORDS.has(w)) continue
        if (!findWordInMap(w, wordMap)) continue
        if (!seen.has(w)) {
          const dictIds = dictSourcesMap?.get(w) ?? new Set()
          seen.set(w, { firstIndex: s, dictIds })
        }
      }
    }

    const out = []
    for (const [word, info] of seen.entries()) {
      out.push({
        word,
        wordData: findWordInMap(word, wordMap) || { name: word, trans: [] },
        dictIds: info.dictIds,
        primaryDictId: pickPrimaryDict(info.dictIds),
        firstIndex: info.firstIndex,
      })
    }

    // 排序：先按优先级（更难的在前），再按出现顺序
    out.sort((a, b) => {
      const ra = a.primaryDictId ? (PRIORITY_INDEX.get(a.primaryDictId) ?? Infinity) : Infinity
      const rb = b.primaryDictId ? (PRIORITY_INDEX.get(b.primaryDictId) ?? Infinity) : Infinity
      if (ra !== rb) return ra - rb
      return a.firstIndex - b.firstIndex
    })

    return out
  }, [subtitles, wordMap, dictSourcesMap])
}
