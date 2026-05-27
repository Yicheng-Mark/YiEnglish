import { useState } from 'react'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Eye,
  EyeOff,
  Zap,
  Check,
  X,
} from 'lucide-react'
import { useCorpusContext } from '../../context/CorpusPlayerContext.jsx'
import { formatTime } from '../../../../utils/formatTime.js'

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2]

function ControlBtn({ onClick, label, ariaLabel, active, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={ariaLabel || label}
      aria-label={ariaLabel || label}
      className="flex flex-col items-center gap-0.5 min-w-[44px] min-h-[44px] justify-center active:opacity-60 transition-opacity"
    >
      <span
        className="w-9 h-9 flex items-center justify-center rounded-full transition-all duration-200"
        style={{
          backgroundColor: active ? 'var(--mobile-primary)' : 'transparent',
          color: active ? '#fff' : 'var(--mobile-icon-color)',
        }}
      >
        {children}
      </span>
      <span
        className="text-[10px] leading-none whitespace-nowrap"
        style={{ color: active ? 'var(--mobile-primary)' : 'var(--mobile-control-text)' }}
      >
        {label}
      </span>
    </button>
  )
}

export default function MobileBottomControls({ focusMode, onToggleFocus }) {
  const { player, settings, toggleSetting } = useCorpusContext()
  const { currentTime, duration, rate, loopCount } = player
  const [showSpeedMenu, setShowSpeedMenu] = useState(false)

  const max = duration > 0 ? duration : 0
  const isHidden = player.hideSubtitleRight && player.hideSubtitleBottom

  return (
    <>
      <div className="mobile-control-fixed shrink-0 px-4 pt-2 pb-1">
        {/* Time + progress bar */}
        <div
          className="flex items-center gap-2 text-[11px] tabular-nums mb-1.5"
          style={{ color: 'var(--mobile-control-text)' }}
        >
          <span className="shrink-0 w-8 text-right">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={max || 0}
            step={0.1}
            value={Math.min(currentTime, max)}
            onChange={(e) => player.seek(parseFloat(e.target.value))}
            aria-label="进度"
            className="flex-1 mobile-progress-range cursor-pointer"
            style={{ '--progress-pct': max > 0 ? `${(currentTime / max) * 100}%` : '0%' }}
          />
          <span className="shrink-0 w-8">{formatTime(max)}</span>
        </div>

        {/* 7 control buttons */}
        <div className="flex items-center justify-around py-0.5">
          {/* Speed */}
          <ControlBtn
            onClick={() => setShowSpeedMenu(true)}
            label="倍速"
            active={rate !== 1}
          >
            <span className="text-xs font-bold tabular-nums">{rate}x</span>
          </ControlBtn>

          {/* Hide subtitles */}
          <ControlBtn
            onClick={player.toggleAllSubtitles}
            label="隐藏"
            active={isHidden}
          >
            {isHidden ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
          </ControlBtn>

          {/* Prev */}
          <ControlBtn onClick={player.prevCue} label="上一句" active={false}>
            <SkipBack className="w-[18px] h-[18px]" />
          </ControlBtn>

          {/* Play / Pause */}
          <ControlBtn
            onClick={player.toggle}
            label={player.isPlaying ? '暂停' : '播放'}
            active={false}
          >
            {player.isPlaying
              ? <Pause className="w-5 h-5" fill="currentColor" />
              : <Play className="w-5 h-5 ml-0.5" fill="currentColor" />}
          </ControlBtn>

          {/* Next */}
          <ControlBtn onClick={player.nextCue} label="下一句" active={false}>
            <SkipForward className="w-[18px] h-[18px]" />
          </ControlBtn>

          {/* Loop */}
          <ControlBtn
            onClick={player.toggleLoop}
            label={loopCount !== 0 ? (loopCount === -1 ? '∞' : `×${loopCount}`) : '循环'}
            active={loopCount !== 0}
          >
            <Repeat className="w-[18px] h-[18px]" />
          </ControlBtn>

          {/* Focus mode */}
          <ControlBtn
            onClick={onToggleFocus}
            label="精听"
            active={focusMode}
          >
            <Zap className="w-[18px] h-[18px]" />
          </ControlBtn>
        </div>
      </div>

      {/* Speed bottom-sheet popup */}
      {showSpeedMenu && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-[60]"
            onClick={() => setShowSpeedMenu(false)}
          />
          <div
            className="fixed left-4 right-4 z-[61] rounded-2xl overflow-hidden"
            style={{
              bottom: 120,
              backgroundColor: 'var(--mobile-card-bg)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            }}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <span className="text-sm font-semibold" style={{ color: 'var(--mobile-text)' }}>
                播放倍速
              </span>
              <button
                type="button"
                onClick={() => setShowSpeedMenu(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full"
                style={{ color: 'var(--mobile-icon-color)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {RATES.map((speed) => {
              const active = rate === speed
              return (
                <button
                  key={speed}
                  type="button"
                  onClick={() => {
                    player.setRate(speed)
                    setShowSpeedMenu(false)
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-5 transition-colors"
                  style={{
                    backgroundColor: active ? 'var(--mobile-primary-soft, rgba(88,86,214,0.08))' : 'transparent',
                    color: active ? 'var(--mobile-primary)' : 'var(--mobile-text)',
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  <span className="text-base">{speed === 1 ? '正常速度' : `${speed}x`}</span>
                  {active && <Check className="w-4 h-4" />}
                </button>
              )
            })}
            <div className="h-2" />
          </div>
        </>
      )}
    </>
  )
}
