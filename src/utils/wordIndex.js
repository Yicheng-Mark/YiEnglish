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
 */
export function searchWordIndex(index, query, limit = 10) {
  if (!query || query.trim().length === 0) return []
  const q = query.toLowerCase().trim()

  const matched = index.filter((item) => {
    const wordName = item.wordLower || ''
    if (wordName.includes(q)) return true
    const transList = item.definition?.split('；').map((t) => t.trim().toLowerCase()) || []
    return transList.some((t) => t.includes(q))
  })

  const getPriority = (item) => {
    const wordName = item.wordLower || ''
    if (wordName === q) return 0 // 完全匹配
    if (wordName.startsWith(q)) return 1 // 前缀匹配
    if (wordName.includes(q)) return 2 // 子串匹配
    return 3 // 释义匹配
  }

  // 排序键预计算一次：比较器内做 toLowerCase/trim 是 O(m log m) 次重复字符串运算，
  // 索引达数万条时每个按键（防抖后）都要付出这笔开销
  const decorated = matched.map((item) => ({
    item,
    p: getPriority(item),
    l: (item.wordLower || '').length,
  }))
  decorated.sort((a, b) => a.p - b.p || a.l - b.l)

  return decorated.slice(0, limit).map((d) => d.item)
}
