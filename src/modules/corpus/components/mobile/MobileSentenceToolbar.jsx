import { Play, Pause, Copy, SkipForward, Heart, Mic } from 'lucide-react'
import { useCorpusContext } from '../../context/CorpusPlayerContext.jsx'

export default function MobileSentenceToolbar() {
  const { player, subtitles } = useCorpusContext()

  const handleCopy = () => {
    const current = subtitles?.find((s) => s.id === player.activeId)
    if (!current) return
    const text = `${current.en}\n${current.zh || ''}`
    navigator.clipboard.writeText(text).catch(() => {})
  }

  const iconCls =
    'w-9 h-9 flex items-center justify-center rounded-full transition-colors active:opacity-70'

  return (
    <div className="flex items-center justify-between px-2 py-2">
      {/* Copy */}
      <button type="button" onClick={handleCopy} className={iconCls} style={{ color: 'var(--mobile-icon-color)' }} title="复制" aria-label="复制">
        <Copy className="w-[18px] h-[18px]" />
      </button>

      {/* Heart (placeholder) */}
      <button type="button" onClick={() => {}} className={iconCls} style={{ color: 'var(--mobile-icon-color)' }} title="收藏" aria-label="收藏">
        <Heart className="w-[18px] h-[18px]" />
      </button>

      {/* Center play/pause — large */}
      <button
        type="button"
        onClick={player.toggle}
        className="w-12 h-12 flex items-center justify-center rounded-full shadow-lg active:opacity-80 transition-opacity"
        style={{ backgroundColor: 'var(--mobile-primary)', color: '#fff' }}
        title={player.isPlaying ? '暂停' : '播放'}
        aria-label={player.isPlaying ? '暂停' : '播放'}
      >
        {player.isPlaying ? (
          <Pause className="w-5 h-5" fill="currentColor" />
        ) : (
          <Play className="w-5 h-5 ml-0.5" fill="currentColor" />
        )}
      </button>

      {/* Mic (placeholder) */}
      <button type="button" onClick={() => {}} className={iconCls} style={{ color: 'var(--mobile-icon-color)' }} title="录音" aria-label="录音">
        <Mic className="w-[18px] h-[18px]" />
      </button>

      {/* Next */}
      <button type="button" onClick={player.nextCue} className={iconCls} style={{ color: 'var(--mobile-icon-color)' }} title="下一句" aria-label="下一句">
        <SkipForward className="w-[18px] h-[18px]" />
      </button>
    </div>
  )
}
