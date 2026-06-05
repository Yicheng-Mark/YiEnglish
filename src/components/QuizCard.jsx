import { useCallback, useEffect, useRef } from 'react'
import useIsMobile from '../hooks/useIsMobile.js'

const ABCD = ['A', 'B', 'C', 'D']

function getOptionStyle(index, selected, isCorrect, correctIndex) {
  if (selected === null) return 'border-gray-200 dark:border-white/10 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10'
  if (index === correctIndex) return 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-900 dark:text-emerald-200'
  if (index === selected && !isCorrect) return 'border-red-500 bg-red-50 dark:bg-red-500/15 text-red-900 dark:text-red-200'
  return 'border-gray-200 dark:border-white/10 opacity-50'
}

function QuizCard({ question, onAnswer, selectedOption, isCorrect }) {
  const audioRef = useRef(null)
  const isMobile = useIsMobile()

  const playAudio = useCallback(() => {
    if (!question?.stem?.name) return
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    const audio = new Audio(
      `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(question.stem.name)}&type=2`
    )
    audioRef.current = audio
    audio.play().catch(() => {})
  }, [question?.stem?.name])

  // listening 题型进入时自动播放（移动端/平板跳过，需用户手动点击播放）
  useEffect(() => {
    if (question?.type === 'listening' && !isMobile) {
      playAudio()
    }
  }, [question, playAudio, isMobile])

  if (!question) return null

  const { type, stem, options, correctIndex } = question

  return (
    <div className="w-full">
      {/* 题干区域 */}
      {type === 'en2cn' && (
        <div className="text-center mb-6">
          <p className="text-3xl font-bold text-content dark:text-gray-100">{stem.name}</p>
          {stem.usphone && (
            <p className="text-content-secondary dark:text-gray-400 mt-1 text-sm">
              /{stem.usphone}/
            </p>
          )}
        </div>
      )}

      {type === 'cn2en' && (
        <div className="text-center mb-6">
          <p className="text-xl text-content dark:text-gray-100">
            {Array.isArray(stem.trans) ? stem.trans.join('; ') : stem.trans}
          </p>
          <p className="text-sm text-content-tertiary dark:text-gray-500 mt-1">
            请选择对应的英文单词
          </p>
        </div>
      )}

      {type === 'listening' && (
        <div className="text-center mb-6">
          <button
            onClick={playAudio}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/25 transition-colors border border-indigo-200 dark:border-indigo-500/30"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
            播放发音
          </button>
          <p className="text-sm text-content-tertiary dark:text-gray-500 mt-2">
            听发音，选择正确释义
          </p>
        </div>
      )}

      {/* 选项区域 */}
      <div className="space-y-3">
        {options.map((opt, i) => (
          <button
            key={i}
            onClick={() => onAnswer(i)}
            disabled={selectedOption !== null}
            className={`
              w-full text-left p-4 rounded-xl border-2 transition-all duration-200
              flex items-center gap-3
              ${getOptionStyle(i, selectedOption, isCorrect, correctIndex)}
            `}
          >
            <span className="font-semibold text-sm w-6 shrink-0 text-center">{ABCD[i]}.</span>
            <span className="text-[15px]">
              {opt.label}
            </span>
            {selectedOption !== null && i === correctIndex && (
              <svg className="w-5 h-5 text-emerald-500 ml-auto shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {selectedOption !== null && i === selectedOption && !isCorrect && (
              <svg className="w-5 h-5 text-red-500 ml-auto shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

export default QuizCard
