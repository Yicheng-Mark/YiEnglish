import { useRef, useState } from 'react'
import { ArrowLeft, Play, Pause } from 'lucide-react'
import { useCorpusContext } from '../../context/CorpusPlayerContext.jsx'
import { useSwipe } from '../../../../hooks/useSwipe.js'
import MobileSentenceCards from './MobileSentenceCard.jsx'
import MobileBottomControls from './MobileBottomControls.jsx'
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

  const swipeRef = useRef(null)
  useSwipe({
    ref: swipeRef,
    onSwipeLeft: player.nextCue,
    onSwipeRight: player.prevCue,
  })

  return (
    <div
      className="mobile-corpus-reset h-[100dvh] flex flex-col overflow-hidden transition-colors duration-500"
      style={{ backgroundColor: 'var(--mobile-bg)' }}
    >
      {/* 1. Header: back | title | play/pause */}
      <div
        className="shrink-0 flex items-center h-11 px-3 gap-2"
        style={{ backgroundColor: 'var(--mobile-card-bg)', borderBottom: '1px solid var(--mobile-border)' }}
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
          {player.isPlaying ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* 2. PlayMode tabs: 双语 | 听写 | 中译英 | 词卡 */}
      <div
        className="shrink-0 px-3 py-2"
        style={{ backgroundColor: 'var(--mobile-card-bg)', borderBottom: '1px solid var(--mobile-border)' }}
      >
        <div className="flex items-center gap-2">
          {PLAY_MODES.map((t) => {
            const active = mode === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setMode(t.id)}
                className="shrink-0 px-3 py-1 rounded-full text-sm whitespace-nowrap transition-all duration-200"
                style={{
                  backgroundColor: active ? 'var(--mobile-primary)' : 'transparent',
                  color: active ? '#fff' : 'var(--mobile-text-secondary)',
                  fontWeight: active ? 600 : 400,
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 3. Three-sentence card area with swipe */}
      <div
        ref={swipeRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 py-3 flex flex-col gap-3"
      >
        <MobileSentenceCards displayMode={displayMode} />
      </div>

      {/* 4. Player controls (not sticky, follows subtitle area) */}
      <MobileBottomControls />

      {/* 5. DisplayMode bar: 英语 | 中文 | 阅读 | 挖空 */}
      <div
        className="shrink-0 flex items-center justify-around px-4 py-2"
        style={{
          backgroundColor: 'var(--mobile-card-bg)',
          borderTop: '1px solid var(--mobile-border)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
        }}
      >
        {DISPLAY_MODES.map((t) => {
          const active = displayMode === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setDisplayMode(t.id)}
              className="px-3 py-1 rounded-full text-sm whitespace-nowrap transition-all duration-200"
              style={{
                backgroundColor: active ? 'var(--mobile-primary)' : 'transparent',
                color: active ? '#fff' : 'var(--mobile-text-secondary)',
                fontWeight: active ? 600 : 400,
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

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
