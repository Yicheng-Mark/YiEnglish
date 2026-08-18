import { useState, useEffect, useCallback, memo } from 'react'
import { getErrorBook, removeFromErrorBook } from '../utils/errorBook.js'

const WrongBookModal = memo(function WrongBookModal({ onClose, onWordRemoved }) {
  const [wrongWords, setWrongWords] = useState([])
  const [pendingDelete, setPendingDelete] = useState(null)

  useEffect(() => {
    const data = getErrorBook()
    setWrongWords(data.words || [])
  }, [])

  useEffect(() => {
    if (pendingDelete) {
      const timer = setTimeout(() => setPendingDelete(null), 2000)
      return () => clearTimeout(timer)
    }
  }, [pendingDelete])

  const handleRemove = useCallback(
    (wordName) => {
      if (pendingDelete === wordName) {
        removeFromErrorBook(wordName)
        setWrongWords((prev) => prev.filter((w) => w.name !== wordName))
        onWordRemoved?.(wordName)
        setPendingDelete(null)
      } else {
        setPendingDelete(wordName)
      }
    },
    [pendingDelete, onWordRemoved]
  )

  const handlePractice = () => {
    if (wrongWords.length === 0) return
    window.location.href = '/typing/error-book/0'
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content max-w-lg max-h-[80vh] flex flex-col p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg flex items-center justify-center">
              <svg
                className="w-4 h-4 text-indigo-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-content dark:text-white">错题本</h2>
            <span className="text-xs bg-gray-100 dark:bg-white/[0.06] text-content-tertiary dark:text-gray-400 px-2 py-0.5 rounded-full">
              {wrongWords.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-content-tertiary hover:text-content-secondary dark:hover:text-gray-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.05] transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {wrongWords.length === 0 ? (
          <div className="text-center py-12 text-content-tertiary dark:text-gray-500">
            <div className="w-16 h-16 bg-gray-50 dark:bg-white/[0.03] rounded-full flex items-center justify-center mx-auto mb-3">
              <svg
                className="w-8 h-8 text-gray-300 dark:text-gray-600"
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
            </div>
            暂无错题
          </div>
        ) : (
          <>
            <div className="overflow-y-auto flex-1 space-y-2 pr-1">
              {wrongWords.map((word) => (
                <div
                  key={word.name}
                  className="flex items-center justify-between p-3.5 card rounded-button hover:border-primary/20 dark:hover:border-primary/20 transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold text-content dark:text-white text-sm">
                        {word.name}
                      </div>
                      {word.wrongCount > 1 && (
                        <span className="text-[10px] bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 px-1.5 py-0.5 rounded-full">
                          错 {word.wrongCount} 次
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-content-tertiary dark:text-gray-400 mt-0.5 truncate">
                      {Array.isArray(word.trans) ? word.trans.join('；') : word.trans}
                    </div>
                    {word.dictName && (
                      <div className="text-xs text-content-tertiary/60 dark:text-gray-500 mt-0.5">
                        {word.dictName}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemove(word.name)}
                    title={pendingDelete === word.name ? '再次点击确认删除' : '删除'}
                    className={`ml-3 shrink-0 flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg transition-colors
                      ${
                        pendingDelete === word.name
                          ? 'text-red-500 bg-red-50 dark:text-red-400 dark:bg-red-500/10'
                          : 'text-content-tertiary hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10'
                      }`}
                  >
                    <svg
                      className="w-5 h-5"
                      fill={pendingDelete === word.name ? 'currentColor' : 'none'}
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={handlePractice}
              className="mt-4 w-full py-2.5 bg-primary hover:opacity-90 text-white rounded-button font-medium transition shadow-lg shadow-primary/20"
            >
              开始练习错题
            </button>
          </>
        )}
      </div>
    </div>
  )
})

export default WrongBookModal
