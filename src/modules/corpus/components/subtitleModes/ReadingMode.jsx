import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useCorpusContext } from '../../context/CorpusPlayerContext.jsx'
import { ColorizedText } from '../ColorizedToken.jsx'
import { useSubtitleVirtualList } from './useSubtitleVirtualList.js'

export default function ReadingMode() {
  const { subtitles, player, posMap, handleWordClick, settings } = useCorpusContext()
  // 虚拟化：只渲染视口附近行；行高随展开/收起变化由 measureElement 实测回填
  const { scrollParentRef, virtualizer, setRowRef, containerProps } = useSubtitleVirtualList({
    items: subtitles,
    activeId: player.activeId,
    deps: [subtitles],
    estimateSize: 64,
  })
  const [manualExpanded, setManualExpanded] = useState(() => new Set())

  // 当前活跃句自动展开
  useEffect(() => {
    if (player.activeId == null) return
    setManualExpanded((prev) => {
      const next = new Set(prev)
      next.add(player.activeId)
      return next
    })
  }, [player.activeId])

  if (!subtitles?.length) return null

  const toggleExpand = (id, e) => {
    e.stopPropagation()
    setManualExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
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
          const expanded = manualExpanded.has(sub.id)
          const preview = (sub.en || '').slice(0, 60)
          const truncated = (sub.en || '').length > 60
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
                  'rounded-xl transition-all select-none border ' +
                  (active
                    ? 'bg-primary-soft border-primary/30 dark:bg-primary-soft dark:border-primary/30'
                    : 'bg-transparent border-transparent hover:bg-gray-100/60 dark:hover:bg-white/[0.04]')
                }
              >
                <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer rounded-xl">
                  <span
                    className={`shrink-0 w-7 text-right text-sm tabular-nums ${
                      active
                        ? 'text-primary font-semibold'
                        : 'text-content-tertiary dark:text-gray-500'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div
                    className={`flex-1 min-w-0 truncate text-sm leading-snug ${
                      active ? 'font-semibold' : 'text-content dark:text-gray-200'
                    }`}
                  >
                    {expanded ? null : preview}
                    {!expanded && truncated && '…'}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => toggleExpand(sub.id, e)}
                    className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-200/60 dark:hover:bg-white/[0.06] text-content-tertiary dark:text-gray-500"
                    aria-label={expanded ? '收起' : '展开'}
                  >
                    {expanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {expanded && (
                  <div className="px-3 pb-3 pl-12 space-y-1.5">
                    {sub.en && (
                      <div className="text-base leading-snug text-content dark:text-gray-100">
                        <ColorizedText
                          text={sub.en}
                          paraKey={`rd-${sub.id}`}
                          posMap={posMap}
                          onWordClick={handleWordClick}
                          showColor={settings?.posHighlight}
                        />
                      </div>
                    )}
                    {sub.zh && (
                      <div className="text-sm leading-relaxed text-content-tertiary dark:text-gray-400">
                        {sub.zh}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
