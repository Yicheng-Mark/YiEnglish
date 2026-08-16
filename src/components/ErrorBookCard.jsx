export default function ErrorBookCard({ count, onClick }) {
  const hasErrors = count > 0

  return (
    <div
      onClick={onClick}
      className="
        group relative flex flex-col justify-between overflow-hidden
        rounded-2xl border-2 p-6
        animate-card-enter glow-border-subtle
        transition-all duration-150 active:scale-[0.98]
        border-red-200 bg-gradient-to-br from-red-50 to-orange-50 cursor-pointer hover:shadow-lg hover:border-red-300
        dark:border dark:bg-surface dark:from-transparent dark:to-transparent dark:border-white/[0.09]
      "
    >
      {/* 顶部红色条（仅亮色模式；暗夜中性化后隐藏） */}
      <div className="absolute top-0 left-0 w-full h-1 bg-red-500 opacity-80 dark:hidden" />

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`
            flex h-10 w-10 items-center justify-center rounded-xl
            ${
              hasErrors
                ? 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400'
                : 'bg-red-50 text-red-400 dark:bg-white/[0.04] dark:text-gray-500'
            }
          `}
          >
            {/* 错题本书本图标 */}
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-red-900 dark:text-gray-100">错题本</h3>
            <p className="text-sm text-red-600/80 dark:text-gray-400">专属错题练习</p>
          </div>
        </div>
        {count > 0 && (
          <span className="flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-red-500 px-2 text-xs font-bold text-white shadow-sm">
            {count}
          </span>
        )}
      </div>

      <div className="mt-4">
        <div className="inline-flex items-center rounded-lg bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700 dark:bg-white/[0.06] dark:text-gray-300">
          我的错题
        </div>
        <p className="mt-2 text-sm text-red-600/70 dark:text-gray-500">
          {count > 0 ? `共 ${count} 个待复习单词` : '暂无错题，去练习吧！'}
        </p>
      </div>
    </div>
  )
}
