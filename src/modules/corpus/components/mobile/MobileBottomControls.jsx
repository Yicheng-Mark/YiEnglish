import { useState } from 'react'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Zap,
  Timer,
  PauseCircle,
  Maximize,
  Type,
  Palette,
  Check,
  X,
} from 'lucide-react'
import { useCorpusContext } from '../../context/CorpusPlayerContext.jsx'
import { formatTime } from '../../../../utils/formatTime.js'

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2]
const LOOP_CYCLE = [1, 2, 3, 4, 5, -1]
const INTERVAL_CYCLE = [0, 3, 5, 8]

function ControlBtn({ onClick, label, ariaLabel, active, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={ariaLabel || label}
      aria-label={ariaLabel || label}
      className="flex flex-col items-center gap-0.5 min-w-[36px] min-h-[40px] justify-center active:opacity-60 transition-opacity"
    >
      <span
        className="w-7 h-7 flex items-center justify-center rounded-full transition-all duration-200"
        style={{
          backgroundColor: active ? 'var(--mobile-primary)' : 'transparent',
          color: active ? '#fff' : 'var(--mobile-icon-color)',
        }}
      >
        {children}
      </span>
      <span
        className="text-[9px] leading-none whitespace-nowrap"
        style={{ color: active ? 'var(--mobile-primary)' : 'var(--mobile-control-text)' }}
      >
        {label}
      </span>
    </button>
  )
}

export default function MobileBottomControls({ focusMode, onToggleFocus }) {
  const { player, settings, toggleSetting } = useCorpusContext()
  const { currentTime, duration, rate, loopCount, pauseAfterCue, intervalGap } = player
  const [showSpeedMenu, setShowSpeedMenu] = useState(false)

  const max = duration > 0 ? duration : 0

  const cycleLoop = () => {
    const idx = LOOP_CYCLE.indexOf(loopCount)
    const next = LOOP_CYCLE[(idx + 1) % LOOP_CYCLE.length]
    player.setLoopCount(next)
  }

  const cycleInterval = () => {
    const idx = INTERVAL_CYCLE.indexOf(intervalGap)
    const next = INTERVAL_CYCLE[(idx + 1) % INTERVAL_CYCLE.length]
    player.setIntervalGap(next)
  }

  return (
    <>
      <div className="mobile-control-fixed px-3 pt-1.5 pb-1">
        {/* Time + progress bar */}
        <div
          className="flex items-center gap-2 text-[10px] tabular-nums mb-1"
          style={{ color: 'var(--mobile-control-text)' }}
        >
          <span className="shrink-0 w-7 text-right">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={max || 0}
            step={0.1}
            value={Math.min(currentTime, max)}
            onInput={(e) => player.seek(parseFloat(e.target.value))}
            aria-label="进度"
            className="flex-1 mobile-progress-range cursor-pointer"
            style={{ '--progress-pct': max > 0 ? `${(currentTime / max) * 100}%` : '0%' }}
          />
          <span className="shrink-0 w-7">{formatTime(max)}</span>
        </div>

        {/* Row 1: 7 main control buttons */}
        <div className="flex items-center justify-around">
          <ControlBtn
            onClick={() => setShowSpeedMenu(true)}
            label="倍速"
            active={rate !== 1}
          >
            <span className="text-[11px] font-bold tabular-nums">{rate}x</span>
          </ControlBtn>

          <ControlBtn
            onClick={onToggleFocus}
            label="精听"
            active={focusMode}
          >
            <Zap className="w-[16px] h-[16px]" />
          </ControlBtn>

          <ControlBtn onClick={player.prevCue} label="上一句" active={false}>
            <SkipBack className="w-[16px] h-[16px]" />
          </ControlBtn>

          <ControlBtn
            onClick={player.toggle}
            label={player.isPlaying ? '暂停' : '播放'}
            active={false}
          >
            {player.isPlaying
              ? <Pause className="w-[18px] h-[18px]" fill="currentColor" />
              : <Play className="w-[18px] h-[18px] ml-0.5" fill="currentColor" />}
          </ControlBtn>

          <ControlBtn onClick={player.nextCue} label="下一句" active={false}>
            <SkipForward className="w-[16px] h-[16px]" />
          </ControlBtn>

          <ControlBtn
            onClick={cycleLoop}
            label={loopCount !== 0 ? (loopCount === -1 ? '∞' : `×${loopCount}`) : '循环'}
            active={loopCount !== 0}
          >
            <Repeat className="w-[16px] h-[16px]" />
          </ControlBtn>

          <ControlBtn
            onClick={cycleInterval}
            label={intervalGap > 0 ? `${intervalGap}s` : '间隔'}
            active={intervalGap > 0}
          >
            <Timer className="w-[16px] h-[16px]" />
          </ControlBtn>
        </div>

        {/* Row 2: 4 auxiliary buttons */}
        <div className="flex items-center justify-around">
          <ControlBtn
            onClick={player.togglePauseAfterCue}
            label="单句暂停"
            active={pauseAfterCue}
          >
            <PauseCircle className="w-[16px] h-[16px]" />
          </ControlBtn>

          <ControlBtn onClick={player.requestFullscreen} label="全屏" active={false}>
            <Maximize className="w-[16px] h-[16px]" />
          </ControlBtn>

          <ControlBtn
            onClick={() => toggleSetting('showPhonetic')}
            label="音标"
            active={settings?.showPhonetic}
          >
            <Type className="w-[16px] h-[16px]" />
          </ControlBtn>

          <ControlBtn
            onClick={() => toggleSetting('posHighlight')}
            label="颜色标记"
            active={settings?.posHighlight}
          >
            <Palette className="w-[16px] h-[16px]" />
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
              bottom: 150,
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
                  className="w-full flex items-center justify-center gap-2 py-3 px-5 transition-colors"
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
