import React, { memo, useMemo, useRef, useEffect } from 'react'
import { normalizeWordName } from '../utils/wordName.js'

const WordDisplay = memo(function WordDisplay({ word, currentInput, isWrong, hideEnglish }) {
  // 连字符规范化为空格，使显示与打字比对一致（见 normalizeWordName）
  const chars = useMemo(() => normalizeWordName(word?.name).split(''), [word?.name])
  const prevLenRef = useRef(0)

  // 根据单词长度动态调整字体大小和间距，避免长单词被截断
  const sizeClass = useMemo(() => {
    const len = word?.name?.length || 0
    if (len >= 16) {
      return 'text-[clamp(1.25rem,5vw,2.5rem)] md:text-6xl tracking-[0.08em] gap-0.5 md:gap-1'
    }
    if (len >= 11) {
      return 'text-[clamp(1.5rem,6vw,3.5rem)] md:text-7xl tracking-[0.1em] gap-1 md:gap-2'
    }
    return 'text-[clamp(2rem,8vw,4rem)] md:text-9xl tracking-[0.15em] gap-1.5 md:gap-4'
  }, [word?.name])

  // 单词切换时重置 prevLenRef，避免上一个单词的输入长度污染新单词
  useEffect(() => {
    prevLenRef.current = 0
  }, [word?.name])

  // 追踪输入长度变化，用于正确字符 pop 动画
  const newCorrectIndex = currentInput.length > prevLenRef.current ? currentInput.length - 1 : -1
  prevLenRef.current = currentInput.length

  return (
    <div
      className={`${sizeClass} font-mono flex justify-center select-none shrink-0 ${isWrong ? 'animate-shake' : ''}`}
    >
      {chars.map((char, i) => {
        let className
        const isCorrect = i < currentInput.length && currentInput[i] === char
        const isError = i < currentInput.length && currentInput[i] !== char

        // 英文遮挡：未输入字母（非 correct 非 error）显示灰色方块，已打对/打错的字母照常显示
        if (hideEnglish && !isCorrect && !isError) {
          return (
            <span
              key={`${word?.name}-${i}`}
              className="inline-block rounded-[3px] bg-gray-300 dark:bg-gray-600 self-center"
              style={{ width: '0.62em', height: '1em' }}
            />
          )
        }

        if (isCorrect) {
          className =
            'text-primary dark:text-primary-dark dark:drop-shadow-[0_0_8px_rgba(167,139,250,0.55)]'
        } else if (isError) {
          className =
            'text-violet-500 dark:text-violet-400 dark:drop-shadow-[0_0_6px_rgba(167,139,250,0.45)]'
        } else if (i === currentInput.length) {
          className = 'text-gray-300 dark:text-gray-400'
        } else {
          className = 'text-gray-300 dark:text-gray-600'
        }

        const shouldPop = isCorrect && i === newCorrectIndex

        return (
          <span
            key={`${word?.name}-${i}`}
            className={`${className} ${shouldPop ? 'animate-char-pop' : ''} transition-colors duration-75 inline-block`}
          >
            {char}
          </span>
        )
      })}
    </div>
  )
})

export default WordDisplay
