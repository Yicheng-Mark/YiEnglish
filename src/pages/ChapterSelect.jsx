import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { loadDictionary, getCached } from '../utils/loadDictionary.js'
import { getMeta } from '../dictionaries/meta.js'
import { unlockAudio } from '../utils/audioContext.js'
import { fetchProgress, resetProgress } from '../lib/api.js'
import { getLocalProgress, clearLocalProgress } from '../utils/localProgress.js'
import ChapterSkeleton from '../components/ChapterSkeleton.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'

const RESTORE_KEY = 'lf_wordlib_should_restore'
const TRIAL_CHAPTER_COUNT = 5

export default function ChapterSelect() {
  const { dictId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const isTrial = !!user?.isTrial
  const [dict, setDict] = useState(() => getCached(dictId))
  const [loading, setLoading] = useState(() => !getCached(dictId))
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState({})
  const meta = getMeta(dictId)

  useEffect(() => {
    setLoading(true)
    setError(null)
    loadDictionary(dictId)
      .then((data) => {
        if (!data.chapters || !Array.isArray(data.chapters)) {
          setError('词库数据格式错误')
          setLoading(false)
          return
        }
        setDict(data)
        setLoading(false)
      })
      .catch((err) => {
        setError('加载失败')
        setLoading(false)
      })
  }, [dictId])

  useEffect(() => {
    const localData = getLocalProgress(dictId)
    setProgress(localData)
    fetchProgress(dictId)
      .then((data) => {
        setProgress((prev) => ({ ...prev, ...(data.chapters || {}) }))
      })
      .catch(() => {})
  }, [dictId])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [dictId])

  // 首次用户点击时静默解锁音频，为后续打字页做准备
  useEffect(() => {
    const onFirstClick = () => {
      unlockAudio()
      document.removeEventListener('click', onFirstClick)
    }
    document.addEventListener('click', onFirstClick)
    return () => document.removeEventListener('click', onFirstClick)
  }, [])

  if (loading)
    return (
      <div className="min-h-screen bg-background dark:bg-transparent p-6 transition-colors duration-500 animate-page-fade-in">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8 glass-card rounded-card p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-accent to-primary opacity-60" />
            <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse" />
            <div className="h-4 w-72 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
          </div>
          <ChapterSkeleton />
        </div>
      </div>
    )
  if (error || !dict)
    return (
      <div className="min-h-screen bg-background dark:bg-transparent flex items-center justify-center transition-colors duration-500 animate-page-fade-in">
        <div className="text-center card p-8 shadow-lg dark:shadow-black/40 mx-4">
          <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-indigo-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-indigo-500 dark:text-violet-400 mb-6 font-medium">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2.5 bg-primary hover:opacity-90 text-white rounded-button font-medium transition shadow-lg shadow-primary/20"
          >
            返回首页
          </button>
        </div>
      </div>
    )

  const visibleChapters = (dict.chapters || []).slice(0, isTrial ? TRIAL_CHAPTER_COUNT : undefined)
  const chapterCount = visibleChapters.length
  const totalWords = visibleChapters.reduce((sum, c) => sum + (c.words?.length || 0), 0)
  const totalDone = visibleChapters.reduce((sum, c) => sum + (progress[c.id] || 0), 0)
  const totalPct = totalWords > 0 ? Math.round((totalDone / totalWords) * 100) : 0
  const isBookComplete = totalPct === 100

  return (
    <div className="min-h-screen bg-background dark:bg-transparent p-6 transition-colors duration-500 animate-page-fade-in">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => {
            sessionStorage.setItem(RESTORE_KEY, 'true')
            navigate(location.state?.from || '/word')
          }}
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

        <div className="mb-8 glass-card rounded-card p-6 relative overflow-hidden animate-fade-in-up">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-accent to-primary opacity-60" />
          {totalDone > 0 && (
            <button
              onClick={async () => {
                if (
                  !window.confirm(
                    `确定要重置「${meta?.name || dict.name}」的所有学习进度吗？此操作不可撤销。`
                  )
                )
                  return
                try {
                  await resetProgress(dictId)
                } catch (e) {
                  console.warn('Server reset failed:', e)
                }
                // 本地（内存/localStorage/IDB）同步清理，防止残留数据复活进度
                clearLocalProgress(dictId)
                setProgress({})
              }}
              className="absolute top-4 right-4 text-xs px-2.5 py-1 rounded-md text-content-tertiary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 border border-gray-200 dark:border-white/10 hover:border-red-200 dark:hover:border-red-800 transition-colors"
            >
              重置进度
            </button>
          )}
          <h1 className="text-3xl font-extrabold text-content dark:text-white mb-2">
            {meta?.name || dict.name}
          </h1>
          <p className="text-content-tertiary dark:text-gray-400">
            {meta?.description || dict.description}
          </p>
          <div className="flex gap-5 mt-4 text-sm">
            <div className="flex items-center gap-1.5 text-content-tertiary dark:text-gray-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              <span>共 {chapterCount} 章</span>
            </div>
            <div className="flex items-center gap-1.5 text-content-tertiary dark:text-gray-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
              <span>共 {totalWords} 词</span>
            </div>
          </div>
          {totalWords > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/[0.06]">
              <div className="flex justify-between items-center mb-2">
                <span
                  className={`text-xs font-medium ${isBookComplete ? 'text-green-500' : 'text-content-tertiary dark:text-gray-400'}`}
                >
                  {isBookComplete ? '已全部完成' : `已学 ${totalDone} / ${totalWords} 词`}
                </span>
                <span
                  className={`text-xs font-semibold ${isBookComplete ? 'text-green-500' : 'text-primary dark:text-primary-dark'}`}
                >
                  {totalPct}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-gray-200 dark:bg-white/[0.08] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${isBookComplete ? 'bg-green-500' : 'bg-primary dark:bg-primary-dark'}`}
                  style={{ width: `${totalPct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {chapterCount === 0 ? (
          <div className="text-center py-16 text-content-tertiary dark:text-gray-500">
            暂无章节数据
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 animate-fadeIn">
            {visibleChapters.map((chapter, index) => (
              <Link
                key={chapter.id}
                to={`/typing/${dictId}/${chapter.id}`}
                className="group card card-hover p-4 relative overflow-hidden animate-card-enter glow-border-subtle active:scale-[0.98] transition-transform duration-150"
                style={{ animationDelay: `${index * 0.04}s` }}
              >
                <div className="absolute top-0 right-0 w-12 h-12 bg-gradient-to-bl from-primary/10 to-transparent rounded-bl-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="text-sm font-semibold text-content dark:text-white group-hover:text-primary transition-colors">
                  {chapter.name}
                </div>
                <div className="text-xs text-content-tertiary dark:text-gray-500 mt-2 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                    />
                  </svg>
                  {chapter.words?.length || 0} 词
                </div>
                {(() => {
                  const total = chapter.words?.length || 0
                  const done = progress[chapter.id] || 0
                  const pct = total > 0 ? Math.round((done / total) * 100) : 0
                  const isComplete = pct === 100
                  return (
                    <div className="mt-2">
                      <div className="flex justify-between items-center mb-1">
                        <span
                          className={`text-[10px] font-medium ${isComplete ? 'text-green-500' : 'text-content-tertiary dark:text-gray-500'}`}
                        >
                          {isComplete ? '已完成' : `${done}/${total}`}
                        </span>
                        <span
                          className={`text-[10px] font-medium ${isComplete ? 'text-green-500' : 'text-content-tertiary dark:text-gray-500'}`}
                        >
                          {pct}%
                        </span>
                      </div>
                      <div className="w-full h-1 bg-gray-200 dark:bg-white/[0.08] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${isComplete ? 'bg-green-500' : 'bg-primary dark:bg-primary-dark'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })()}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
