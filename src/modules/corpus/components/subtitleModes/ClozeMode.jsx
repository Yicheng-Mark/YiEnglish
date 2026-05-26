import { useMemo } from 'react'
import { formatTime } from '../../../../utils/formatTime.js'
import { useCorpusContext } from '../../context/CorpusPlayerContext.jsx'
import { useAutoScrollList } from '../../hooks/useAutoScrollList.js'
import { ColorizedText } from '../ColorizedToken.jsx'
import { pickClozeIndices, tokenizeEnglish } from '../../utils/wordColorMap.js'

export default function ClozeMode() {
  const { subtitles, player, posMap, handleWordClick, settings } = useCorpusContext()
  const { setItemRef, containerProps } = useAutoScrollList(player.activeId)

  // 每条字幕预先算出 clozeIndices（确定性 seed by sub.id）
  const clozeMap = useMemo(() => {
    const m = new Map()
    if (!Array.isArray(subtitles)) return m
    for (const sub of subtitles) {
      const tokens = tokenizeEnglish(sub.en || '')
      const indices = pickClozeIndices(tokens, posMap, sub, 0.25)
      m.set(sub.id, indices)
    }
    return m
  }, [subtitles, posMap])

  if (!subtitles?.length) return null

  return (
    <div
      {...containerProps}
      className="h-full overflow-y-auto p-2 md:p-3 space-y-2 bg-surface dark:bg-white/[0.03] border border-gray-200/70 dark:border-white/[0.06] rounded-2xl shadow-sm"
    >
      {subtitles.map((sub) => {
        const active = sub.id === player.activeId
        const indices = clozeMap.get(sub.id) || new Set()
        return (
          <div
            ref={setItemRef(sub.id)}
            key={sub.id}
            onClick={() => player.jumpToCue(sub.id)}
            className={
              'p-3 rounded-xl cursor-pointer transition-all select-none border ' +
              (active
                ? 'bg-primary-soft border-primary/30 dark:bg-primary-soft dark:border-primary/30'
                : 'bg-transparent border-transparent hover:bg-gray-100/60 dark:hover:bg-white/[0.04]')
            }
          >
            <div className="text-xs text-content-tertiary dark:text-gray-500 mb-1 tabular-nums">
              {subtitles.indexOf(sub) + 1} · {formatTime(sub.start)} — {formatTime(sub.end)}
            </div>
            {sub.en && (
              <div
                className={`text-base mb-1 leading-snug ${
                  active ? 'font-semibold' : 'font-medium text-content dark:text-gray-100'
                }`}
              >
                <ColorizedText
                  text={sub.en}
                  paraKey={`cz-${sub.id}`}
                  posMap={posMap}
                  onWordClick={handleWordClick}
                  clozeIndices={indices}
                  showColor={settings?.posHighlight}
                />
              </div>
            )}
            {sub.zh && (
              <div
                className={`leading-relaxed text-sm ${
                  active ? 'text-primary/80' : 'text-content-tertiary dark:text-gray-400'
                }`}
              >
                {sub.zh}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
