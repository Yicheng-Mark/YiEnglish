import { useRef, useState, useCallback, useEffect } from 'react'
import { ArrowLeft, Play, Pause } from 'lucide-react'
import { useCorpusContext } from '../../context/CorpusPlayerContext.jsx'
import MobileSentenceCards from './MobileSentenceCard.jsx'
import MobileBottomControls from './MobileBottomControls.jsx'
import MobileVideoCover from './MobileVideoCover.jsx'
import WordPopup from '../../../../components/WordPopup.jsx'

const PLAY_MODES = [
  { id: 'bilingual', label: '双语' },
  { id: 'dictation', label: '听写' },
  { id: 'translate', label: '中译英' },
  { id: 'vocab', label: '词卡' },
]

const DISPLAY_MODES = [
  { id: 'english', label: '英语' },
  { id: 'chinese', label: '中文' },
  { id: 'reading', label: '阅读' },
  { id: 'cloze', label: '挖空' },
]

export default function MobileCorpusPlayer({ video, onBack }) {
  const { player, mode, setMode, popup, closePopup, saveWord, removeWord } = useCorpusContext()
  const [displayMode, setDisplayMode] = useState('reading')
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

  const needsInput = mode === 'dictation' || mode === 'translate'
  const hideFixedBars = keyboardHeight > 0 && needsInput

  return (
    <div
      ref={containerRef}
      className={`mobile-corpus-reset flex flex-col overflow-hidden transition-colors duration-500 ${
        focusMode ? 'mobile-focus-active' : ''
      }`}
      style={{
        height: keyboardHeight > 0 ? `${window.visualViewport?.height || window.innerHeight}px` : '100dvh',
        backgroundColor: 'var(--mobile-bg)',
      }}
    >
      {/* 1. Video section (hidden in focus mode via CSS) */}
      <MobileVideoCover />

      {/* 2. Header: back | title | play/pause */}
      <div
        className="shrink-0 flex items-center h-11 px-3 gap-2"
        style={{
          backgroundColor: 'var(--mobile-card-bg)',
          borderBottom: '1px solid var(--mobile-border)',
        }}
      >
        <button
          onClick={onBack}
          className="w-9 h-9 flex items-center justify-center rounded-full active:opacity-70 transition-opacity shrink-0"
          style={{ color: 'var(--mobile-icon-color)' }}
          aria-label="返回"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span
          className="flex-1 text-sm font-medium truncate text-center"
          style={{ color: 'var(--mobile-text)' }}
        >
          {video.title}
        </span>
        <button
          type="button"
          onClick={player.toggle}
          className="w-9 h-9 flex items-center justify-center rounded-full active:opacity-70 transition-opacity shrink-0"
          style={{ color: 'var(--mobile-icon-color)' }}
          aria-label={player.isPlaying ? '暂停' : '播放'}
        >
          {player.isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </button>
      </div>

      {/* 3. PlayMode tabs: horizontal scrollable pills (hidden in focus mode via CSS) */}
      <div
        className="mobile-play-modes shrink-0 px-3 py-2"
        style={{
          backgroundColor: 'var(--mobile-card-bg)',
          borderBottom: '1px solid var(--mobile-border)',
        }}
      >
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <style>{`.scrollbar-hide::-webkit-scrollbar{display:none}`}</style>
          {PLAY_MODES.map((t) => {
            const active = mode === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setMode(t.id)}
                className="shrink-0 px-3 py-1 rounded-full text-sm whitespace-nowrap transition-all duration-200 min-h-[32px]"
                style={{
                  backgroundColor: active ? 'var(--mobile-primary)' : 'transparent',
                  color: active ? '#fff' : 'var(--mobile-text-secondary)',
                  fontWeight: active ? 600 : 400,
                  minWidth: 44,
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 4. Content area — scrollable, with bottom padding for fixed bars */}
      <div
        className="flex-1 min-h-0 overflow-y-auto px-4 py-3 flex flex-col gap-3"
        style={{
          paddingBottom: hideFixedBars ? 24 : 'calc(56px + 48px + env(safe-area-inset-bottom, 0px) + 16px)',
          overscrollBehaviorY: 'contain',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
        }}
      >
        <style>{`div[style*="overscrollBehaviorY"]::-webkit-scrollbar{display:none}`}</style>
        <MobileSentenceCards displayMode={displayMode} focusMode={focusMode} />
      </div>

      {/* 5. Bottom controls — fixed */}
      {!hideFixedBars && (
        <MobileBottomControls focusMode={focusMode} onToggleFocus={toggleFocus} />
      )}

      {/* 6. Bottom nav (DisplayMode) — fixed */}
      {!hideFixedBars && (
        <div
          className="mobile-nav-fixed shrink-0 flex items-center justify-around px-4"
          style={{
            height: 48,
            paddingTop: 4,
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 4px)',
          }}
        >
          {DISPLAY_MODES.map((t) => {
            const active = displayMode === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setDisplayMode(t.id)}
                className="flex flex-col items-center gap-0.5 min-w-[44px] min-h-[40px] justify-center active:scale-95 transition-transform"
                style={{
                  color: active ? 'var(--mobile-primary)' : 'var(--mobile-text-secondary)',
                  position: 'relative',
                }}
              >
                {/* Active indicator dot */}
                {active && (
                  <span
                    className="absolute -top-1 w-6 h-[3px] rounded-b-sm"
                    style={{ backgroundColor: 'var(--mobile-primary)' }}
                  />
                )}
                <span
                  className="text-xs whitespace-nowrap"
                  style={{ fontWeight: active ? 600 : 400 }}
                >
                  {t.label}
                </span>
              </button>
            )
          })}
        </div>
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
