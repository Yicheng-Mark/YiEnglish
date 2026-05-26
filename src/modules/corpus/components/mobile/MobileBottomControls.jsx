import {
  Play,
  SkipForward,
  Repeat,
  Palette,
  Eye,
  EyeOff,
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
      className="flex flex-col items-center gap-1 min-w-[44px]"
    >
      <span
        className="w-10 h-10 flex items-center justify-center rounded-full transition-all duration-200"
        style={{
          backgroundColor: active ? 'var(--mobile-primary)' : 'var(--mobile-card-bg)',
          color: active ? '#fff' : 'var(--mobile-icon-color)',
          border: active ? '1px solid transparent' : '1px solid var(--mobile-border)',
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

export default function MobileBottomControls() {
  const { videoRef, video, player, settings, toggleSetting } = useCorpusContext()
  const {
    currentTime, duration, isPlaying, rate, loopCount,
    seek, toggle, setRate, nextCue, jumpToCue, activeId,
  } = player

  const max = duration > 0 ? duration : 0
  const isHidden = player.hideSubtitleRight && player.hideSubtitleBottom

  const playSingleSentence = () => {
    if (activeId) jumpToCue(activeId)
  }

  const cycleRate = () => {
    const idx = RATES.indexOf(rate)
    const next = idx >= 0 && idx < RATES.length - 1 ? RATES[idx + 1] : RATES[0]
    setRate(next)
  }

  return (
    <>
      {/* Hidden video for audio playback */}
      <video
        ref={videoRef}
        src={video?.videoUrl}
        className="absolute w-0 h-0 overflow-hidden opacity-0 pointer-events-none"
        playsInline
        preload="metadata"
        aria-hidden="true"
      />

      <div
        className="shrink-0 px-4 pt-2 pb-1"
        style={{
          backgroundColor: 'var(--mobile-bottom-bg)',
          borderTop: '1px solid var(--mobile-border)',
        }}
      >
        {/* Time + progress bar */}
        <div className="flex items-center gap-2 text-[11px] tabular-nums mb-2" style={{ color: 'var(--mobile-control-text)' }}>
          <span className="shrink-0 w-8 text-right">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={max || 0}
            step={0.1}
            value={Math.min(currentTime, max)}
            onChange={(e) => seek(parseFloat(e.target.value))}
            aria-label="进度"
            className="flex-1 mobile-progress-range cursor-pointer"
            style={{ '--progress-pct': max > 0 ? `${(currentTime / max) * 100}%` : '0%' }}
          />
          <span className="shrink-0 w-8">{formatTime(max)}</span>
        </div>

        {/* 6 round control buttons */}
        <div className="flex items-center justify-around py-1">
          {/* ① 单句播放 */}
          <ControlBtn onClick={playSingleSentence} label="单句" active={false}>
            <Play className="w-4 h-4" />
          </ControlBtn>

          {/* ② 下一句 */}
          <ControlBtn onClick={nextCue} label="下一句" active={false}>
            <SkipForward className="w-4 h-4" />
          </ControlBtn>

          {/* ③ 循环 */}
          <ControlBtn
            onClick={player.toggleLoop}
            label={loopCount !== 0 ? (loopCount === -1 ? '∞' : `×${loopCount}`) : '循环'}
            active={loopCount !== 0}
          >
            <Repeat className="w-4 h-4" />
          </ControlBtn>

          {/* ④ 倍速 */}
          <ControlBtn onClick={cycleRate} label="倍速" active={rate !== 1}>
            <span className="text-xs font-bold tabular-nums">{rate}x</span>
          </ControlBtn>

          {/* ⑤ 隐藏 */}
          <ControlBtn
            onClick={player.toggleAllSubtitles}
            label="隐藏"
            active={isHidden}
          >
            {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </ControlBtn>

          {/* ⑥ 颜色标记 */}
          <ControlBtn
            onClick={() => toggleSetting('posHighlight')}
            label="标记"
            active={settings?.posHighlight}
          >
            <Palette className="w-4 h-4" />
          </ControlBtn>
        </div>
      </div>
    </>
  )
}
