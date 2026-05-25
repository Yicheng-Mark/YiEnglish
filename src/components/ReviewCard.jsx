export default function ReviewCard({ dueCount, totalCount, onClick }) {
  const hasDue = dueCount > 0;

  return (
    <div
      onClick={onClick}
      className="
        group relative flex flex-col justify-between overflow-hidden
        rounded-2xl border-2 p-6
        animate-card-enter glow-border-subtle
        transition-all duration-150 active:scale-[0.98]
        border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 cursor-pointer hover:shadow-lg hover:border-emerald-300 dark:border-emerald-900/40 dark:from-emerald-950/30 dark:to-teal-950/20 dark:hover:border-emerald-700/60 dark:hover:shadow-emerald-900/20
      "
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 opacity-80" />

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`
            flex h-10 w-10 items-center justify-center rounded-xl
            ${hasDue ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-emerald-50 text-emerald-400 dark:bg-emerald-500/10 dark:text-emerald-500/60'}
          `}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-200">复习计划</h3>
            <p className="text-sm text-emerald-600/80 dark:text-emerald-400/70">间隔重复巩固记忆</p>
          </div>
        </div>
        {dueCount > 0 && (
          <span className="flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-emerald-500 px-2 text-xs font-bold text-white shadow-sm">
            {dueCount}
          </span>
        )}
      </div>

      <div className="mt-4">
        <div className="inline-flex items-center rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
          SM-2 智能复习
        </div>
        <p className="mt-2 text-sm text-emerald-600/70 dark:text-emerald-400/60">
          {dueCount > 0
            ? `${dueCount} 个单词待复习（共 ${totalCount} 个）`
            : totalCount > 0
            ? '今日复习已完成 ✓'
            : '开始练习后会自动加入复习'}
        </p>
      </div>
    </div>
  );
}
