import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Pause,
  Play,
  Repeat,
  SkipBack,
  SkipForward,
  Maximize,
  PauseCircle,
  Hourglass,
  Video,
  VideoOff,
  Palette,
} from 'lucide-react'
import { useCorpusContext } from '../context/CorpusPlayerContext.jsx'

const RATE_OPTIONS = [
  0.3, 0.4, 0.5, 0.6,
  0.7, 0.8, 0.9, 1,
  1.1, 1.2, 1.3, 1.4,
  1.5, 2,
]
const INTERVAL_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const LOOP_OPTIONS = [1, 2, 3, 4, 5, 10, -1] // -1 = 无限

function LabeledBtn({ active, onClick, label, ariaLabel, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={ariaLabel || label}
      aria-pressed={!!active}
      className="shrink-0 flex flex-col items-center gap-0.5 group min-w-[44px]"
    >
      <span
        className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${
          active
            ? 'bg-primary-soft text-primary dark:bg-white dark:text-gray-900'
            : 'text-content-secondary dark:text-gray-300 group-hover:bg-gray-100/60 dark:group-hover:bg-white/[0.06]'
        }`}
      >
        {children}
      </span>
      <span
        className={`text-[10px] leading-none whitespace-nowrap ${
          active ? 'text-primary dark:text-white' : 'text-content-tertiary dark:text-gray-500'
        }`}
      >
        {label}
      </span>
    </button>
  )
}

function RateMenu({ rate, onChange }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ left: 0, top: 0, ready: false })
  const btnRef = useRef(null)
  const panelRef = useRef(null)

  const layout = useCallback(() => {
    const btn = btnRef.current
    const panel = panelRef.current
    if (!btn || !panel) return
    const b = btn.getBoundingClientRect()
    const p = panel.getBoundingClientRect()
    const margin = 8
    const centerX = b.left + b.width / 2
    let left = centerX - p.width / 2
    left = Math.max(margin, Math.min(window.innerWidth - p.width - margin, left))
    setPos({ left, top: b.bottom + margin, ready: true })
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setPos((prev) => (prev.ready ? { ...prev, ready: false } : prev))
      return
    }
    layout()
  }, [open, layout])

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (btnRef.current?.contains(e.target)) return
      if (panelRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onRecalc = () => layout()
    document.addEventListener('mousedown', onDown)
    window.addEventListener('resize', onRecalc)
    window.addEventListener('scroll', onRecalc, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('resize', onRecalc)
      window.removeEventListener('scroll', onRecalc, true)
    }
  }, [open, layout])

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex flex-col items-center gap-0.5 group min-w-[44px]"
        title="播放速度"
      >
        <span className="w-9 h-9 flex items-center justify-center rounded-full text-content-secondary dark:text-gray-300 group-hover:bg-gray-100/60 dark:group-hover:bg-white/[0.06] text-sm font-medium tabular-nums">
          {rate}x
        </span>
        <span className="text-[10px] leading-none text-content-tertiary dark:text-gray-500">
          倍速
        </span>
      </button>
      {open && createPortal(
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            left: pos.left,
            top: pos.top,
            visibility: pos.ready ? 'visible' : 'hidden',
          }}
          className="z-[100] rounded-xl p-3 bg-surface dark:bg-[#1a1a24] border border-gray-200 dark:border-white/[0.08] shadow-xl"
        >
          <div className="text-[11px] text-content-tertiary dark:text-gray-400 text-center mb-2">
            播放倍速
          </div>
          <div className="grid grid-cols-4 gap-2">
            {RATE_OPTIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  onChange(r)
                  setOpen(false)
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium tabular-nums transition-colors ${
                  rate === r
                    ? 'bg-primary text-white dark:bg-white dark:text-gray-900'
                    : 'bg-gray-100 text-content-secondary hover:bg-gray-200 dark:bg-white/[0.06] dark:text-gray-200 dark:hover:bg-white/[0.12]'
                }`}
              >
                {r}x
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

function IntervalMenu({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState(null)
  const btnRef = useRef(null)
  const panelRef = useRef(null)

  const active = value > 0

  const updateAnchor = useCallback(() => {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setAnchor({ x: r.left + r.width / 2, y: r.bottom })
  }, [])

  useEffect(() => {
    if (!open) return
    updateAnchor()
    const onDown = (e) => {
      if (btnRef.current?.contains(e.target)) return
      if (panelRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onScrollOrResize = () => updateAnchor()
    document.addEventListener('mousedown', onDown)
    window.addEventListener('resize', onScrollOrResize)
    window.addEventListener('scroll', onScrollOrResize, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('resize', onScrollOrResize)
      window.removeEventListener('scroll', onScrollOrResize, true)
    }
  }, [open, updateAnchor])

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex flex-col items-center gap-0.5 group min-w-[44px]"
        title="单句间隔"
      >
        <span
          className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${
            active
              ? 'bg-primary-soft text-primary dark:bg-white dark:text-gray-900'
              : 'text-content-secondary dark:text-gray-300 group-hover:bg-gray-100/60 dark:group-hover:bg-white/[0.06]'
          }`}
        >
          <Hourglass className="w-4 h-4" />
        </span>
        <span
          className={`text-[10px] leading-none ${
            active ? 'text-primary dark:text-white' : 'text-content-tertiary dark:text-gray-400'
          }`}
        >
          {active ? `${value}s` : '间隔'}
        </span>
      </button>
      {open && anchor && createPortal(
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            left: anchor.x,
            top: anchor.y + 8,
            transform: 'translate(-50%, 0)',
          }}
          className="z-[100] min-w-[120px] rounded-xl py-1.5 bg-surface dark:bg-[#1a1a24] border border-gray-200 dark:border-white/[0.12] shadow-xl"
        >
          <div className="text-[11px] text-content-tertiary dark:text-gray-400 text-center mb-2 px-3">
            单句间隔
          </div>
          <div className="grid grid-cols-4 gap-2">
            {INTERVAL_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  onChange(s)
                  setOpen(false)
                }}
                className={`h-9 rounded-md text-xs font-medium tabular-nums transition-colors flex items-center justify-center ${
                  value === s
                    ? 'bg-primary text-white dark:bg-white dark:text-gray-900'
                    : 'bg-gray-100 text-content-secondary hover:bg-gray-200 dark:bg-white/[0.06] dark:text-gray-200 dark:hover:bg-white/[0.12]'
                }`}
              >
                {s === 0 ? '关闭' : `${s}s`}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

function LoopCountMenu({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState(null)
  const btnRef = useRef(null)
  const panelRef = useRef(null)

  const active = value !== 0
  const label = active ? (value === -1 ? '∞' : `×${value}`) : '单句循环'

  const updateAnchor = useCallback(() => {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setAnchor({ x: r.left + r.width / 2, y: r.bottom })
  }, [])

  useEffect(() => {
    if (!open) return
    updateAnchor()
    const onDown = (e) => {
      if (btnRef.current?.contains(e.target)) return
      if (panelRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onScrollOrResize = () => updateAnchor()
    document.addEventListener('mousedown', onDown)
    window.addEventListener('resize', onScrollOrResize)
    window.addEventListener('scroll', onScrollOrResize, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('resize', onScrollOrResize)
      window.removeEventListener('scroll', onScrollOrResize, true)
    }
  }, [open, updateAnchor])

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex flex-col items-center gap-0.5 group min-w-[44px]"
        title="单句循环"
      >
        <span
          className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${
            active
              ? 'bg-primary-soft text-primary dark:bg-white dark:text-gray-900'
              : 'text-content-secondary dark:text-gray-300 group-hover:bg-gray-100/60 dark:group-hover:bg-white/[0.06]'
          }`}
        >
          <Repeat className="w-4 h-4" />
        </span>
        <span
          className={`text-[10px] leading-none ${
            active ? 'text-primary dark:text-white' : 'text-content-tertiary dark:text-gray-500'
          }`}
        >
          {label}
        </span>
      </button>
      {open && anchor && createPortal(
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            left: anchor.x,
            top: anchor.y + 8,
            transform: 'translate(-50%, 0)',
          }}
          className="z-[100] rounded-xl p-3 bg-surface dark:bg-[#1a1a24] border border-gray-200 dark:border-white/[0.08] shadow-xl"
        >
          <div className="text-[11px] text-content-tertiary dark:text-gray-400 text-center mb-2">
            设置单句循环次数
          </div>
          <div className="grid grid-cols-3 gap-2">
            {LOOP_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(opt)
                  setOpen(false)
                }}
                className={`w-10 h-10 rounded-md text-xs font-medium tabular-nums transition-colors flex items-center justify-center ${
                  value === opt
                    ? 'bg-primary text-white dark:bg-white dark:text-gray-900'
                    : 'bg-gray-100 text-content-secondary hover:bg-gray-200 dark:bg-white/[0.06] dark:text-gray-200 dark:hover:bg-white/[0.12]'
                }`}
              >
                {opt === -1 ? '无限' : opt}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

function VerticalSep() {
  return <span className="mx-1 self-center h-7 w-px bg-gray-200 dark:bg-white/[0.08]" />
}

export default function PlayerControls() {
  const { player, settings, toggleSetting } = useCorpusContext()

  const {
    isPlaying,
    rate,
    loopCount,
    pauseAfterCue,
    intervalGap,
    toggle,
    setRate,
    setLoopCount,
    togglePauseAfterCue,
    setIntervalGap,
    requestFullscreen,
    prevCue,
    nextCue,
  } = player

  return (
    <div className="shrink-0 px-2 py-2 flex items-end justify-center gap-1 overflow-x-auto">
      <RateMenu rate={rate} onChange={setRate} />
      <LabeledBtn
        active={settings.hideVideo}
        onClick={() => toggleSetting('hideVideo')}
        label="隐藏视频"
        ariaLabel={settings.hideVideo ? '显示视频' : '隐藏视频'}
      >
        {settings.hideVideo ? (
          <VideoOff className="w-4 h-4" />
        ) : (
          <Video className="w-4 h-4" />
        )}
      </LabeledBtn>
      <LabeledBtn onClick={requestFullscreen} label="全屏">
        <Maximize className="w-4 h-4" />
      </LabeledBtn>
      <LabeledBtn
        active={settings.showPhonetic}
        onClick={() => toggleSetting('showPhonetic')}
        label="音标"
        ariaLabel="显示音标"
      >
        <span className="text-base font-serif italic leading-none">ə</span>
      </LabeledBtn>

      <VerticalSep />

      <LabeledBtn onClick={prevCue} label="上一句">
        <SkipBack className="w-4 h-4" />
      </LabeledBtn>

      {/* 大号播放/暂停按钮 */}
      <button
        type="button"
        onClick={toggle}
        title={isPlaying ? '暂停' : '播放'}
        className="shrink-0 mx-1 mb-3 w-12 h-12 flex items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/25 dark:bg-white dark:text-gray-900 dark:shadow-white/20 hover:opacity-90 transition-opacity"
      >
        {isPlaying ? (
          <Pause className="w-5 h-5" fill="currentColor" />
        ) : (
          <Play className="w-5 h-5 ml-0.5" fill="currentColor" />
        )}
      </button>

      <LabeledBtn onClick={nextCue} label="下一句">
        <SkipForward className="w-4 h-4" />
      </LabeledBtn>

      <VerticalSep />

      <LoopCountMenu value={loopCount} onChange={setLoopCount} />

      <IntervalMenu value={intervalGap} onChange={setIntervalGap} />

      <LabeledBtn
        active={pauseAfterCue}
        onClick={togglePauseAfterCue}
        label="单句暂停"
      >
        <PauseCircle className="w-4 h-4" />
      </LabeledBtn>
      <LabeledBtn
        active={settings.posHighlight}
        onClick={() => toggleSetting('posHighlight')}
        label="颜色标记"
      >
        <Palette className="w-4 h-4" />
      </LabeledBtn>
    </div>
  )
}

export { RateMenu, LoopCountMenu, IntervalMenu }
