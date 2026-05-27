import { useRef, useState, useCallback, useEffect } from 'react'
import { useCorpusContext } from '../../context/CorpusPlayerContext.jsx'
import MobileSentenceCards from './MobileSentenceCard.jsx'
import MobileBottomControls from './MobileBottomControls.jsx'
import './mobile-corpus.css'
import MobileVideoCover from './MobileVideoCover.jsx'
import WordPopup from '../../../../components/WordPopup.jsx'

const DISPLAY_MODES = [
  { id: 'bilingual', label: '双语' },
  { id: 'english',   label: '英语' },
  { id: 'chinese',   label: '中文' },
  { id: 'reading',   label: '阅读' },
  { id: 'cloze',     label: '挖空' },
]

const FIXED_TABS = [
  { id: 'dictation', label: '听写' },
  { id: 'translate', label: '中译英' },
  { id: 'vocab',     label: '词卡' },
]

export default function MobileCorpusPlayer({ video, onBack }) {
  const { player, mode, setMode, popup, closePopup, saveWord, removeWord } = useCorpusContext()
  const [focusMode, setFocusMode] = useState(false)

  // Virtual keyboard handling
  const containerRef = useRef(null)
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  useEffect(() => {
    if (!window.visualViewport) return

    const onResize = () => {
      const vv = window.visualViewport
      const kb = window.innerHeight - vv.height
      setKeyboardHeight(kb > 150 ? kb : 0)
    }

    window.visualViewport.addEventListener('resize', onResize)
    return () => window.visualViewport.removeEventListener('resize', onResize)
  }, [])

  const toggleFocus = useCallback(() => setFocusMode((v) => !v), [])

  const isDisplayMode = DISPLAY_MODES.some((m) => m.id === mode)
  const currentDisplay = DISPLAY_MODES.find((m) => m.id === mode) || DISPLAY_MODES[0]

  const cycleDisplayMode = useCallback(() => {
    const idx = DISPLAY_MODES.findIndex((m) => m.id === mode)
    const next = DISPLAY_MODES[(idx + 1) % DISPLAY_MODES.length]
    setMode(next.id)
  }, [mode, setMode])

  const needsInput = mode === 'dictation'
  const hideFixedBars = keyboardHeight > 0 && needsInput

  return (
    <div
      ref={containerRef}
      className={`mobile-corpus-reset w-full max-w-full flex flex-col overflow-hidden transition-colors duration-500 ${
        focusMode ? 'mobile-focus-active' : ''
      }`}
      style={{
        height: keyboardHeight > 0 ? `${window.visualViewport?.height || window.innerHeight}px` : '100dvh',
        backgroundColor: 'var(--mobile-bg)',
      }}
    >
      {/* 1. Video section (hidden in focus mode via CSS) */}
      <MobileVideoCover onBack={onBack} />

      {/* 2. PlayMode tabs (hidden in focus mode via CSS) */}
      <div
        className="mobile-play-modes shrink-0 px-3 py-2"
        style={{
          backgroundColor: 'var(--mobile-card-bg)',
          borderBottom: '1px solid var(--mobile-border)',
        }}
      >
        <div
          className="flex items-center justify-around overflow-x-auto"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <style>{`.mobile-play-modes::-webkit-scrollbar{display:none}`}</style>
            {/* Cycling display mode pill */}
            <button
              type="button"
              onClick={cycleDisplayMode}
              className={`mode-pill shrink-0 ${isDisplayMode ? 'mode-pill-active' : 'mode-pill-default'}`}
            >
              {currentDisplay.label} <span style={{ fontSize: 10, marginLeft: 2 }}>▾</span>
            </button>
            {/* Fixed mode pills */}
            {FIXED_TABS.map((t) => {
              const active = mode === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setMode(t.id)}
                  className={`mode-pill shrink-0 ${active ? 'mode-pill-active' : 'mode-pill-default'}`}
                >
                  {t.label}
                </button>
              )
            })}
        </div>
      </div>

      {/* 3. Content area — fills remaining space, SentenceCards handles its own scrolling */}
      <MobileSentenceCards focusMode={focusMode} />

      {/* 4. Bottom controls — fixed (two rows) */}
      {!hideFixedBars && (
        <MobileBottomControls focusMode={focusMode} onToggleFocus={toggleFocus} />
      )}

      {/* Word popup overlay */}
      {popup && (
        <WordPopup
          wordData={popup.wordData}
          rect={popup.rect}
          isSaved={popup.isSaved}
          onSave={saveWord}
          onRemove={removeWord}
          onClose={closePopup}
          wordBookLabel="语料词本"
        />
      )}
    </div>
  )
}
