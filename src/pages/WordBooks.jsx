import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDueReviewCount, getTotalReviewCount } from '../utils/reviewCards'
import { getErrorBookCount } from '../utils/errorBook'
import { getReadingWordBookCount } from '../utils/readingWordBook'
import { getCorpusWordBookCount } from '../utils/corpusWordBook'
import { getFavoriteWordsCount } from '../utils/favoriteWords'

const WORD_BOOKS = [
  {
    id: 'review',
    title: '复习计划',
    description: 'SM-2 间隔重复，智能巩固记忆',
    route: '/review/setup/review',
    tag: 'SM-2 智能复习',
    colors: {
      border: 'border-emerald-200',
      bg: 'from-emerald-50 to-teal-50',
      hoverBorder: 'hover:border-emerald-300',
      hoverShadow: 'hover:shadow-emerald-900/20',
      iconBg: 'bg-emerald-100 text-emerald-600',
      title: 'text-emerald-900',
      desc: 'text-emerald-600/80',
      status: 'text-emerald-600/70',
      tagBg: 'bg-emerald-100',
      tagText: 'text-emerald-700',
      badge: 'bg-emerald-500',
      bar: 'bg-emerald-500',
    },
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
    ),
  },
  {
    id: 'error-book',
    title: '错题本',
    description: '练习中的错题自动收录',
    route: '/review/setup/error-book',
    tag: '我的错题',
    colors: {
      border: 'border-red-200',
      bg: 'from-red-50 to-orange-50',
      hoverBorder: 'hover:border-red-300',
      hoverShadow: 'hover:shadow-red-900/20',
      iconBg: 'bg-red-100 text-red-600',
      title: 'text-red-900',
      desc: 'text-red-600/80',
      status: 'text-red-600/70',
      tagBg: 'bg-red-100',
      tagText: 'text-red-700',
      badge: 'bg-red-500',
      bar: 'bg-red-500',
    },
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
        />
      </svg>
    ),
  },
  {
    id: 'reading-word-book',
    title: '阅读词本',
    description: '在阅读语境中积累词汇',
    route: '/review/setup/reading-word-book',
    tag: '阅读',
    colors: {
      border: 'border-violet-200',
      bg: 'from-violet-50 to-purple-50',
      hoverBorder: 'hover:border-violet-300',
      hoverShadow: 'hover:shadow-violet-900/20',
      iconBg: 'bg-violet-100 text-violet-600',
      title: 'text-violet-900',
      desc: 'text-violet-600/80',
      status: 'text-violet-600/70',
      tagBg: 'bg-violet-100',
      tagText: 'text-violet-700',
      badge: 'bg-violet-500',
      bar: 'bg-violet-500',
    },
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
        />
      </svg>
    ),
  },
  {
    id: 'corpus-word-book',
    title: '语料词本',
    description: '从语料字幕中积累词汇',
    route: '/review/setup/corpus-word-book',
    tag: '语料',
    colors: {
      border: 'border-cyan-200',
      bg: 'from-cyan-50 to-sky-50',
      hoverBorder: 'hover:border-cyan-300',
      hoverShadow: 'hover:shadow-cyan-900/20',
      iconBg: 'bg-cyan-100 text-cyan-600',
      title: 'text-cyan-900',
      desc: 'text-cyan-600/80',
      status: 'text-cyan-600/70',
      tagBg: 'bg-cyan-100',
      tagText: 'text-cyan-700',
      badge: 'bg-cyan-500',
      bar: 'bg-cyan-500',
    },
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  {
    id: 'favorite-words',
    title: '收藏词本',
    description: '你收藏的词汇',
    route: '/review/setup/favorite-words',
    tag: '收藏',
    colors: {
      border: 'border-amber-200',
      bg: 'from-amber-50 to-yellow-50',
      hoverBorder: 'hover:border-amber-300',
      hoverShadow: 'hover:shadow-amber-900/20',
      iconBg: 'bg-amber-100 text-amber-600',
      title: 'text-amber-900',
      desc: 'text-amber-600/80',
      status: 'text-amber-600/70',
      tagBg: 'bg-amber-100',
      tagText: 'text-amber-700',
      badge: 'bg-amber-500',
      bar: 'bg-amber-500',
    },
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ),
  },
]

