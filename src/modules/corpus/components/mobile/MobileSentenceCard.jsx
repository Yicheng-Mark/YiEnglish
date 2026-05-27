import { memo, useMemo, useRef, useState, useCallback, useEffect } from 'react'
import { Play, Eye } from 'lucide-react'
import { useCorpusContext } from '../../context/CorpusPlayerContext.jsx'
import { ColorizedText } from '../ColorizedToken.jsx'
import { buildPhonetic } from '../../utils/buildPhonetic.js'
import { tokenizeEnglish, VOCAB_FILTER_KEYS, VOCAB_FILTER_GROUPS } from '../../utils/wordColorMap.js'
import { useAutoScrollList } from '../../hooks/useAutoScrollList.js'
import WordBadge from '../WordBadge.jsx'
import { getWordRect } from '../../../../utils/wordTokenize.jsx'

/* ── Swipe direction animation class ── */
let lastDirection = 'none'

/* ── Dictation mode ── */
function DictationCard({ current }) {
  const [answer, setAnswer] = useState('')
  const [revealed, setRevealed] = useState(false)
  const inputRef = useRef(null)

  const cueId = useRef(current?.id)
  if (current?.id !== cueId.current) {
    cueId.current = current?.id
    setAnswer('')
    setRevealed(false)
  }

  const playSentence = () => {
    const el = document.querySelector('.mobile-corpus-reset video')
    if (el && current?.start != null) {
      el.currentTime = current.start
      el.play().catch(() => {})
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 py-3">
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

function getFirstMeaning(trans) {
  if (!Array.isArray(trans) || trans.length === 0) return ''
  return String(trans[0] || '').replace(/^\s*\[[^\]]+\]\s*/, '').trim()
}

/* ── Main card component with scrollable list ── */
function MobileSentenceCardsInner({ focusMode }) {
  const { subtitles, player, posMap, wordMap, settings, handleWordClick, mode, extractedWords } =
    useCorpusContext()

  const showEn = mode !== 'chinese'
  const showZh = mode !== 'english'
  const showColor = settings?.posHighlight

  const phoneticArr = useMemo(() => {
    if (!settings?.showPhonetic || !subtitles?.length || !wordMap) return null
    return subtitles.map((s) => buildPhonetic(s.en, wordMap))
  }, [subtitles, wordMap, settings?.showPhonetic])

  // Auto-scroll to active subtitle
  const { setItemRef, containerProps } = useAutoScrollList(player.activeId, [subtitles])

  // Swipe gesture state
  const [touchState, setTouchState] = useState({ startX: 0, tracking: false, delta: 0 })
  const SWIPE_THRESHOLD = 60

  const handleTouchStart = useCallback((e) => {
    const t = e.touches[0]
    setTouchState({ startX: t.clientX, tracking: true, delta: 0 })
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
      player.prevCue()
    } else if (delta < -SWIPE_THRESHOLD) {
      player.nextCue()
    }
    setTouchState({ startX: 0, tracking: false, delta: 0 })
  }, [touchState, player])

  // For dictation mode: show single card with current subtitle
  const currentSub = useMemo(() => {
    if (!subtitles?.length) return null
    if (player.activeId) {
      return subtitles.find((s) => s.id === player.activeId) || subtitles[0]
    }
    return subtitles[0]
  }, [subtitles, player.activeId])

  // Translate mode: revealed sentences state
  const [trRevealed, setTrRevealed] = useState(() => new Set())

  useEffect(() => {
    if (mode !== 'translate' || player.activeId == null) return
    setTrRevealed((prev) => {
      if (prev.has(player.activeId)) return prev
      const next = new Set(prev)
      next.add(player.activeId)
      return next
    })
  }, [mode, player.activeId])

  const revealSentence = useCallback((id, e) => {
    e.stopPropagation()
    setTrRevealed((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  // Vocab mode: filter state
  const [vocabFilter, setVocabFilter] = useState('全部')

  const filteredWords = useMemo(() => {
    if (!extractedWords) return []
    const allowedDicts = VOCAB_FILTER_GROUPS[vocabFilter]
    if (!allowedDicts) return extractedWords
    return extractedWords.filter((item) =>
      Array.from(item.dictIds || []).some((id) => allowedDicts.includes(id))
    )
  }, [extractedWords, vocabFilter])

  // For mode-specific views (dictation)
  if (mode === 'dictation') {
    if (!currentSub) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-sm" style={{ color: 'var(--mobile-text-secondary)' }}>
            字幕加载中…
          </span>
        </div>
      )
    }

    return (
      <div
        className="flex-1 min-h-0 overflow-y-auto px-4 py-3"
        style={{ overscrollBehaviorY: 'contain', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="rounded-2xl p-5"
          style={{
            backgroundColor: 'var(--mobile-card-bg)',
            boxShadow: '0 2px 12px var(--mobile-card-shadow)',
            border: '1px solid var(--mobile-border)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span
              className="text-xs font-mono tabular-nums"
              style={{ color: 'var(--mobile-text-secondary)' }}
            >
              {player.cueIndex || 0} / {player.cueTotal || 0}
            </span>
          </div>
          <DictationCard current={currentSub} />
        </div>
      </div>
    )
  }

  // ── Translate mode (中译英): show Chinese, reveal English ──
  if (mode === 'translate') {
    if (!subtitles?.length) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-sm" style={{ color: 'var(--mobile-text-secondary)' }}>
            字幕加载中…
          </span>
        </div>
      )
    }

    return (
      <div
        className="flex-1 min-h-0 overflow-y-auto px-3 py-2"
        style={{ overscrollBehaviorY: 'contain', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {subtitles.map((sub) => {
          const isActive = player.activeId
            ? sub.id === player.activeId
            : sub.id === subtitles[0]?.id
          const showEn = trRevealed.has(sub.id)

          return (
            <div
              key={sub.id}
              ref={setItemRef(sub.id)}
              onClick={() => player.jumpToCue(sub.id)}
              className={`mobile-sub-item ${isActive ? 'mobile-sub-item-active' : 'mobile-sub-item-inactive'} mb-1`}
            >
              <p
                className={`leading-[1.7] ${isActive ? 'font-semibold text-base' : 'text-sm'}`}
                style={{ color: 'var(--mobile-text)' }}
              >
                {sub.zh || ''}
              </p>
              {!showEn && sub.en ? (
                <button
                  type="button"
                  onClick={(e) => revealSentence(sub.id, e)}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md mt-1 transition-colors"
                  style={{
                    backgroundColor: 'var(--mobile-border)',
                    color: 'var(--mobile-text-secondary)',
                  }}
                >
                  <Eye className="w-3 h-3" />
                  <span>显示英文</span>
                </button>
              ) : showEn && sub.en ? (
                <p
                  className="text-sm leading-snug mt-1"
                  style={{ color: isActive ? 'var(--mobile-primary)' : 'var(--mobile-text-secondary)', wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                >
                  <ColorizedText
                    text={sub.en}
                    paraKey={`tr-${sub.id}`}
                    posMap={posMap}
                    onWordClick={handleWordClick}
                    showColor={settings?.posHighlight}
                  />
                </p>
              ) : null}
            </div>
          )
        })}
      </div>
    )
  }

  // ── Vocab mode (词卡): word list extracted from corpus ──
  if (mode === 'vocab') {
    return (
      <div
        className="flex-1 min-h-0 flex flex-col overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Filter bar */}
        <div
          className="shrink-0 flex items-center gap-1 px-3 py-2 overflow-x-auto"
          style={{ borderBottom: '1px solid var(--mobile-border)', scrollbarWidth: 'none' }}
        >
          {VOCAB_FILTER_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setVocabFilter(k)}
              className="shrink-0 text-xs px-3 py-1.5 rounded-full transition"
              style={{
                backgroundColor: vocabFilter === k ? 'var(--mobile-primary)' : 'transparent',
                color: vocabFilter === k ? '#fff' : 'var(--mobile-text-secondary)',
                fontWeight: vocabFilter === k ? 600 : 400,
              }}
            >
              {k}
            </button>
          ))}
          <span
            className="ml-auto text-xs tabular-nums shrink-0"
            style={{ color: 'var(--mobile-text-secondary)' }}
          >
            {filteredWords.length} 条
          </span>
        </div>

        {/* Word list */}
        {filteredWords.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-6 text-center">
            <span className="text-sm" style={{ color: 'var(--mobile-text-secondary)' }}>
              {extractedWords?.length === 0 ? '暂无可识别词汇' : `没有"${vocabFilter}"难度的词汇`}
            </span>
          </div>
        ) : (
          <div
            className="flex-1 min-h-0 overflow-y-auto py-1"
            style={{ overscrollBehaviorY: 'contain', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}
          >
            {filteredWords.map((item, idx) => {
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
                  className="w-full text-left flex items-center gap-3 px-4 py-2.5 transition-colors"
                  style={{ borderBottom: '1px solid var(--mobile-border)' }}
                >
                  <span
                    className="shrink-0 w-6 text-right text-xs tabular-nums"
                    style={{ color: 'var(--mobile-text-secondary)' }}
                  >
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className="text-sm font-semibold truncate"
                        style={{ color: 'var(--mobile-text)' }}
                      >
                        {item.word}
                      </span>
                      {settings.showPhonetic && phonetic && (
                        <span
                          className="text-[11px] font-mono truncate"
                          style={{ color: 'var(--mobile-text-secondary)' }}
                        >
                          /{phonetic}/
                        </span>
                      )}
                      <WordBadge dictId={item.primaryDictId} size="xs" />
                    </div>
                    {meaning && (
                      <div
                        className="text-xs truncate"
                        style={{ color: 'var(--mobile-text-secondary)' }}
                      >
                        {meaning}
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Bilingual / reading mode: scrollable list of all subtitles
  if (!subtitles?.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-sm" style={{ color: 'var(--mobile-text-secondary)' }}>
          字幕加载中…
        </span>
      </div>
    )
  }

  return (
    <div
      className="flex-1 min-h-0 overflow-y-auto"
      style={{ overscrollBehaviorY: 'contain', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}
      onTouchStart={handleTouchStart}
      onTouchMove={(e) => {
        containerProps.onTouchMove(e)
        handleTouchMove(e)
      }}
      onScroll={containerProps.onScroll}
      onWheel={containerProps.onWheel}
    >
      {/* Cue counter */}
      <div className="flex items-center justify-end px-4 pt-3 pb-1">
        <span
          className="text-xs font-mono tabular-nums shrink-0"
          style={{ color: 'var(--mobile-text-secondary)' }}
        >
          {player.cueIndex || 0} / {player.cueTotal || 0}
        </span>
      </div>

      {/* Subtitle list */}
      <div className="px-3 py-1">
        {subtitles.map((sub, idx) => {
          const isActive = player.activeId
            ? sub.id === player.activeId
            : sub.id === subtitles[0]?.id

          return (
            <div
              key={sub.id}
              ref={setItemRef(sub.id)}
              onClick={() => player.jumpToCue(sub.id)}
              className={`mobile-sub-item ${isActive ? 'mobile-sub-item-active' : 'mobile-sub-item-inactive'} mb-1`}
            >
              {showEn && phoneticArr && phoneticArr[idx] && (
                <p
                  className={`font-mono break-all ${isActive ? 'text-xs mb-0.5' : 'text-[10px] mb-0.5'}`}
                  style={{ color: 'var(--mobile-text-secondary)', wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                >
                  {phoneticArr[idx]}
                </p>
              )}
              {showEn && sub.en && (
                <p
                  className={`leading-[1.7] ${isActive ? 'font-semibold text-base' : 'text-sm'}`}
                  style={{ color: 'var(--mobile-text)', wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                >
                  {mode === 'cloze' ? (
                    <ClozeText
                      text={sub.en}
                      paraKey={`mobile-cloze-${sub.id}`}
                      posMap={posMap}
                      onWordClick={handleWordClick}
                      showColor={showColor}
                    />
                  ) : (
                    <ColorizedText
                      text={sub.en}
                      paraKey={`mobile-${sub.id}`}
                      posMap={posMap}
                      onWordClick={handleWordClick}
                      showColor={showColor}
                    />
                  )}
                </p>
              )}
              {showZh && sub.zh && (
                <p
                  className={`leading-[1.6] ${isActive ? 'text-sm mt-1' : 'text-xs mt-0.5'}`}
                  style={{ color: 'var(--mobile-text-secondary)', wordBreak: 'break-word' }}
                >
                  {sub.zh}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default memo(MobileSentenceCardsInner)
