import { memo, useMemo, useState } from 'react'
import { Bookmark, Star } from 'lucide-react'
import { formatTime } from '../../../utils/formatTime'
import { resolveVideoCover } from '../utils/videoCover'
import { getDifficultyLevel, DIFFICULTY_TIERS } from '../utils/difficulty'

const DIFFICULTY_TAG = {
  1: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
  2: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300',
  3: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  4: 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-300',
  5: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300',
}

const CATEGORY_TAG = {
  '健康': 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300',
  '教育': 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300',
  '文化': 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300',
  '旅行': 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
  '生活': 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  '科技': 'bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-300',
  '社会': 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300',
  '环境': 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
  '经济': 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300',
  '心理': 'bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-500/10 dark:text-fuchsia-300',
  '商业': 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300',
  '演讲': 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-300',
}

const DEFAULT_TAG = 'bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-300'

const TAG_TONE = 'bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-300'

function StarRating({ rating = 0 }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${
            i < rating
              ? 'text-amber-400 fill-amber-400'
              : 'text-gray-300 dark:text-gray-600'
          }`}
          strokeWidth={2}
        />
      ))}
    </div>
  )
}

function VideoCard({ video, isBookmarked = false, onClick, onToggleBookmark }) {
  const level = getDifficultyLevel(video.sentenceCount)
  const diffClass = DIFFICULTY_TAG[level]
  const diffLabel = DIFFICULTY_TIERS[level - 1].label
  const coverUrl = useMemo(() => resolveVideoCover(video), [video])
  const [coverFailed, setCoverFailed] = useState(false)
  const showCover = coverUrl && !coverFailed

  return (
    <div
      onClick={() => onClick?.(video.id)}
      className="group card card-hover relative overflow-hidden cursor-pointer glow-border-subtle active:scale-[0.98] transition-transform duration-150 flex flex-col bg-white dark:bg-white/[0.03] rounded-xl shadow-sm h-auto max-h-[480px] md:h-[480px]"
    >
      {/* 收藏按钮 */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggleBookmark?.(video.id)
        }}
        aria-label={isBookmarked ? '取消收藏' : '收藏视频'}
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

      {/* 缩略图 */}
      <div className="aspect-video bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 relative overflow-hidden">
        {showCover && (
          <img
            src={coverUrl}
            alt={video.title}
            loading="lazy"
            decoding="async"
            onError={() => setCoverFailed(true)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {showCover && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-black/0" />
        )}
        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded text-xs bg-black/70 text-white">
          {formatTime(video.durationSec)}
        </div>
        {video.speaker && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded text-xs bg-black/70 text-white/90">
            @{video.speaker}
          </div>
        )}
      </div>

      {/* 卡片正文 */}
      <div className="p-4 flex flex-col flex-1">
        {/* 第 X 期 + 星级 */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-content dark:text-gray-100">
            第 {parseInt(video.id, 10) || video.id} 期
          </h2>
          <StarRating rating={level} />
        </div>

        {/* 标签 + 口音 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${diffClass}`}
            >
              {diffLabel}
            </span>
            {video.category && (
              <span
                className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_TAG[video.category] || DEFAULT_TAG}`}
              >
                {video.category}
              </span>
            )}
            {video.tags?.filter((t) => t !== video.category).slice(0, 2).map((t) => (
              <span
                key={t}
                className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${TAG_TONE}`}
              >
                {t}
              </span>
            ))}
          </div>
          {video.accent && (
            <span className="text-sm text-content-tertiary dark:text-gray-400 shrink-0 ml-2">
              口音：{video.accent}
            </span>
          )}
        </div>

        <h3 className="text-lg font-bold leading-tight mb-1 text-content dark:text-gray-100 group-hover:text-primary transition-colors line-clamp-2">
          {video.title}
        </h3>

        {video.subtitle && (
          <p className="text-sm text-content-tertiary dark:text-gray-400 mb-2 line-clamp-1">
            {video.subtitle}
          </p>
        )}

        <p className="text-sm text-content-tertiary dark:text-gray-400 line-clamp-2 mb-3 leading-relaxed">
          {video.description}
        </p>

        {/* 底部 */}
        <div className="mt-auto pt-2 flex items-end justify-between">
          <span className="text-sm text-content-tertiary dark:text-gray-500">
            词汇量：{video.vocabCount}
          </span>
          <div className="flex flex-col items-end text-sm text-content-tertiary dark:text-gray-500">
            <span>{video.sentenceCount} 条字幕</span>
            <span className="mt-0.5">{video.date}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default memo(VideoCard)
