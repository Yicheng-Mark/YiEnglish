import { memo, useMemo, useRef, useState, useCallback } from 'react'
import { Play, Pause, Eye, EyeOff } from 'lucide-react'
import { useCorpusContext } from '../../context/CorpusPlayerContext.jsx'
import { ColorizedText } from '../ColorizedToken.jsx'
import { tokenizeEnglish } from '../../utils/wordColorMap.js'

const cardStyle = {
  backgroundColor: 'var(--mobile-card-bg)',
  boxShadow: 'var(--mobile-card-shadow)',
  border: '1px solid var(--mobile-border)',
}

/* ── Swipe direction animation class ── */
let lastDirection = 'none'

function SmallCard({ item, onClick }) {
  if (!item) {
    return <div className="rounded-2xl p-3 min-h-[48px] opacity-30" style={cardStyle} />
  }
  return (
    <button
      type="button"
      onClick={() => onClick(item.id)}
      className="w-full text-left rounded-2xl p-3 active:opacity-70 transition-opacity"
      style={cardStyle}
    >
      <span
        className="text-sm leading-relaxed line-clamp-2"
        style={{ color: 'var(--mobile-text-secondary)' }}
      >
        {item.en}
      </span>
    </button>
  )
}

/* ── Dictation mode ── */
function DictationCard({ current }) {
  const [answer, setAnswer] = useState('')
  const [revealed, setRevealed] = useState(false)
  const inputRef = useRef(null)

  // Reset on sentence change
  const cueId = useRef(current?.id)
  if (current?.id !== cueId.current) {
    cueId.current = current?.id
    setAnswer('')
    setRevealed(false)
  }

  const playSentence = () => {
    // Seek to the current cue and play
    const el = document.querySelector('.mobile-corpus-reset video')
    if (el && current?.start != null) {
      el.currentTime = current.start
      el.play().catch(() => {})
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 py-3">
      {/* Play button */}
      <button
        type="button"
        onClick={playSentence}
        className="w-14 h-14 rounded-full flex items-center justify-center border-2"
        style={{
          borderColor: 'var(--mobile-primary)',
          backgroundColor: 'var(--mobile-primary-soft, rgba(88,86,214,0.08))',
        }}
        aria-label="播放句子"
      >
        <Play className="w-5 h-5" style={{ color: 'var(--mobile-primary)' }} fill="currentColor" />
      </button>
      <p className="text-xs" style={{ color: 'var(--mobile-text-secondary)' }}>
        点击播放，听写句子
      </p>

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="输入你听到的句子..."
        className="w-full px-4 py-3.5 rounded-xl outline-none text-base"
        style={{
          border: '1.5px solid var(--mobile-border)',
          backgroundColor: 'var(--mobile-card-bg)',
          color: 'var(--mobile-text)',
          fontSize: 16, // prevent iOS zoom
        }}
      />

      {/* Answer reveal */}
      {revealed && (
        <div
          className="w-full p-4 rounded-xl"
          style={{
            backgroundColor: 'var(--mobile-answer-bg, #f0fdf4)',
            border: '1px solid var(--mobile-answer-border, #bbf7d0)',
          }}
        >
          <p className="text-xs font-semibold mb-1" style={{ color: '#16a34a' }}>
            参考答案
          </p>
          <p className="text-base" style={{ color: 'var(--mobile-text)' }}>
            {current?.en}
          </p>
        </div>
      )}

      {/* Reveal button */}
      <button
        type="button"
        onClick={() => setRevealed((v) => !v)}
        className="w-full py-3 rounded-xl text-sm font-semibold transition-colors"
        style={{
          backgroundColor: revealed ? 'var(--mobile-border)' : 'var(--mobile-primary)',
          color: revealed ? 'var(--mobile-text)' : '#fff',
        }}
      >
        {revealed ? '隐藏答案' : '显示答案'}
      </button>
    </div>
  )
}

/* ── Translation mode (Chinese → English) ── */
function TranslateCard({ current }) {
  const [answer, setAnswer] = useState('')
  const [revealed, setRevealed] = useState(false)

  const cueId = useRef(current?.id)
  if (current?.id !== cueId.current) {
    cueId.current = current?.id
    setAnswer('')
    setRevealed(false)
  }

  return (
    <div className="flex flex-col gap-4 py-2">
      <p className="text-base leading-relaxed" style={{ color: 'var(--mobile-text-secondary)' }}>
        {current?.zh}
      </p>
      <input
        type="text"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="将中文翻译成英文..."
        className="w-full px-4 py-3.5 rounded-xl outline-none text-base"
        style={{
          border: '1.5px solid var(--mobile-border)',
          backgroundColor: 'var(--mobile-card-bg)',
          color: 'var(--mobile-text)',
          fontSize: 16,
        }}
      />
      {revealed && (
        <div
          className="w-full p-4 rounded-xl"
          style={{
            backgroundColor: 'var(--mobile-answer-bg, #f0fdf4)',
            border: '1px solid var(--mobile-answer-border, #bbf7d0)',
          }}
        >
          <p className="text-xs font-semibold mb-1" style={{ color: '#16a34a' }}>
            参考答案
          </p>
          <p className="text-base" style={{ color: 'var(--mobile-text)' }}>
            {current?.en}
          </p>
        </div>
      )}
      <button
        type="button"
        onClick={() => setRevealed((v) => !v)}
        className="w-full py-3 rounded-xl text-sm font-semibold transition-colors"
        style={{
          backgroundColor: revealed ? 'var(--mobile-border)' : 'var(--mobile-primary)',
          color: revealed ? 'var(--mobile-text)' : '#fff',
        }}
      >
        {revealed ? '隐藏答案' : '显示答案'}
      </button>
    </div>
  )
}

/* ── Vocab / Flashcard mode ── */
function VocabCard({ current }) {
  const [revealed, setRevealed] = useState(false)

  const cueId = useRef(current?.id)
  if (current?.id !== cueId.current) {
    cueId.current = current?.id
    setRevealed(false)
  }

  return (
    <div
      className="flex flex-col items-center py-8 cursor-pointer select-none"
      onClick={() => setRevealed((v) => !v)}
    >
      <p className="text-xl font-medium text-center leading-relaxed" style={{ color: 'var(--mobile-text)' }}>
        {current?.en}
      </p>
      {revealed && (
        <p
          className="text-base mt-4 text-center leading-relaxed"
          style={{ color: 'var(--mobile-text-secondary)' }}
        >
          {current?.zh}
        </p>
      )}
      <p className="text-xs mt-6" style={{ color: 'var(--mobile-border)' }}>
        点击{revealed ? '隐藏' : '查看'}翻译
      </p>
    </div>
  )
}

/* ── Cloze text helper ── */
function ClozeText({ text, paraKey, posMap, onWordClick, showColor }) {
  const tokens = tokenizeEnglish(text)
  const clozeCount = Math.max(1, Math.floor(tokens.filter((t) => t.isWord).length * 0.25))
  const clozeSet = new Set()
  const wordIndices = tokens.map((t, i) => (t.isWord ? i : -1)).filter((i) => i >= 0)
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

/* ── Main card component with swipe animation ── */
function MobileSentenceCardsInner({ displayMode, focusMode }) {
  const { subtitles, player, posMap, wordMap, settings, handleWordClick, mode } =
    useCorpusContext()

  const showEn = displayMode !== 'chinese'
  const showZh = displayMode !== 'english'
  const showColor = settings?.posHighlight

  const [touchState, setTouchState] = useState({ startX: 0, tracking: false, delta: 0 })
  const [swipeAnim, setSwipeAnim] = useState(null) // 'left' | 'right' | null
  const SWIPE_THRESHOLD = 60

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
    return {
      prev: null,
      current: subtitles[0],
      next: subtitles.length > 1 ? subtitles[1] : null,
    }
  }, [subtitles, player.activeId])

  const handleTouchStart = useCallback((e) => {
    const t = e.touches[0]
    setTouchState({ startX: t.clientX, tracking: true, delta: 0 })
    setSwipeAnim(null)
  }, [])

  const handleTouchMove = useCallback((e) => {
    if (!touchState.tracking) return
    const delta = e.touches[0].clientX - touchState.startX
    setTouchState((s) => ({ ...s, delta }))
  }, [touchState.tracking, touchState.startX])

  const handleTouchEnd = useCallback(() => {
    if (!touchState.tracking) return
    const { delta } = touchState
    if (delta > SWIPE_THRESHOLD) {
      setSwipeAnim('right')
      player.prevCue()
    } else if (delta < -SWIPE_THRESHOLD) {
      setSwipeAnim('left')
      player.nextCue()
    }
    setTouchState({ startX: 0, tracking: false, delta: 0 })
    // Clear animation class after transition
    setTimeout(() => setSwipeAnim(null), 300)
  }, [touchState, player])

  if (!current) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-sm" style={{ color: 'var(--mobile-text-secondary)' }}>
          字幕加载中…
        </span>
      </div>
    )
  }

  // Determine animation class for the current card
  let animClass = ''
  if (swipeAnim === 'left') animClass = 'mobile-slide-in-right'
  else if (swipeAnim === 'right') animClass = 'mobile-slide-in-left'

  const cardTranslateX = touchState.tracking ? touchState.delta : 0
  const cardTransition = touchState.tracking ? 'none' : 'transform 200ms ease-out, opacity 200ms ease-out'

  // Focus mode card style override
  const focusCardStyle = focusMode
    ? {
        ...cardStyle,
        backgroundColor: 'var(--mobile-focus-card-bg, rgba(88,86,214,0.06))',
        borderColor: 'var(--mobile-primary-soft, rgba(88,86,214,0.2))',
        boxShadow: '0 2px 12px var(--mobile-card-shadow)',
      }
    : { ...cardStyle, boxShadow: '0 2px 12px var(--mobile-card-shadow)' }

  // Render mode-specific content
  const renderCardContent = () => {
    switch (mode) {
      case 'dictation':
        return <DictationCard current={current} />
      case 'translate':
        return <TranslateCard current={current} />
      case 'vocab':
        return <VocabCard current={current} />
      default:
        // bilingual / english / chinese / cloze / reading
        return (
          <>
            {/* Sentence index */}
            <div className="flex items-center justify-between mb-3">
              <span
                className="text-xs font-mono tabular-nums"
                style={{ color: 'var(--mobile-text-secondary)' }}
              >
                {player.cueIndex || 0} / {player.cueTotal || 0}
              </span>
            </div>

            {/* English with POS colors */}
            {showEn && current.en && (
              <div
                className={`leading-[1.7] font-medium mb-3 ${focusMode ? 'text-2xl' : 'text-xl'}`}
                style={{ color: 'var(--mobile-text)' }}
              >
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
          </>
        )
    }
  }

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="contents"
    >
      {/* Previous sentence */}
      <SmallCard item={prev} onClick={player.jumpToCue} />

      {/* Current sentence — with swipe animation */}
      <div
        className={`rounded-2xl p-5 ${animClass}`}
        style={{
          ...focusCardStyle,
          transform: `translateX(${cardTranslateX}px)`,
          transition: cardTransition,
        }}
      >
        {renderCardContent()}
      </div>

      {/* Next sentence */}
      <SmallCard item={next} onClick={player.jumpToCue} />
    </div>
  )
}

export default memo(MobileSentenceCardsInner)
