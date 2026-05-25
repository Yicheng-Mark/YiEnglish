import { memo, useMemo } from 'react'
import { Heart, Mic, PenLine } from 'lucide-react'
import { useCorpusContext } from '../context/CorpusPlayerContext.jsx'
import { tokenizeEnglish, getPosColor } from '../utils/wordColorMap.js'
import { buildPhonetic } from '../utils/buildPhonetic.js'
import { useCorpusStore } from '../hooks/useCorpusStore.js'

function HighlightedSentence({ text, posMap, onWordClick }) {
  if (!text) return null
  const tokens = tokenizeEnglish(text)
  return (
    <>
      {tokens.map((tok, i) => {
        if (!tok.isWord) {
          return <span key={`s-${i}`}>{tok.raw}</span>
        }
        const pos = posMap?.get(tok.lower) || 'unknown'
        const color = getPosColor(pos)
        const isKnown = posMap?.has(tok.lower)

        if (!isKnown) {
          return (
            <span
              key={`s-${i}`}
              className="cursor-pointer select-none hover:opacity-80 transition-opacity"
              onClick={(e) => {
                e.stopPropagation()
                if (onWordClick) onWordClick(tok.lower, e.target.getBoundingClientRect(), e.target)
              }}
            >
              {tok.raw}
            </span>
          )
        }

        return (
          <span
            key={`s-${i}`}
            className="corpus-pos-pill cursor-pointer select-none"
            style={{ '--corpus-pos-color': color }}
            onClick={(e) => {
              e.stopPropagation()
              if (onWordClick) onWordClick(tok.lower, e.target.getBoundingClientRect(), e.target)
            }}
            title={pos}
          >
            {tok.raw}
          </span>
        )
      })}
    </>
  )
}

function CurrentSentencePanelInner() {
  const { subtitles, player, posMap, wordMap, settings, handleWordClick, videoId, mode } = useCorpusContext()
  const showEn = mode !== 'chinese' && mode !== 'translate'
  const showZh = mode !== 'english' && mode !== 'cloze'
  const { isBookmarked, toggleBookmark } = useCorpusStore()
  const liked = videoId ? isBookmarked(videoId) : false

  const current = useMemo(() => {
    if (!subtitles?.length || !player.activeId) return null
    return subtitles.find((s) => s.id === player.activeId) || null
  }, [subtitles, player.activeId])

  const phonetic = useMemo(
    () => (settings?.showPhonetic && current?.en ? buildPhonetic(current.en, wordMap) : ''),
    [current?.en, wordMap, settings?.showPhonetic]
  )

  if (player.hideSubtitleBottom) {
    return (
      <button
        type="button"
        onClick={player.toggleHideSubtitleBottom}
        className="flex-1 min-h-[120px] rounded-2xl bg-surface dark:bg-white/[0.03] border border-gray-200/70 dark:border-white/[0.06] shadow-sm flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors"
      >
        <span className="text-sm text-content-secondary dark:text-gray-300">已隐藏字幕</span>
        <span className="text-xs text-content-tertiary dark:text-gray-500 mt-1">点击显示</span>
      </button>
    )
  }

  if (!current) {
    return (
      <div className="flex-1 min-h-[120px] rounded-2xl bg-surface/50 dark:bg-white/[0.03] border border-gray-200/70 dark:border-white/[0.06] flex items-center justify-center">
        <span className="text-sm text-content-tertiary dark:text-gray-500">等待播放...</span>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* 主卡片 */}
      <div className="flex-1 min-h-[120px] rounded-2xl bg-surface dark:bg-white/[0.03] border border-gray-200/70 dark:border-white/[0.06] shadow-sm p-4 md:p-5 flex flex-col gap-3">
        {/* 顶部信息栏 */}
        <div className="flex items-center justify-between text-xs text-content-tertiary dark:text-gray-400">
          <div className="flex items-center gap-3">
            <span className="tabular-nums">
              {player.cueIndex || 0} / {player.cueTotal || 0}
            </span>
            <button
              type="button"
              onClick={() => videoId && toggleBookmark(videoId)}
              className="flex items-center hover:text-rose-500 transition-colors"
              title={liked ? '取消收藏' : '收藏'}
              aria-label={liked ? '取消收藏' : '收藏'}
            >
              <Heart
                className={`w-4 h-4 ${liked ? 'fill-rose-500 text-rose-500' : ''}`}
              />
            </button>
            <button
              type="button"
              className="flex items-center gap-1 hover:text-primary transition-colors"
              title="切换到听写"
            >
              <PenLine className="w-3.5 h-3.5" />
              <span>切换到听写</span>
            </button>
          </div>
          <div className="flex items-center gap-1">
            <span>录音:</span>
            <button
              type="button"
              className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100/60 dark:hover:bg-white/[0.06] hover:text-primary transition-colors"
              title="录音"
              aria-label="录音"
            >
              <Mic className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 英文+中文 居中区 */}
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
          {/* 整句音标 + 英文句子 */}
          {showEn && (
            <>
              {phonetic && (
                <div className="text-sm md:text-[15px] text-content-tertiary dark:text-gray-400 font-mono leading-relaxed">
                  {phonetic}
                </div>
              )}
              <div className="text-lg md:text-xl leading-relaxed text-content dark:text-gray-100">
                <HighlightedSentence
                  text={current.en}
                  posMap={posMap}
                  onWordClick={handleWordClick}
                />
              </div>
            </>
          )}

          {/* 中文翻译 */}
          {showZh && current.zh && (
            <div className={`leading-relaxed ${
              showEn
                ? 'text-sm md:text-base text-content-tertiary dark:text-gray-400'
                : 'text-lg md:text-xl text-content dark:text-gray-100 font-semibold'
            }`}>
              {current.zh}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default memo(CurrentSentencePanelInner)
