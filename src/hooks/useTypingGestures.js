import { useCallback, useRef } from 'react'
import { saveLocalProgress } from '../utils/localProgress.js'

/**
 * useTypingGestures —— 从 Typing.jsx 机械抽离的移动端触摸手势处理。
 *
 * 抽离自 Typing.jsx（原内联代码逐行对应，无业务逻辑改动）：
 *  - touchStartRef / suppressClickRef
 *  - handleTouchStart：记录触摸起点
 *  - handleTouchEnd：横向滑动切词（阈值 50px / 800ms），键盘收起时 tap 唤醒
 *
 * suppressClickRef 同时被 Typing.jsx 的重聚焦 effect 与容器 onClick 读取，
 * 故从本 hook 返回，供外部共用同一个 ref 实例。
 *
 * @param {object} opts
 * @param {boolean} opts.isMobile
 * @param {boolean} opts.isFinished
 * @param {number} opts.wordIndex
 * @param {number} opts.wordsLength
 * @param {Function} opts.jumpTo
 * @param {boolean} opts.keyboardActive
 * @param {Function} opts.setKeyboardActive
 * @param {object} opts.currentWord
 * @param {string} opts.dictId
 * @param {string|number} opts.chapterId
 * @param {React.RefObject<HTMLInputElement>} opts.hiddenInputRef
 */
export default function useTypingGestures({
  isMobile,
  isFinished,
  wordIndex,
  wordsLength,
  jumpTo,
  keyboardActive,
  setKeyboardActive,
  currentWord,
  dictId,
  chapterId,
  hiddenInputRef,
}) {
  const touchStartRef = useRef(null)
  const suppressClickRef = useRef(false)

  const handleTouchStart = useCallback(
    (e) => {
      if (!isMobile || isFinished) return
      const t = e.touches[0]
      touchStartRef.current = { x: t.clientX, y: t.clientY, t: Date.now() }
    },
    [isMobile, isFinished]
  )

  const handleTouchEnd = useCallback(
    (e) => {
      if (!isMobile || isFinished || !touchStartRef.current) return
      const start = touchStartRef.current
      touchStartRef.current = null
      const t = e.changedTouches[0]
      const dx = t.clientX - start.x
      const dy = t.clientY - start.y
      const dt = Date.now() - start.t
      const absX = Math.abs(dx),
        absY = Math.abs(dy)

      const SWIPE_THRESHOLD = 50
      const TAP_THRESHOLD = 10
      const SWIPE_MAX_DURATION = 800

      if (absX > SWIPE_THRESHOLD && absX > absY && dt < SWIPE_MAX_DURATION) {
        suppressClickRef.current = true
        setTimeout(() => {
          suppressClickRef.current = false
        }, 350)
        if (dx > 0 && wordIndex > 0) jumpTo(wordIndex - 1)
        else if (dx < 0 && wordIndex < wordsLength - 1) {
          if (currentWord) saveLocalProgress(dictId, Number(chapterId), [currentWord.name])
          jumpTo(wordIndex + 1)
        }
        return
      }

      if (!keyboardActive && absX < TAP_THRESHOLD && absY < TAP_THRESHOLD) {
        setKeyboardActive(true)
        setTimeout(() => {
          try {
            hiddenInputRef.current?.focus({ preventScroll: true })
          } catch {
            hiddenInputRef.current?.focus()
          }
        }, 0)
      }
    },
    [
      isMobile,
      isFinished,
      wordIndex,
      wordsLength,
      jumpTo,
      keyboardActive,
      currentWord,
      dictId,
      chapterId,
      setKeyboardActive,
      hiddenInputRef,
    ]
  )

  return {
    touchStartRef,
    suppressClickRef,
    handleTouchStart,
    handleTouchEnd,
  }
}
