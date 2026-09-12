import { useState, useEffect } from 'react'
import { Eye } from 'lucide-react'
import { formatTime } from '../../../../utils/formatTime.js'
import { useCorpusContext } from '../../context/CorpusPlayerContext.jsx'
import { ColorizedText } from '../ColorizedToken.jsx'
import { useSubtitleVirtualList } from './useSubtitleVirtualList.js'

export default function TranslateMode() {
  const { subtitles, player, posMap, handleWordClick, settings } = useCorpusContext()
  // 虚拟化：只渲染视口附近行；行高随揭示英文变化由 measureElement 实测回填
  const { scrollParentRef, virtualizer, setRowRef, containerProps } = useSubtitleVirtualList({
    items: subtitles,
    activeId: player.activeId,
    deps: [subtitles],
    estimateSize: 110,
  })
  const [revealed, setRevealed] = useState(() => new Set())

  // 活跃句自动揭示英文（一旦激活就保持）
  useEffect(() => {
    if (player.activeId == null) return
    setRevealed((prev) => {
      if (prev.has(player.activeId)) return prev
      const next = new Set(prev)
      next.add(player.activeId)
      return next
    })
  }, [player.activeId])

  if (!subtitles?.length) return null

  const reveal = (id, e) => {
    e.stopPropagation()
    setRevealed((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }

  const virtualItems = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()

  return (
    <div
      ref={scrollParentRef}
      {...containerProps}
      className="h-full overflow-y-auto p-2 md:p-3 bg-surface dark:bg-white/[0.03] border border-gray-200/70 dark:border-white/[0.06] rounded-2xl shadow-sm"
    >
      <div style={{ height: `${totalSize}px`, width: '100%', position: 'relative' }}>
        {virtualItems.map((virtualRow) => {
          const idx = virtualRow.index
          const sub = subtitles[idx]
          const active = sub.id === player.activeId
          const showEn = revealed.has(sub.id)
          return (
            <div
              ref={setRowRef(sub.id)}
              key={sub.id}
              data-index={idx}
              className="pb-2"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div
                onClick={() => player.jumpToCue(sub.id)}
                className={
                  'p-3 rounded-xl cursor-pointer transition-all select-none border ' +
                  (active
                    ? 'bg-primary-soft border-primary/30 dark:bg-primary-soft dark:border-primary/30'
                    : 'bg-transparent border-transparent hover:bg-gray-100/60 dark:hover:bg-white/[0.04]')
                }
              >
                <div className="text-xs text-content-tertiary dark:text-gray-500 mb-1 tabular-nums">
                  {idx + 1} · {formatTime(sub.start)} — {formatTime(sub.end)}
                </div>
                <div
                  className={`leading-relaxed mb-2 ${
                    active ? 'text-base font-semibold' : 'text-base text-content dark:text-gray-100'
                  }`}
                >
                  {sub.zh || ''}
                </div>
                {!showEn && sub.en ? (
                  <button
                    type="button"
                    onClick={(e) => reveal(sub.id, e)}
                    className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-content-secondary dark:text-gray-300 transition-colors"
                  >
                    <Eye className="w-3 h-3" />
                    <span>显示英文</span>
                  </button>
                ) : showEn && sub.en ? (
                  <div
                    className={`text-sm leading-snug ${
                      active ? 'text-primary/80' : 'text-content-secondary dark:text-gray-300'
                    }`}
                  >
                    <ColorizedText
                      text={sub.en}
                      paraKey={`tr-${sub.id}`}
                      posMap={posMap}
                      onWordClick={handleWordClick}
                      showColor={settings?.posHighlight}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
