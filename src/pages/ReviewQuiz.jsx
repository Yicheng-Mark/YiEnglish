import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { loadDictionary } from '../utils/loadDictionary'
import { unlockAudio } from '../utils/audioContext.js'
import { removeFromErrorBook } from '../utils/errorBook'
import { removeFromFavoriteWords } from '../utils/favoriteWords'
import { removeFromReadingWordBook } from '../utils/readingWordBook'
import { removeFromCorpusWordBook } from '../utils/corpusWordBook'
import { removeFromReviewCards } from '../utils/reviewCards'
import useQuiz from '../hooks/useQuiz'
import QuizCard from '../components/QuizCard'

const REMOVABLE_BOOKS = {
  'error-book': removeFromErrorBook,
  'favorite-words': removeFromFavoriteWords,
  'reading-word-book': removeFromReadingWordBook,
  'corpus-word-book': removeFromCorpusWordBook,
  'review': removeFromReviewCards,
}

function ReviewQuiz() {
  const { bookId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [allWords, setAllWords] = useState([])
  const [loading, setLoading] = useState(true)

  // 首次点击时解锁 AudioContext（移动端/平板必须在用户手势中创建）
  useEffect(() => {
    const onFirstClick = () => {
      unlockAudio()
      document.removeEventListener('click', onFirstClick)
    }
    document.addEventListener('click', onFirstClick)
    return () => document.removeEventListener('click', onFirstClick)
  }, [])

  useEffect(() => {
    loadDictionary(bookId).then(data => {
      if (data) {
        const words = data.chapters.flatMap(c => c.words)
        setAllWords(words)
      }
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })
  }, [bookId])

  const quizType = searchParams.get('type')
  const quizOptions = useMemo(() => {
    const allTypes = ['en2cn', 'cn2en', 'listening']
    return { questionTypes: quizType && allTypes.includes(quizType) ? [quizType] : allTypes }
  }, [quizType])
  const quiz = useQuiz(allWords, quizOptions)

  const removeFn = REMOVABLE_BOOKS[bookId]
  const isRemovable = !!removeFn

  const handleRemove = useCallback(() => {
    if (!removeFn || !quiz.currentQuestion) return
    const wordName = quiz.currentQuestion.stem.name
    removeFn(wordName)
    quiz.removeWord(wordName)
    setAllWords(prev => prev.filter(w => w.name !== wordName))
  }, [removeFn, quiz.currentQuestion])

  const accuracy = quiz.totalQuestions > 0
    ? Math.round((quiz.score / quiz.totalQuestions) * 100)
    : 0

  // 空状态：加载完成但无词汇
  if (!loading && allWords.length === 0) {
    return (
      <div className="min-h-screen bg-background dark:bg-transparent flex items-center justify-center p-6 transition-colors duration-500 animate-page-fade-in">
        <div className="max-w-md w-full text-center">
          <div className="text-6xl mb-5">📭</div>
          <p className="text-content-secondary dark:text-gray-400 text-sm mb-6">暂无词汇可练习</p>
          <button
            onClick={() => navigate('/wordbooks')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-gray-200 dark:border-white/10 text-content dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-white/[0.04] active:scale-[0.98] transition-all"
          >
            返回词本
          </button>
        </div>
      </div>
    )
  }

  // 结果面板
  if (quiz.isFinished) {
    return (
      <div className="min-h-screen bg-background dark:bg-transparent flex items-center justify-center p-6 transition-colors duration-500 animate-page-fade-in">
        <div className="max-w-md w-full bg-surface dark:bg-white/[0.04] rounded-3xl border border-gray-200/80 dark:border-white/[0.06] p-8 shadow-xl">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-violet-500/30">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-content dark:text-gray-100">练习完成</h2>
            <p className="text-sm text-content-tertiary dark:text-gray-400 mt-1">
              本次选择题练习已全部完成
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-8">
            <div className="bg-gray-50 dark:bg-white/[0.04] rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{quiz.score}</span>
              </div>
              <div className="text-xs text-content-tertiary dark:text-gray-400">正确数</div>
            </div>
            <div className="bg-gray-50 dark:bg-white/[0.04] rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <svg className="w-5 h-5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                </svg>
                <span className="text-2xl font-extrabold text-violet-600 dark:text-violet-400">{accuracy}%</span>
              </div>
              <div className="text-xs text-content-tertiary dark:text-gray-400">正确率</div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => quiz.reset()}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 active:scale-[0.98] transition-all"
            >
              重新开始
            </button>
            <button
              onClick={() => navigate('/wordbooks')}
              className="w-full py-3 rounded-xl border-2 border-gray-200 dark:border-white/10 text-content dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-white/[0.04] active:scale-[0.98] transition-all"
            >
              返回词本
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background dark:bg-transparent transition-colors duration-500 animate-page-fade-in">
      <div className="max-w-2xl mx-auto p-6">
        {/* 顶部栏 */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/review/setup/' + bookId)}
            className="text-content-tertiary dark:text-gray-400 hover:text-primary dark:hover:text-primary-dark flex items-center gap-2 text-sm transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.04]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            返回
          </button>
          <span className="text-sm font-medium text-content-secondary dark:text-gray-400">
            第 {quiz.currentIndex + 1}/{quiz.totalQuestions} 题
          </span>
          <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            ✓{quiz.score}
          </span>
        </div>

        {/* 进度条 */}
        <div className="w-full h-1.5 bg-gray-100 dark:bg-white/[0.06] rounded-full mb-8 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all duration-500"
            style={{ width: `${((quiz.currentIndex + 1) / quiz.totalQuestions) * 100}%` }}
          />
        </div>

        {/* 题目卡片 */}
        <div className="bg-surface dark:bg-white/[0.04] rounded-2xl border border-gray-200/80 dark:border-white/[0.06] p-6 shadow-sm">
          <QuizCard
            question={quiz.currentQuestion}
            onAnswer={quiz.handleAnswer}
            selectedOption={quiz.selectedOption}
            isCorrect={quiz.isCorrect}
          />
        </div>

        {/* 跳过按钮：答题前和答题后都显示 */}
        <div className="text-center mt-6">
          <button
            onClick={quiz.skip}
            className="text-sm text-content-tertiary dark:text-gray-500 hover:text-content-secondary dark:hover:text-gray-400 transition-colors px-4 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.04]"
          >
            跳过
          </button>
        </div>

        {/* 移除按钮（在跳过下方） */}
        {isRemovable && (
          <div className="text-center mt-2">
            <button
              onClick={handleRemove}
              className="text-sm text-red-400 hover:text-red-500 dark:text-red-400 dark:hover:text-red-300 transition-colors px-4 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 inline-flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              移除此词
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default ReviewQuiz
