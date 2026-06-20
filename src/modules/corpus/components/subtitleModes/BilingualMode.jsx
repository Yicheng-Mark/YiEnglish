import { useMemo, useRef, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useCorpusContext } from '../../context/CorpusPlayerContext.jsx'
import { useAutoScrollList } from '../../hooks/useAutoScrollList.js'
import { buildPhonetic } from '../../utils/buildPhonetic.js'
import SubtitleCueCard from '../SubtitleCueCard.jsx'

export default function BilingualMode() {
  const { subtitles, player, posMap, wordMap, settings, handleWordClick } = useCorpusContext()

  // id -> index 查找表（虚拟化兜底滚动用）
  const idToIndex = useMemo(() => {
    const m = new Map()
    subtitles?.forEach((s, i) => m.set(s.id, i))
    return m
  }, [subtitles])

  const scrollParentRef = useRef(null)
  const virtualizer = useVirtualizer({
    count: subtitles?.length || 0,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 120,
    overscan: 6,
  })

  const scrollToVirtualIndex = useCallback(
    (idx, opts) => virtualizer.scrollToIndex(idx, opts),
    [virtualizer]
  )

  const { setItemRef, containerProps } = useAutoScrollList(player.activeId, [subtitles], {
    getVirtualIndex: (id) => (idToIndex.has(id) ? idToIndex.get(id) : null),
    scrollToVirtualIndex,
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
              ref={(el) => {
                setItemRef(sub.id)(el)
                virtualizer.measureElement(el)
              }}
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
                onClick={() => player.jumpToCue(sub.id)}
                onWordClick={handleWordClick}
                onPlay={() => player.jumpToCue(sub.id)}
                posHighlight={settings?.posHighlight}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
