import { VideoOff } from 'lucide-react'
import { useCorpusContext } from '../context/CorpusPlayerContext.jsx'
import { formatTime } from '../../../utils/formatTime.js'
import { handleVideoPlaybackError } from '../utils/videoError.js'

export default function VideoPlayer({ src, poster }) {
  const { videoRef, player, settings, toggleSetting } = useCorpusContext()
  const { currentTime, duration, seek } = player
  const max = duration > 0 ? duration : 0
  const hidden = !!settings?.hideVideo

  return (
    <div className="rounded-2xl overflow-hidden bg-black w-full aspect-video shrink-0 relative border border-gray-200/60 dark:border-white/[0.06] shadow-lg dark:shadow-2xl dark:shadow-black/40">
      <video
        ref={videoRef}
        src={src}
        poster={poster || undefined}
        controls={false}
        preload="metadata"
        playsInline
        loop={settings?.videoLoop}
        onError={(e) => handleVideoPlaybackError(src, e)}
        className={`w-full h-full bg-black ${hidden ? 'opacity-0' : ''}`}
      />

      {hidden && (
        <button
          type="button"
          onClick={() => toggleSetting('hideVideo')}
          className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-surface dark:bg-white/[0.04] text-content-secondary dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition-colors"
          aria-label="显示视频"
        >
          <VideoOff className="w-6 h-6 mb-1 opacity-70" />
          <span className="text-sm">已隐藏视频</span>
          <span className="text-xs text-content-tertiary dark:text-gray-500">点击显示</span>
        </button>
      )}

      {/* 底部叠加进度条 */}
      <div className="absolute bottom-0 left-0 right-0 px-3 pb-2 pointer-events-none">
        <div className="flex items-center gap-2 text-[11px] text-white/85 tabular-nums drop-shadow">
          <span className="shrink-0 w-9 text-right">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={max || 0}
            step={0.1}
            value={Math.min(currentTime, max)}
            onChange={(e) => seek(parseFloat(e.target.value))}
            aria-label="进度"
            className="flex-1 corpus-video-range cursor-pointer pointer-events-auto"
          />
          <span className="shrink-0 w-9">{formatTime(max)}</span>
        </div>
      </div>
    </div>
  )
}
