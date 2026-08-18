import { memo } from 'react'

function StatsPanel({ stats, keyboardHeight = 0 }) {
  const isCompact = keyboardHeight > 0
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  const items = [
    {
      label: '时间',
      value: formatTime(stats.time),
      icon: (
        <svg
          className="w-3 h-3 md:w-4 md:h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    {
      label: '输入数',
      value: stats.inputCount,
      icon: (
        <svg
          className="w-3 h-3 md:w-4 md:h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
          />
        </svg>
      ),
    },
    {
      label: 'WPM',
      value: stats.wpm,
      icon: (
        <svg
          className="w-3 h-3 md:w-4 md:h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      ),
    },
    {
      label: '正确数',
      value: stats.correctCount,
      icon: (
        <svg
          className="w-3 h-3 md:w-4 md:h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    {
      label: '正确率',
      value: `${Math.round(stats.accuracy * 100)}%`,
      icon: (
        <svg
          className="w-3 h-3 md:w-4 md:h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"
          />
        </svg>
      ),
    },
  ]

  const StatItem = ({ item, compact }) => (
    <div
      className={`flex flex-col items-center ${compact ? 'flex-1 min-w-0' : 'w-[26%] md:w-auto'}`}
    >
      <div
        className={`
        font-extrabold text-primary dark:text-primary-dark tabular-nums tracking-tight
        dark:drop-shadow-[0_0_8px_rgba(99,102,241,0.35)]
        ${compact ? 'text-[clamp(1.2rem,5vw,1.8rem)] leading-[1.1]' : 'text-xl md:text-4xl leading-none'}
      `}
      >
        {item.value}
      </div>
      <div
        className={`
        text-content-tertiary dark:text-gray-500 flex items-center
        ${compact ? 'text-[10px] mt-0 gap-0.5 leading-[1.1]' : 'text-[10px] md:text-base mt-0.5 md:mt-1 gap-0.5 md:gap-1'}
      `}
      >
        {item.icon}
        <span>{item.label}</span>
      </div>
    </div>
  )

  return (
    <div
      className={`
        stats-panel relative
        bg-white/90 backdrop-blur-sm
        border-t border-gray-200/60 dark:border-white/[0.04]
        transition-all duration-200 ease-out
        ${
          isCompact
            ? 'stats-compact shrink-0 pt-1.5 px-3 z-30'
            : 'shrink-0 pt-3 md:pt-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-[calc(1rem+env(safe-area-inset-bottom))] px-3 md:px-6 z-30'
        }
      `}
    >
      {isCompact ? (
        <div className="max-w-2xl mx-auto flex flex-col gap-1">
          <div className="flex justify-around">
            {items.slice(0, 3).map((item) => (
              <StatItem key={item.label} item={item} compact={true} />
            ))}
          </div>
          <div className="flex justify-around">
            {items.slice(3).map((item) => (
              <StatItem key={item.label} item={item} compact={true} />
            ))}
          </div>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto text-center flex flex-wrap justify-center md:grid md:grid-cols-5 gap-x-8 gap-y-2 md:gap-4">
          {items.map((item) => (
            <StatItem key={item.label} item={item} compact={false} />
          ))}
        </div>
      )}
    </div>
  )
}

export default memo(StatsPanel)
