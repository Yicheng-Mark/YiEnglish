import { useCallback, useRef, useState } from 'react'
import { Play, Pause, ArrowLeft, Settings } from 'lucide-react'
import { useCorpusContext } from '../../context/CorpusPlayerContext.jsx'
import SettingsPanel from '../SettingsPanel.jsx'
import { resolveVideoCover } from '../../utils/videoCover.js'
import { handleVideoPlaybackError } from '../../utils/videoError.js'

export default function MobileVideoCover({ onBack }) {
  const { videoRef, video, player, videoCallbackRef } = useCorpusContext()
  const posterUrl = resolveVideoCover(video)
  const [hasPlayed, setHasPlayed] = useState(false)
  const [tapIcon, setTapIcon] = useState(null) // 'play' | 'pause' | null
  const [settingsOpen, setSettingsOpen] = useState(false)
  const tapTimerRef = useRef(null)

  const showTapIcon = useCallback((icon) => {
    setTapIcon(icon)
    clearTimeout(tapTimerRef.current)
    tapTimerRef.current = setTimeout(() => setTapIcon(null), 600)
  }, [])

  const handleTap = useCallback(async (e) => {
    if (e.target.closest('button[data-action]')) return

    const el = videoRef.current
    if (!el) return

    if (!hasPlayed) {
      try {
        await el.play()
        setHasPlayed(true)
      } catch {
        // autoplay blocked
      }
      return
    }

    player.toggle()
    showTapIcon(el.paused ? 'play' : 'pause')
  }, [videoRef, hasPlayed, player, showTapIcon])

  const handlePlay = useCallback(() => setHasPlayed(true), [])
  const handlePause = useCallback(() => {}, [])

  return (
    <div
      className="mobile-video-section shrink-0 relative w-full overflow-hidden bg-black"
      style={{ height: '32vh', minHeight: 180, maxHeight: 280 }}
    >
      {/* Video element lives here (shared ref via context) */}
      <video
        ref={videoCallbackRef}
        src={video?.videoUrl}
        poster={posterUrl || undefined}
        preload="metadata"
        playsInline
        webkit-playsinline="true"
        x5-playsinline="true"
        x5-video-player-type="h5"
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={() => setHasPlayed(false)}
        onError={(e) => handleVideoPlaybackError(video?.videoUrl, e)}
        className="w-full h-full object-cover block"
      />

      {/* Tap area for play/pause — only after first play */}
      {hasPlayed && (
        <div
          className="absolute inset-0 cursor-pointer"
          onClick={handleTap}
        />
      )}

      {/* Overlay: big play button before first play */}
      {!hasPlayed && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer"
          onClick={handleTap}
        >
          <div
            className="w-16 h-16 rounded-full bg-white/95 flex items-center justify-center shadow-lg"
            style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
          >
            <Play className="w-6 h-6 text-gray-900 ml-0.5" fill="currentColor" />
          </div>
        </div>
      )}

      {/* Tap feedback icon — briefly appears on pause/play */}
      {tapIcon && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-14 h-14 rounded-full bg-black/50 flex items-center justify-center animate-[fadeOut_0.6s_ease-out_forwards]">
            {tapIcon === 'pause' ? (
              <Pause className="w-6 h-6 text-white" fill="currentColor" />
            ) : (
              <Play className="w-6 h-6 text-white ml-0.5" fill="currentColor" />
            )}
          </div>
        </div>
      )}

      {/* Back button — top-left, always visible */}
      {onBack && (
        <button
          type="button"
          data-action="back"
          onClick={onBack}
          className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center z-10"
          aria-label="返回列表"
        >
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>
      )}

      {/* Settings button — top-right */}
      <button
        type="button"
        data-action="settings"
        onClick={() => setSettingsOpen(true)}
        className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center z-10"
        aria-label="设置"
      >
        <Settings className="w-4 h-4 text-white" />
      </button>
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Bottom gradient with title */}
      <div className="absolute bottom-0 left-0 right-0 px-4 pt-5 pb-3 bg-gradient-to-t from-black/60 via-black/20 to-transparent pointer-events-none">
        {video?.id && (
          <span className="text-white/80 text-[10px] font-semibold tracking-wide">
            Ep.{video.id}
          </span>
        )}
        <h1 className="text-white text-sm font-bold truncate mt-0.5 drop-shadow-sm">
          {video?.title || ''}
        </h1>
      </div>
    </div>
  )
}