function WordBooks() {
  const navigate = useNavigate()

  const counts = useMemo(
    () => ({
      reviewDue: getDueReviewCount(),
      reviewTotal: getTotalReviewCount(),
      errorBook: getErrorBookCount(),
      readingWord: getReadingWordBookCount(),
      corpusWord: getCorpusWordBookCount(),
      favoriteWord: getFavoriteWordsCount(),
    }),
    []
  )

  const getCount = (id) => {
    switch (id) {
      case 'review':
        return counts.reviewTotal
      case 'error-book':
        return counts.errorBook
      case 'reading-word-book':
        return counts.readingWord
      case 'corpus-word-book':
        return counts.corpusWord
      case 'favorite-words':
        return counts.favoriteWord
      default:
        return 0
    }
  }

  const getStatus = (id) => {
    switch (id) {
      case 'review':
        if (counts.reviewDue > 0)
          return `${counts.reviewDue} 个单词待复习（共 ${counts.reviewTotal} 个）`
        if (counts.reviewTotal > 0) return '今日复习已完成 ✓'
        return '开始练习后会自动加入复习'
      case 'error-book':
        return counts.errorBook > 0 ? `共 ${counts.errorBook} 个待复习单词` : '暂无错题，去练习吧！'
      case 'reading-word-book':
        return counts.readingWord > 0
          ? `已积累 ${counts.readingWord} 个词汇`
          : '精选文章，在阅读中自然掌握单词'
      case 'corpus-word-book':
        return counts.corpusWord > 0
          ? `已积累 ${counts.corpusWord} 个词汇`
          : '观看语料视频，在真实语境中掌握单词'
      case 'favorite-words':
        return counts.favoriteWord > 0
          ? `已收藏 ${counts.favoriteWord} 个词汇`
          : '练习中收藏感兴趣的单词'
      default:
        return ''
    }
  }

  const getBadge = (id) => {
    switch (id) {
      case 'review':
        return counts.reviewDue > 0 ? counts.reviewDue : null
      case 'error-book':
        return counts.errorBook > 0 ? counts.errorBook : null
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-background dark:bg-transparent p-6 transition-colors duration-500 animate-page-fade-in">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate('/word')}
          className="text-content-tertiary dark:text-gray-400 hover:text-primary dark:hover:text-primary-dark mb-8 flex items-center gap-2 text-sm transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.04] w-fit"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          <span className="hidden sm:inline">返回词库列表</span>
        </button>
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-extrabold text-content dark:text-gray-100">功能词本</h1>
          </div>
          <p className="text-content-tertiary dark:text-gray-400 text-sm">
            你的专属词汇集合，随时开始练习
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {WORD_BOOKS.map((book) => {
            const count = getCount(book.id)
            const status = getStatus(book.id)
            const badge = getBadge(book.id)
            const c = book.colors

            return (
              <div
                key={book.id}
                onClick={() => navigate(book.route, { state: { from: '/wordbooks' } })}
                className={`
                  group relative flex flex-col justify-between overflow-hidden
                  rounded-2xl border-2 p-5
                  animate-card-enter glow-border-subtle
                  transition-all duration-150 active:scale-[0.98]
                  cursor-pointer hover:shadow-lg
                  bg-gradient-to-br dark:border dark:bg-surface dark:from-transparent dark:to-transparent dark:border-white/[0.09]
                  ${c.border} ${c.bg} ${c.hoverBorder} ${c.hoverShadow}
                `}
              >
                <div
                  className={`absolute top-0 left-0 w-full h-1 ${c.bar} opacity-80 dark:hidden`}
                />

                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl dark:bg-white/[0.06] dark:text-gray-300 ${c.iconBg}`}
                    >
                      {book.icon}
                    </div>
                    <div>
                      <h3 className={`text-lg font-bold dark:text-gray-100 ${c.title}`}>
                        {book.title}
                      </h3>
                      <p className={`text-sm dark:text-gray-400 ${c.desc}`}>{book.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {badge !== null && (
                      <span
                        className={`flex h-6 min-w-[1.5rem] items-center justify-center rounded-full ${c.badge} px-2 text-xs font-bold text-white shadow-sm`}
                      >
                        {badge}
                      </span>
                    )}
                    <svg
                      className={`w-5 h-5 dark:text-gray-300 ${c.desc} opacity-0 group-hover:opacity-100 transition-opacity`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>

                <div className="mt-3">
                  <div
                    className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-medium dark:bg-white/[0.06] dark:text-gray-300 ${c.tagBg} ${c.tagText}`}
                  >
                    {book.tag}
                  </div>
                  <p className={`mt-2 text-sm dark:text-gray-500 ${c.status}`}>{status}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default WordBooks
