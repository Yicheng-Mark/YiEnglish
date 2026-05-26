import { useMemo } from 'react'
import { useCorpusContext } from '../../context/CorpusPlayerContext.jsx'
import { useAutoScrollList } from '../../hooks/useAutoScrollList.js'
import { buildPhonetic } from '../../utils/buildPhonetic.js'
import SubtitleCueCard from '../SubtitleCueCard.jsx'

export default function BilingualMode() {
  const { subtitles, player, posMap, wordMap, settings, handleWordClick } = useCorpusContext()
  const { setItemRef, containerProps } = useAutoScrollList(player.activeId)

  const phoneticArr = useMemo(() => {
    if (!settings?.showPhonetic || !subtitles?.length || !wordMap) return null
    return subtitles.map((s) => buildPhonetic(s.en, wordMap))
  }, [subtitles, wordMap, settings?.showPhonetic])

  if (!subtitles?.length) return null

  return (
    <div
      {...containerProps}
      className="h-full overflow-y-auto divide-y divide-gray-200/60 dark:divide-white/[0.05]"
    >
      {subtitles.map((sub, idx) => {
        const active = sub.id === player.activeId
        return (
          <div
            ref={setItemRef(sub.id)}
            key={sub.id}
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
  )
}
