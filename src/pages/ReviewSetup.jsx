import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { loadDictionary } from '../utils/loadDictionary'
import { getDueReviewCount } from '../utils/reviewCards'

const BOOK_META = {
  review: { title: '复习计划', icon: '🔄', empty: '开始练习后单词会自动加入复习计划' },
  'error-book': { title: '错题本', icon: '📕', empty: '暂无错题，去练习产生错题后会自动收录' },
  'reading-word-book': {
    title: '阅读词本',
    icon: '📖',
    empty: '暂无阅读词汇，在阅读文章时收藏单词',
  },
  'corpus-word-book': {
    title: '语料词本',
    icon: '📝',
    empty: '暂无语料词汇，在语料播放时收藏单词',
  },
  'favorite-words': { title: '收藏词本', icon: '⭐', empty: '暂无收藏，练习中点击星标收藏单词' },
}

function ReviewSetup() {
  const { bookId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [dictInfo, setDictInfo] = useState(null)
  const [quizExpanded, setQuizExpanded] = useState(false)

  useEffect(() => {
    loadDictionary(bookId).then((data) => {
      if (data) {
        const totalWords = data.chapters.reduce((sum, c) => sum + c.words.length, 0)
        setDictInfo({
          name: data.name,
          totalWords,
          totalChapters: data.totalChapters ?? data.chapters.length,
        })
      }
    })
  }, [bookId])

  const dueCount = bookId === 'review' ? getDueReviewCount() : 0
  const meta = BOOK_META[bookId]

  return (
    <div className="min-h-screen bg-background dark:bg-transparent p-6 transition-colors duration-500 animate-page-fade-in">
      <div className="max-w-2xl mx-auto">
        {/* 返回按钮 */}
        <button
          onClick={() => navigate(location.state?.from || '/word')}
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
          <span className="hidden sm:inline">返回</span>
        </button>

        {/* 标题区 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400 text-xl">
              {meta?.icon ?? '📚'}
            </div>
            <h1 className="text-2xl font-extrabold text-content dark:text-gray-100">
              {meta?.title ?? '复习'}
            </h1>
          </div>
          {dictInfo && (
            <div className="text-content-secondary dark:text-gray-400 text-sm space-y-1 mt-3 ml-1">
              <p>
                共 {dictInfo.totalWords} 个单词 · {dictInfo.totalChapters} 章
              </p>
              {dueCount > 0 && (
                <p className="text-amber-600 dark:text-amber-400 font-medium">
                  今日需复习 {dueCount} 词
                </p>
              )}
            </div>
          )}
        </div>

        {/* 空状态 */}
        {dictInfo && dictInfo.totalWords === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-5">{meta?.icon ?? '📭'}</div>
            <p className="text-content-secondary dark:text-gray-400 text-sm mb-6 max-w-xs mx-auto leading-relaxed">
              {meta?.empty ?? '暂无词汇可练习'}
            </p>
            <button
              onClick={() => navigate('/word')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 active:scale-[0.98] transition-all"
            >
              去练习
            </button>
          </div>
        ) : (
          /* 模式选择卡片 */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 打字复习 */}
            <button
              onClick={() =>
                navigate('/dict/' + bookId, { state: { from: '/review/setup/' + bookId } })
              }
              className="
              group relative flex flex-col items-center justify-center overflow-hidden
              rounded-2xl border-2 p-6
              transition-all duration-150 active:scale-[0.98]
              cursor-pointer hover:shadow-lg
              border-indigo-200 dark:border dark:border-white/[0.09] dark:hover:border-primary/40
              bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-transparent dark:to-transparent dark:bg-surface
              hover:border-indigo-300
              hover:shadow-indigo-900/20
            "
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500 opacity-80 dark:hidden" />
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-white/[0.06] dark:text-gray-300 mb-3">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-indigo-900 dark:text-gray-100">打字复习</h3>
              <p className="text-sm text-indigo-600/80 dark:text-gray-400 mt-1">通过拼写强化记忆</p>
              <svg
                className="w-5 h-5 text-indigo-600/80 dark:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity mt-2"
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
            </button>

            {/* 选择题复习（可展开） */}
            <div className="flex flex-col">
              <button
                onClick={() => setQuizExpanded((v) => !v)}
                className="
                group relative flex flex-col items-center justify-center overflow-hidden
                rounded-2xl border-2 p-6
                transition-all duration-150 active:scale-[0.98]
                cursor-pointer hover:shadow-lg
                border-violet-200 dark:border dark:border-white/[0.09] dark:hover:border-primary/40
                bg-gradient-to-br from-violet-50 to-purple-50 dark:from-transparent dark:to-transparent dark:bg-surface
                hover:border-violet-300
                hover:shadow-violet-900/20
              "
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-violet-500 opacity-80 dark:hidden" />
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-white/[0.06] dark:text-gray-300 mb-3">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-violet-900 dark:text-gray-100">选择题复习</h3>
                <p className="text-sm text-violet-600/80 dark:text-gray-400 mt-1">
                  通过选择快速巩固
                </p>
                {/* 展开/收起箭头 */}
                <svg
                  className={`w-5 h-5 text-violet-600/80 dark:text-gray-300 mt-2 transition-transform duration-300 ${quizExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {/* 三个题型子卡片 */}
              <div
                className={`grid transition-all duration-300 ease-in-out ${quizExpanded ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0 mt-0'}`}
              >
                <div className="overflow-hidden">
                  <div className="flex flex-col gap-2">
                    {/* 英译中 */}
                    <button
                      onClick={() => navigate('/review/quiz/' + bookId + '?type=en2cn')}
                      className="
                      group flex items-center gap-4 rounded-xl border-2 p-4
                      transition-all duration-150 active:scale-[0.98] cursor-pointer
                      border-indigo-200 dark:border dark:border-white/[0.09] dark:hover:border-primary/40
                      bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-transparent dark:to-transparent dark:bg-surface
                      hover:border-indigo-300 hover:shadow-md
                    "
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-white/[0.06] dark:text-gray-300 text-lg">
                        🇨🇳
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-indigo-900 dark:text-gray-100">
                          英译中
                        </h4>
                        <p className="text-xs text-indigo-600/70 dark:text-gray-500">
                          看英文单词，选择中文释义
                        </p>
                      </div>
                      <svg
                        className="w-4 h-4 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity"
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
                    </button>

                    {/* 中译英 */}
                    <button
                      onClick={() => navigate('/review/quiz/' + bookId + '?type=cn2en')}
                      className="
                      group flex items-center gap-4 rounded-xl border-2 p-4
                      transition-all duration-150 active:scale-[0.98] cursor-pointer
                      border-emerald-200 dark:border dark:border-white/[0.09] dark:hover:border-primary/40
                      bg-gradient-to-r from-emerald-50 to-green-50 dark:from-transparent dark:to-transparent dark:bg-surface
                      hover:border-emerald-300 hover:shadow-md
                    "
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-white/[0.06] dark:text-gray-300 text-lg">
                        🇬🇧
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-emerald-900 dark:text-gray-100">
                          中译英
                        </h4>
                        <p className="text-xs text-emerald-600/70 dark:text-gray-500">
                          看中文释义，选择英文单词
                        </p>
                      </div>
                      <svg
                        className="w-4 h-4 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity"
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
                    </button>

                    {/* 听力题 */}
                    <button
                      onClick={() => navigate('/review/quiz/' + bookId + '?type=listening')}
                      className="
                      group flex items-center gap-4 rounded-xl border-2 p-4
                      transition-all duration-150 active:scale-[0.98] cursor-pointer
                      border-amber-200 dark:border dark:border-white/[0.09] dark:hover:border-primary/40
                      bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-transparent dark:to-transparent dark:bg-surface
                      hover:border-amber-300 hover:shadow-md
                    "
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-white/[0.06] dark:text-gray-300 text-lg">
                        🔊
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-amber-900 dark:text-gray-100">
                          听力题
                        </h4>
                        <p className="text-xs text-amber-600/70 dark:text-gray-500">
                          听发音，选择正确释义
                        </p>
                      </div>
                      <svg
                        className="w-4 h-4 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity"
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
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ReviewSetup
