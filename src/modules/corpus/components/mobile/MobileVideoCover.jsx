import { useCallback, useRef, useState } from 'react'
import { Play, Pause, Maximize } from 'lucide-react'
import { useCorpusContext } from '../../context/CorpusPlayerContext.jsx'

export default function MobileVideoCover() {
  const { videoRef, video, player } = useCorpusContext()
  const containerRef = useRef(null)
  const [hasPlayed, setHasPlayed] = useState(false)

  const handleTap = useCallback(async () => {
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

    // Already played — toggle fullscreen
    try {
      if (containerRef.current?.requestFullscreen) {
        await containerRef.current.requestFullscreen()
      } else if (el.webkitEnterFullscreen) {
        el.webkitEnterFullscreen()
      }
    } catch {
      // fullscreen not supported
    }
  }, [videoRef, hasPlayed])

  const handlePlay = useCallback(() => setHasPlayed(true), [])
  const handlePause = useCallback(() => {}, [])

  return (
    <div
      ref={containerRef}
      className="mobile-video-section shrink-0 relative w-full overflow-hidden bg-black"
      style={{ height: '32vh', minHeight: 180, maxHeight: 280 }}
    >
      {/* Video element lives here (shared ref via context) */}
      <video
        ref={videoRef}
        src={video?.videoUrl}
        poster={video?.posterUrl}
        preload="metadata"
        playsInline
        webkit-playsinline="true"
        x5-playsinline="true"
        x5-video-player-type="h5"
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={() => setHasPlayed(false)}
        className="w-full h-full object-cover block"
      />

      {/* Overlay: play button when paused / fullscreen hint when playing */}
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

      {/* Fullscreen hint on playing video */}
      {hasPlayed && (
        <button
          type="button"
          onClick={handleTap}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
          aria-label="全屏"
        >
          <Maximize className="w-4 h-4 text-white" />
        </button>
      )}

      {/* Bottom gradient with title */}
      <div className="absolute bottom-0 left-0 right-0 px-4 pt-5 pb-3 bg-gradient-to-t from-black/60 via-black/20 to-transparent">
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
