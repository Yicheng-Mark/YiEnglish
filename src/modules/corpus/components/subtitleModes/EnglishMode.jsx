import { formatTime } from '../../../../utils/formatTime.js'
import { useCorpusContext } from '../../context/CorpusPlayerContext.jsx'
import { useAutoScrollList } from '../../hooks/useAutoScrollList.js'
import { ColorizedText } from '../ColorizedToken.jsx'

export default function EnglishMode() {
  const { subtitles, player, posMap, handleWordClick, settings } = useCorpusContext()
  const { setItemRef, containerProps } = useAutoScrollList(player.activeId)

  if (!subtitles?.length) return null

  return (
    <div
      {...containerProps}
      className="h-full overflow-y-auto p-2 md:p-3 space-y-2 bg-surface dark:bg-white/[0.03] border border-gray-200/70 dark:border-white/[0.06] rounded-2xl shadow-sm"
    >
      {subtitles.map((sub) => {
        const active = sub.id === player.activeId
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
        )
      })}
    </div>
  )
}
