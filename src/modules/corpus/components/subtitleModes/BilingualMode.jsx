import { useMemo } from 'react'
import { useCorpusContext } from '../../context/CorpusPlayerContext.jsx'
import { buildPhonetic } from '../../utils/buildPhonetic.js'
import SubtitleCueCard from '../SubtitleCueCard.jsx'
import { useSubtitleVirtualList } from './useSubtitleVirtualList.js'

export default function BilingualMode() {
  const { subtitles, player, posMap, wordMap, settings, handleWordClick } = useCorpusContext()

  // 虚拟化骨架：滚动容器 + 动态测量 + 自动滚动兜底（共享 hook）
  const { scrollParentRef, virtualizer, setRowRef, containerProps } = useSubtitleVirtualList({
    items: subtitles,
    activeId: player.activeId,
    deps: [subtitles],
  })

  const phoneticArr = useMemo(() => {
    if (!settings?.showPhonetic || !subtitles?.length || !wordMap) return null
    return subtitles.map((s) => buildPhonetic(s.en, wordMap))
  }, [subtitles, wordMap, settings?.showPhonetic])

  if (!subtitles?.length) return null

  const virtualItems = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()

  return (
    <div
      ref={scrollParentRef}
      {...containerProps}
      className="h-full overflow-y-auto divide-y divide-gray-200/60 dark:divide-white/[0.05]"
    >
      <div style={{ height: `${totalSize}px`, width: '100%', position: 'relative' }}>
        {virtualItems.map((virtualRow) => {
          const idx = virtualRow.index
          const sub = subtitles[idx]
          const active = sub.id === player.activeId
          return (
            <div
              ref={setRowRef(sub.id)}
              key={sub.id}
              data-index={idx}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <SubtitleCueCard
                subtitle={sub}
                index={idx}
                active={active}
                posMap={posMap}
                phonetic={phoneticArr ? phoneticArr[idx] : ''}
                onJump={player.jumpToCue}
                onWordClick={handleWordClick}
                posHighlight={settings?.posHighlight}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
