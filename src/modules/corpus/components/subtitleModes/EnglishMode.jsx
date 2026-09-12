import { formatTime } from '../../../../utils/formatTime.js'
import { useCorpusContext } from '../../context/CorpusPlayerContext.jsx'
import { ColorizedText } from '../ColorizedToken.jsx'
import { useSubtitleVirtualList } from './useSubtitleVirtualList.js'

export default function EnglishMode() {
  const { subtitles, player, posMap, handleWordClick, settings } = useCorpusContext()
  // 虚拟化：只渲染视口附近行（旧实现 subtitles.map 全量渲染，每换句整表 reconcile）。
  // 原 space-y-2 的 8px 行距由行包装器的 pb-2 等效替代。
  const { scrollParentRef, virtualizer, setRowRef, containerProps } = useSubtitleVirtualList({
    items: subtitles,
    activeId: player.activeId,
    deps: [subtitles],
    estimateSize: 110,
  })

  if (!subtitles?.length) return null

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
          const sub = subtitles[virtualRow.index]
          const active = sub.id === player.activeId
          return (
            <div
              ref={setRowRef(sub.id)}
              key={sub.id}
              data-index={virtualRow.index}
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
                  {formatTime(sub.start)} — {formatTime(sub.end)}
                </div>
                {sub.en && (
                  <div
                    className={`text-base leading-snug ${
                      active ? 'font-semibold' : 'text-content dark:text-gray-100'
                    }`}
                  >
                    <ColorizedText
                      text={sub.en}
                      paraKey={`en-${sub.id}`}
                      posMap={posMap}
                      onWordClick={handleWordClick}
                      showColor={settings?.posHighlight}
                    />
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
