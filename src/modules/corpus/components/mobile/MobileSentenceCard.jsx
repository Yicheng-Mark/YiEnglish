import { memo, useMemo } from 'react'
import { useCorpusContext } from '../../context/CorpusPlayerContext.jsx'
import { ColorizedText } from '../ColorizedToken.jsx'
import { tokenizeEnglish } from '../../utils/wordColorMap.js'

const cardStyle = {
  backgroundColor: 'var(--mobile-card-bg)',
  boxShadow: 'var(--mobile-card-shadow)',
  border: '1px solid var(--mobile-border)',
}

function SmallCard({ item, onClick }) {
  if (!item) {
    return (
      <div
        className="rounded-2xl p-3 min-h-[48px] opacity-30"
        style={cardStyle}
      />
    )
  }
  return (
    <button
      type="button"
      onClick={() => onClick(item.id)}
      className="w-full text-left rounded-2xl p-3 active:opacity-70 transition-opacity"
      style={cardStyle}
    >
      <span className="text-sm leading-relaxed line-clamp-2" style={{ color: 'var(--mobile-text-secondary)' }}>
        {item.en}
      </span>
    </button>
  )
}

function MobileSentenceCardsInner({ displayMode }) {
  const { subtitles, player, posMap, wordMap, settings, handleWordClick, mode } =
    useCorpusContext()

  const showEn = displayMode !== 'chinese'
  const showZh = displayMode !== 'english'
  const showColor = settings?.posHighlight

  const { prev, current, next } = useMemo(() => {
    if (!subtitles?.length) return { prev: null, current: null, next: null }
    const idx = player.activeId
      ? subtitles.findIndex((s) => s.id === player.activeId)
      : -1
    if (idx >= 0) {
      return {
        prev: idx > 0 ? subtitles[idx - 1] : null,
        current: subtitles[idx],
        next: idx < subtitles.length - 1 ? subtitles[idx + 1] : null,
      }
    }
    // No active cue yet — preview first 3 subtitles
    return {
      prev: null,
      current: subtitles[0],
      next: subtitles.length > 1 ? subtitles[1] : null,
    }
  }, [subtitles, player.activeId])

  if (!current) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-sm" style={{ color: 'var(--mobile-text-secondary)' }}>
          字幕加载中…
        </span>
      </div>
    )
  }

  return (
    <>
      {/* Previous sentence — small, muted, clickable */}
      <SmallCard item={prev} onClick={player.jumpToCue} />

      {/* Current sentence — large, POS colors, main visual */}
      <div className="rounded-2xl p-5" style={{ ...cardStyle, boxShadow: '0 2px 12px var(--mobile-card-shadow)' }}>
        {/* Sentence index */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono tabular-nums" style={{ color: 'var(--mobile-text-secondary)' }}>
            {player.cueIndex || 0} / {player.cueTotal || 0}
          </span>
        </div>

        {/* English with POS colors */}
        {showEn && current.en && (
          <div className="text-xl leading-[1.7] font-medium mb-3" style={{ color: 'var(--mobile-text)' }}>
            {displayMode === 'cloze' ? (
              <ClozeText
                text={current.en}
                paraKey={`mobile-cloze-${current.id}`}
                posMap={posMap}
                onWordClick={handleWordClick}
                showColor={showColor}
              />
            ) : (
              <ColorizedText
                text={current.en}
                paraKey={`mobile-${current.id}`}
                posMap={posMap}
                onWordClick={handleWordClick}
                showColor={showColor}
              />
            )}
          </div>
        )}

        {/* Chinese translation */}
        {showZh && current.zh && (
          <div
            className={`leading-[1.6] ${showEn ? 'text-base' : 'text-lg font-semibold'}`}
            style={{ color: showEn ? 'var(--mobile-text-secondary)' : 'var(--mobile-text)' }}
          >
            {current.zh}
          </div>
        )}
      </div>

      {/* Next sentence — small, muted, clickable */}
      <SmallCard item={next} onClick={player.jumpToCue} />
    </>
  )
}

function ClozeText({ text, paraKey, posMap, onWordClick, showColor }) {
  const tokens = tokenizeEnglish(text)
  const clozeCount = Math.max(1, Math.floor(tokens.filter((t) => t.isWord).length * 0.25))
  const clozeSet = new Set()
  const wordIndices = tokens
    .map((t, i) => (t.isWord ? i : -1))
    .filter((i) => i >= 0)
  for (let i = 0; i < Math.min(clozeCount, wordIndices.length); i++) {
    clozeSet.add(wordIndices[i])
  }
  return (
    <ColorizedText
      text={text}
      paraKey={paraKey}
      posMap={posMap}
      onWordClick={onWordClick}
      showColor={showColor}
      clozeIndices={clozeSet}
    />
  )
}

export default memo(MobileSentenceCardsInner)
