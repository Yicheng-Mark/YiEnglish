import { useMemo, useState } from 'react'
import { Volume2 } from 'lucide-react'
import { useCorpusContext } from '../../context/CorpusPlayerContext.jsx'
import WordBadge from '../WordBadge.jsx'
import { VOCAB_FILTER_KEYS, VOCAB_FILTER_GROUPS } from '../../utils/wordColorMap.js'
import { getWordRect } from '../../../../utils/wordTokenize.jsx'

function getFirstMeaning(trans) {
  if (!trans) return ''
  // 字符串格式：取第一个分号前的释义
  if (typeof trans === 'string') {
    const first = trans.split(';')[0].trim()
    return first.replace(/^\s*\[[^\]]+\]\s*/, '').trim()
  }
  if (!Array.isArray(trans) || trans.length === 0) return ''
  const first = String(trans[0] || '')
  return first.replace(/^\s*\[[^\]]+\]\s*/, '').trim()
}

export default function VocabCardMode() {
  const { extractedWords, handleWordClick, settings } = useCorpusContext()
  const [filter, setFilter] = useState('全部')

  const filtered = useMemo(() => {
    if (!extractedWords) return []
    const allowedDicts = VOCAB_FILTER_GROUPS[filter]
    if (!allowedDicts) return extractedWords
    return extractedWords.filter((item) =>
      Array.from(item.dictIds || []).some((id) => allowedDicts.includes(id))
    )
  }, [extractedWords, filter])

  return (
    <div className="h-full flex flex-col bg-surface dark:bg-white/[0.03] border border-gray-200/70 dark:border-white/[0.06] rounded-2xl shadow-sm overflow-hidden">
      {/* 筛选栏 */}
      <div className="shrink-0 px-3 md:px-4 py-2.5 border-b border-gray-200/70 dark:border-white/[0.06] flex items-center gap-1 overflow-x-auto">
        {VOCAB_FILTER_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full transition ${
              filter === k
                ? 'bg-primary text-white shadow-sm'
                : 'bg-gray-100 dark:bg-white/[0.06] text-content-secondary dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/[0.1]'
            }`}
          >
            {k}
          </button>
        ))}
        <span className="ml-auto text-xs text-content-tertiary dark:text-gray-500 tabular-nums">
          {filtered.length} 条
        </span>
      </div>

      {/* 单词列表 */}
      {filtered.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-content-tertiary dark:text-gray-500 p-6 text-center">
          {extractedWords?.length === 0 ? '暂无可识别词汇' : `当前筛选下没有"${filter}"难度的词汇`}
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto py-2">
          {filtered.map((item, idx) => {
            const meaning = getFirstMeaning(item.wordData?.trans)
            const phonetic = item.wordData?.usphone || item.wordData?.us || item.wordData?.ukphone || item.wordData?.uk || ''
            return (
              <button
                key={item.word}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleWordClick(item.word, getWordRect(e.currentTarget), e.currentTarget)
                }}
                className="w-full text-left flex items-center gap-3 px-3 md:px-4 py-2.5 hover:bg-gray-100/60 dark:hover:bg-white/[0.04] transition-colors border-b border-gray-100 dark:border-white/[0.04] last:border-b-0"
              >
                <span className="shrink-0 w-7 text-right text-xs text-content-tertiary dark:text-gray-500 tabular-nums">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-content dark:text-gray-100 truncate">
                      {item.word}
                    </span>
                    {settings.showPhonetic && phonetic && (
                      <span className="text-[11px] font-mono text-content-tertiary dark:text-gray-500 truncate">
                        /{phonetic}/
                      </span>
                    )}
                    <WordBadge dictId={item.primaryDictId} size="xs" />
                  </div>
                  {meaning && (
                    <div className="text-xs text-content-tertiary dark:text-gray-400 truncate">
                      {meaning}
                    </div>
                  )}
                </div>
                <Volume2 className="shrink-0 w-3.5 h-3.5 text-content-tertiary dark:text-gray-500" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
