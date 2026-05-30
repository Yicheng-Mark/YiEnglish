import { memo, useMemo } from 'react'
import { useCorpusContext } from '../context/CorpusPlayerContext.jsx'
import { tokenizeEnglish, POS_LABEL, getPosHighlightColor } from '../utils/wordColorMap.js'
import { buildPhonetic } from '../utils/buildPhonetic.js'

function HighlightedSentence({ text, posMap, onWordClick, posHighlight = true }) {
  if (!text) return null
  const tokens = tokenizeEnglish(text)
  return (
    <>
      {tokens.map((tok, i) => {
        if (!tok.isWord) {
          return <span key={`s-${i}`}>{tok.raw}</span>
        }
        const pos = posMap?.get(tok.lower) || 'unknown'
        const color = getPosHighlightColor(pos)
        const isKnown = posMap?.has(tok.lower)

        if (!isKnown || !posHighlight || !color) {
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
            className="pos-highlight cursor-pointer select-none"
            style={{ backgroundColor: color }}
            onClick={(e) => {
              e.stopPropagation()
              if (onWordClick) onWordClick(tok.lower, e.target.getBoundingClientRect(), e.target)
            }}
            title={POS_LABEL[pos] || pos}
          >
            {tok.raw}
          </span>
        )
      })}
    </>
  )
}

function CurrentSentencePanelInner() {
  const { subtitles, player, posMap, wordMap, settings, handleWordClick, mode } = useCorpusContext()
  const showEn = mode !== 'chinese' && mode !== 'translate'
  const showZh = mode !== 'english' && mode !== 'cloze'

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
        className="flex-1 min-h-[80px] rounded-2xl bg-surface dark:bg-white/[0.03] border border-gray-200/70 dark:border-white/[0.06] shadow-sm flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors"
      >
        <span className="text-sm text-content-secondary dark:text-gray-300">已隐藏字幕</span>
        <span className="text-xs text-content-tertiary dark:text-gray-500 mt-1">点击显示</span>
      </button>
    )
  }

  if (!current) {
    return (
      <div className="flex-1 min-h-[80px] rounded-2xl bg-surface/50 dark:bg-white/[0.03] border border-gray-200/70 dark:border-white/[0.06] flex items-center justify-center">
        <span className="text-sm text-content-tertiary dark:text-gray-500">等待播放...</span>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* 主卡片 */}
      <div className="flex-1 min-h-[80px] rounded-2xl bg-surface dark:bg-white/[0.03] border border-gray-200/70 dark:border-white/[0.06] shadow-sm p-4 md:p-5 flex flex-col gap-3">
        {/* 顶部信息栏 */}
        <div className="flex items-center justify-between text-xs text-content-tertiary dark:text-gray-400">
          <div className="flex items-center gap-3">
            <span className="tabular-nums">
              {player.cueIndex || 0} / {player.cueTotal || 0}
            </span>
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
                  posHighlight={settings?.posHighlight}
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
