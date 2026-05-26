import { memo } from 'react'
import { Play, Copy } from 'lucide-react'
import { formatTime } from '../../../utils/formatTime.js'
import { tokenizeEnglish, POS_LABEL, getPosHighlightColor } from '../utils/wordColorMap.js'

function CueTextWithPills({ text, posMap, onWordClick, posHighlight = true }) {
  if (!text) return null
  const tokens = tokenizeEnglish(text)
  return (
    <>
      {tokens.map((tok, i) => {
        if (!tok.isWord) {
          return <span key={`c-${i}`}>{tok.raw}</span>
        }
        const pos = posMap?.get(tok.lower) || 'unknown'
        const color = getPosHighlightColor(pos)
        const isKnown = posMap?.has(tok.lower)

        if (!isKnown || !posHighlight || !color) {
          return (
            <span
              key={`c-${i}`}
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
            key={`c-${i}`}
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

function CueActions({ onPlay, onCopy }) {
  const cls =
    'w-7 h-7 flex items-center justify-center rounded-full text-content-tertiary dark:text-gray-500 hover:text-primary hover:bg-primary-soft transition-colors'
  return (
    <div className="flex items-center gap-0.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); if (onPlay) onPlay() }}
        className={cls}
        title="播放"
      >
        <Play className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); if (onCopy) onCopy() }}
        className={cls}
        title="复制"
      >
        <Copy className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

function SubtitleCueCardInner({
  subtitle,
  index,
  active,
  posMap,
  phonetic,
  onClick,
  onWordClick,
  onPlay,
  posHighlight = true,
}) {
  const handleCopy = () => {
    const text = `${subtitle.en}\n${subtitle.zh || ''}`
    navigator.clipboard.writeText(text).catch(() => {})
  }

  return (
    <div
      onClick={onClick}
      className={`group relative p-3 md:p-4 transition-colors cursor-pointer ${
        active
          ? 'bg-primary-soft/60 dark:bg-primary-soft/30 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[2px] before:bg-primary'
          : 'hover:bg-gray-50 dark:hover:bg-white/[0.03]'
      }`}
    >
      {/* 顶部行：时间戳 (左) + 操作图标 (右) */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-xs text-content-tertiary dark:text-gray-500 tabular-nums">
          <span className="font-medium">{index + 1}</span>
          <span className="mx-2">{formatTime(subtitle.start)} - {formatTime(subtitle.end)}</span>
        </div>
        <CueActions onPlay={onPlay} onCopy={handleCopy} />
      </div>

      {/* 整句音标 */}
      {phonetic && (
        <div className="text-xs text-content-tertiary/80 dark:text-gray-500 font-mono leading-snug mb-1">
          {phonetic}
        </div>
      )}

      {/* 英文 */}
      {subtitle.en && (
        <div className="text-[15px] leading-relaxed mb-1 text-content dark:text-gray-100">
          <CueTextWithPills
            text={subtitle.en}
            posMap={posMap}
            onWordClick={onWordClick}
            posHighlight={posHighlight}
          />
        </div>
      )}

      {/* 中文 */}
      {subtitle.zh && (
        <div className="text-sm text-content-tertiary dark:text-gray-400 leading-relaxed">
          {subtitle.zh}
        </div>
      )}
    </div>
  )
}

export default memo(SubtitleCueCardInner)
