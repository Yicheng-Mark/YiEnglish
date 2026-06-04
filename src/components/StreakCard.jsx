const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']

export default function StreakCard({ streak }) {
  const { current, longest, weeklyDots, todayProgress, todayGoalSeconds, todayGoalTarget } = streak

  const todayMinutes = Math.round(todayGoalSeconds / 60)
  const targetMinutes = Math.round(todayGoalTarget / 60)
  const progressPercent = Math.round(todayProgress * 100)

  return (
    <div className="bg-surface dark:bg-surface-dark rounded-2xl p-5 md:p-6 shadow-sm border border-gray-100/80 dark:border-white/[0.06] mb-6 md:mb-8">
      {/* 连续天数 */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🔥</span>
        <span className="text-3xl md:text-4xl font-bold text-primary">
          {current}
        </span>
        <span className="text-base text-content-secondary dark:text-gray-400">
          天连续
        </span>
        {longest > current && (
          <span className="ml-auto text-xs text-content-tertiary dark:text-gray-500">
            最长 {longest} 天
          </span>
        )}
      </div>

      {/* 本周圆点 */}
      <div className="flex items-center gap-0 mb-5">
        <span className="text-xs text-content-secondary dark:text-gray-400 mr-3 shrink-0">本周</span>
        <div className="flex items-center gap-3">
          {weeklyDots.map((done, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div
                className={`w-6 h-6 rounded-full transition-colors ${
                  done
                    ? 'bg-emerald-500'
                    : 'bg-gray-200 dark:bg-white/[0.08]'
                }`}
              />
              <span className="text-[10px] text-content-tertiary dark:text-gray-500">
                {WEEKDAY_LABELS[i]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 今日目标进度条 */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-content-secondary dark:text-gray-400">今日目标</span>
          <span className="text-xs font-medium text-content-secondary dark:text-gray-400">
            {progressPercent}%（{todayMinutes}/{targetMinutes} 分钟）
          </span>
        </div>
        <div className="h-2 rounded-full bg-gray-200 dark:bg-white/[0.08]">
          <div
            className="h-2 rounded-full bg-primary transition-all duration-500"
            style={{ width: `${Math.max(todayProgress * 100, 0)}%` }}
          />
        </div>
      </div>
    </div>
  )
}
