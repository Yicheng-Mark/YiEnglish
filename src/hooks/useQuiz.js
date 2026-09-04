import { useState, useCallback, useRef, useEffect } from 'react'
import { getAudioContext } from '../utils/audioContext.js'
import { generateQuestions } from '../utils/quizGenerator.js'

// ========== 百词斩风格答题音效 ==========

async function playQuizSound(type) {
  try {
    let ctx = getAudioContext()
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)()
    }
    if (ctx.state === 'suspended') await ctx.resume()
    const now = ctx.currentTime

    if (type === 'correct') {
      // 清脆双音「叮叮」，上行音程，短促悦耳
      const freqs = [880, 1318.5] // A5 → E6，大三度上行
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = freq
        const gain = ctx.createGain()
        const start = now + i * 0.08
        gain.gain.setValueAtTime(0.35, start)
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(start)
        osc.stop(start + 0.18)
      })
    } else if (type === 'wrong') {
      // 低沉「嗡」，双振荡器加厚听感
      const freqs = [180, 260]
      freqs.forEach((freq) => {
        const osc = ctx.createOscillator()
        osc.type = 'triangle'
        osc.frequency.value = freq
        const gain = ctx.createGain()
        gain.gain.setValueAtTime(0.45, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 0.25)
      })
    } else if (type === 'finish') {
      // 庆祝三连音上行 C5→E5→G5，明快
      const freqs = [523.25, 659.25, 783.99]
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = freq
        const gain = ctx.createGain()
        const start = now + i * 0.12
        gain.gain.setValueAtTime(0.3, start)
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(start)
        osc.stop(start + 0.25)
      })
    }
  } catch {}
}

// 题目生成纯逻辑已抽出到 src/utils/quizGenerator.js，便于单元测试。

// ========== useQuiz Hook ==========

export default function useQuiz(words, options = {}) {
  const { questionTypes = ['en2cn', 'cn2en', 'listening'], questionsPerSession } = options

  const wordsRef = useRef(words)
  const timerRef = useRef(null)
  const skipRegenerateRef = useRef(false)

  const [currentIndex, setCurrentIndex] = useState(0)
  const [questions, setQuestions] = useState([])
  const [selectedOption, setSelectedOption] = useState(null)
  const [isCorrect, setIsCorrect] = useState(null)
  const [score, setScore] = useState(0)
  const [isFinished, setIsFinished] = useState(false)

  const totalQuestions = questions.length

  // words 变化时重新生成题目
  useEffect(() => {
    // 清除上一轮的自动推进定时器
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    // 移除单词导致的 words 变化，跳过重新生成
    if (skipRegenerateRef.current) {
      skipRegenerateRef.current = false
      wordsRef.current = words
      return
    }

    if (!words || words.length === 0) {
      setQuestions([])
      setCurrentIndex(0)
      setSelectedOption(null)
      setIsCorrect(null)
      setScore(0)
      setIsFinished(false)
      wordsRef.current = words
      return
    }

    wordsRef.current = words
    const count = questionsPerSession ?? Math.min(words.length, 20)
    const qs = generateQuestions(words, words, questionTypes, count)
    setQuestions(qs)
    setCurrentIndex(0)
    setSelectedOption(null)
    setIsCorrect(null)
    setScore(0)
    setIsFinished(false)
  }, [words, questionTypes, questionsPerSession])

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  // 用 ref 追踪最新状态，避免 useCallback 闭包过期
  const stateRef = useRef({
    questions,
    currentIndex,
    score,
    selectedOption,
    isCorrect,
    isFinished,
  })
  stateRef.current = {
    questions,
    currentIndex,
    score,
    selectedOption,
    isCorrect,
    isFinished,
  }

  const handleAnswer = useCallback((index) => {
    const s = stateRef.current
    if (s.selectedOption !== null || s.isFinished) return // 已答过或已结束

    const question = s.questions[s.currentIndex]
    if (!question) return

    const correct = question.options[index]?.isCorrect ?? false

    setSelectedOption(index)
    setIsCorrect(correct)

    if (correct) {
      setScore((prev) => prev + 1)
      playQuizSound('correct')
    } else {
      playQuizSound('wrong')
    }

    // 1.2 秒后自动推进
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const nextIndex = stateRef.current.currentIndex + 1
      if (nextIndex >= stateRef.current.questions.length) {
        setIsFinished(true)
        playQuizSound('finish')
      } else {
        setCurrentIndex(nextIndex)
        setSelectedOption(null)
        setIsCorrect(null)
      }
      timerRef.current = null
    }, 1200)
  }, [])

  const skip = useCallback(() => {
    if (stateRef.current.isFinished) return
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    const nextIndex = stateRef.current.currentIndex + 1
    if (nextIndex >= stateRef.current.questions.length) {
      setIsFinished(true)
    } else {
      setCurrentIndex(nextIndex)
      setSelectedOption(null)
      setIsCorrect(null)
    }
  }, [])

  const removeWord = useCallback((wordName) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    const s = stateRef.current
    const removedCountBeforeCurrent = s.questions
      .slice(0, s.currentIndex)
      .filter((q) => q.stem.name === wordName).length
    const isCurrentWord = s.questions[s.currentIndex]?.stem.name === wordName

    setQuestions((prev) => prev.filter((q) => q.stem.name !== wordName))

    const filteredLen =
      s.questions.length - s.questions.filter((q) => q.stem.name === wordName).length
    if (filteredLen === 0) {
      setIsFinished(true)
    } else if (isCurrentWord) {
      // 当前题被移除，保持 index 不变（自然指向下一题），除非已到末尾
      setCurrentIndex((prev) => Math.min(prev, Math.max(0, filteredLen - 1)))
    } else {
      // 移除的题在当前题之前，index 需前移
      setCurrentIndex((prev) => Math.max(0, prev - removedCountBeforeCurrent))
    }
    // 用户可以在答题后的 1.2 秒自动推进窗口内移除当前词。
    // 若这题已经答对，题目总数会减少，分数也必须同步回退，否则最终正确率可超过 100%。
    if (isCurrentWord && s.isCorrect === true) {
      setScore((prev) => Math.max(0, prev - 1))
    }
    setSelectedOption(null)
    setIsCorrect(null)

    // 标记跳过 useEffect 的重新生成
    skipRegenerateRef.current = true
  }, [])

  const reset = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    const w = wordsRef.current
    if (!w || w.length === 0) return

    const count = questionsPerSession ?? Math.min(w.length, 20)
    const qs = generateQuestions(w, w, questionTypes, count)

    setQuestions(qs)
    setCurrentIndex(0)
    setSelectedOption(null)
    setIsCorrect(null)
    setScore(0)
    setIsFinished(false)
  }, [questionTypes, questionsPerSession])

  return {
    currentQuestion: questions[currentIndex] ?? null,
    currentIndex,
    totalQuestions,
    selectedOption,
    isCorrect,
    score,
    isFinished,
    handleAnswer,
    skip,
    removeWord,
    reset,
  }
}
