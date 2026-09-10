/**
 * 构建跨词库的单词索引，用于全局单词搜索
 */
export function buildWordIndex(dictionaries) {
  if (!Array.isArray(dictionaries)) return []

  const index = []

  dictionaries.forEach((dict) => {
    if (!dict?.chapters) return

    dict.chapters.forEach((chapter, chapterIdx) => {
      if (!chapter?.words) return

      chapter.words.forEach((wordObj, wordIdx) => {
        const word = wordObj.name || ''
        const phonetic = wordObj.usphone || wordObj.ukphone || ''
        const definition = Array.isArray(wordObj.trans) ? wordObj.trans.join('；') : ''

        if (!word) return

        index.push({
          word,
          // 预计算小写词名：搜索过滤与排序键都用它，避免热路径反复 toLowerCase/trim
          wordLower: word.trim().toLowerCase(),
          phonetic,
          definition,
          dictId: dict.id,
          dictName: dict.name,
          chapterIndex: chapterIdx,
          chapterId: chapter.id,
          wordIndex: wordIdx,
          // 清洗音标符号后再拼接，提升搜索命中率
          searchText:
            `${word} ${phonetic.replace(/[\/\[\]\ˈ\ˌ]/g, '')} ${definition}`.toLowerCase(),
        })
      })
    })
  })

  return index
}

/**
 * 在索引中搜索单词
 *
 * 单遍分桶实现（热路径优化）：
 * - 用 buildWordIndex 预计算的 searchText 一次 includes 完成命中判定
 *   （不再逐条 definition.split('；').map() 分配数组），清洗后的音标片段同样可命中
 * - 按优先级分桶收集，桶内只需按词长排序；逐桶补足 limit 即返回，
 *   不再对全量命中做 sort（旧实现在宽泛查询下要排序上万条中间对象）
 * - 输出顺序与旧实现（全量 filter + (priority, wordLength) 排序）完全一致
 */
export function searchWordIndex(index, query, limit = 10) {
  if (!query || query.trim().length === 0) return []
  const q = query.toLowerCase().trim()

  // 0=完全匹配 1=前缀匹配 2=子串匹配 3=释义/音标匹配
  const buckets = [[], [], [], []]
  for (const item of index) {
    const wordName = item.wordLower || ''
    let p
    if (wordName === q) p = 0
    else if (wordName.startsWith(q)) p = 1
    else if (wordName.includes(q)) p = 2
    else if (item.searchText && item.searchText.includes(q)) p = 3
    else continue
    buckets[p].push(item)
  }

  // 同桶内优先级相同，只需按词长升序（与旧比较器的第二键一致）
  const byLength = (a, b) => (a.wordLower || '').length - (b.wordLower || '').length
  const out = []
  for (let p = 0; p < 4 && out.length < limit; p++) {
    const bucket = buckets[p]
    if (bucket.length === 0) continue
    bucket.sort(byLength)
    for (const item of bucket) {
      if (out.length >= limit) break
      out.push(item)
    }
  }
  return out
}
