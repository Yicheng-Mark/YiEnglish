import { memo } from 'react'
import { ArrowRight, Bookmark } from 'lucide-react'
import { formatLastRead } from '../hooks/useReadingStore'

const CATEGORY_TAG = {
  健康: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300',
  教育: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300',
  文化: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300',
  生活: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  科技: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-300',
  社会: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300',
  环境: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
  经济: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300',
}

const DEFAULT_TAG = 'bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-300'

function ArticleCard({
  article,
  readPercent = 0,
  lastReadAt,
  isBookmarked = false,
  onClick,
  onToggleBookmark,
}) {
  const tagClass = CATEGORY_TAG[article.category] || DEFAULT_TAG
  const dateLabel = formatLastRead(lastReadAt)
  const hasRead = readPercent > 0

  return (
    <div
      onClick={() => onClick?.(article.id)}
      className="group card card-hover relative overflow-hidden cursor-pointer glow-border-subtle active:scale-[0.98] transition-transform duration-150 flex flex-col min-h-[280px] h-full rounded-xl shadow-sm"
    >
      {/* 收藏按钮 */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggleBookmark?.(article.id)
        }}
        aria-label={isBookmarked ? '取消收藏' : '收藏文章'}
        className={`absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150 active:scale-90 ${
          isBookmarked
            ? 'text-amber-500 bg-amber-50 dark:bg-amber-500/15'
            : 'text-content-tertiary dark:text-gray-500 hover:text-amber-500 hover:bg-amber-50/60 dark:hover:bg-amber-500/10'
        }`}
      >
        <Bookmark
          className="w-4 h-4"
          strokeWidth={2}
          fill={isBookmarked ? 'currentColor' : 'none'}
        />
      </button>

      <div className="p-5 flex flex-col flex-1 justify-between">
        {/* 顶部：分类 + 类型标签 */}
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${tagClass}`}
              >
                {article.category}
              </span>
            </div>
          </div>
        </div>

        {/* 阅读进度 */}
        {hasRead && (
          <div className="flex items-center gap-2 text-xs text-content-tertiary dark:text-gray-500 mb-2">
            <span
              className={`w-1.5 h-1.5 rounded-full ${hasRead ? 'bg-primary' : 'bg-content-tertiary/50 dark:bg-gray-600'}`}
            />
            <span>
              已读 {readPercent}%{dateLabel ? ` · ${dateLabel}` : ''}
            </span>
          </div>
        )}

        {/* 英文标题 */}
        <h3 className="text-lg font-bold leading-tight mb-1 text-content dark:text-gray-100 group-hover:text-primary transition-colors line-clamp-2">
          {article.enTitle || article.title}
        </h3>

        {/* 中文意思 */}
        {article.cnTitle && (
          <p className="text-base text-content-tertiary dark:text-gray-400 mb-2 leading-relaxed line-clamp-1">
            {article.cnTitle}
          </p>
        )}

        {/* 描述（3行截断） */}
        <p className="text-sm text-content-tertiary dark:text-gray-400 line-clamp-3 mb-4 leading-relaxed">
          {article.description}
        </p>

        {/* 底部区域：始终固定在卡片底部 */}
        <div className="mt-auto">
          <div className="border-t border-gray-200/70 dark:border-white/[0.06]" />
          <div className="flex items-center justify-between pt-3">
            <div className="flex items-center gap-2 text-xs text-content-tertiary dark:text-gray-500">
              <span>{article.year}</span>
              <span className="text-gray-300 dark:text-gray-700">|</span>
              <span>{article.wordCount} 词</span>
            </div>
            <button
              type="button"
              tabIndex={-1}
              className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/[0.06] text-content-secondary dark:text-white flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all duration-200"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default memo(ArticleCard)
