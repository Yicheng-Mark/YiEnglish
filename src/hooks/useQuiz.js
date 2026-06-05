import { useState, useCallback, useRef, useEffect } from 'react'
import { getAudioContext, unlockAudio } from '../utils/audioContext.js'
import { parsePosFromTrans } from '../modules/corpus/utils/wordColorMap.js'

// ========== 百词斩风格答题音效 ==========

function playQuizSound(type) {
  const audioCtx = getAudioContext()
  if (!audioCtx) return
  try {
    const ctx = audioCtx
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
      freqs.forEach(freq => {
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
  } catch (e) {}
}

// ========== Levenshtein 编辑距离 ==========

function levenshtein(a, b) {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] !== b[j - 1] ? 1 : 0)
      )
  return dp[m][n]
}

// ========== 工具函数 ==========

function shuffle(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 备用干扰词池——词本词数不足时自动补充，确保选择题始终有 4 个选项
const FALLBACK_DISTRACTORS = [
  { name: 'apple', trans: '[n] 苹果' },
  { name: 'book', trans: '[n] 书籍；[v] 预订' },
  { name: 'cat', trans: '[n] 猫' },
  { name: 'dog', trans: '[n] 狗' },
  { name: 'water', trans: '[n] 水；[v] 浇水' },
  { name: 'house', trans: '[n] 房屋' },
  { name: 'time', trans: '[n] 时间；[v] 计时' },
  { name: 'people', trans: '[n] 人们' },
  { name: 'good', trans: '[adj] 好的' },
  { name: 'think', trans: '[v] 想；认为' },
  { name: 'world', trans: '[n] 世界' },
  { name: 'hand', trans: '[n] 手；[v] 递' },
  { name: 'place', trans: '[n] 地方；[v] 放置' },
  { name: 'great', trans: '[adj] 伟大的；很好的' },
  { name: 'small', trans: '[adj] 小的' },
  { name: 'begin', trans: '[v] 开始' },
  { name: 'number', trans: '[n] 数字；号码' },
  { name: 'story', trans: '[n] 故事' },
  { name: 'music', trans: '[n] 音乐' },
  { name: 'green', trans: '[adj] 绿色的；[n] 绿色' },
  { name: 'table', trans: '[n] 桌子' },
  { name: 'child', trans: '[n] 孩子' },
  { name: 'power', trans: '[n] 力量；权力' },
  { name: 'light', trans: '[n] 光；[adj] 轻的' },
  { name: 'grow', trans: '[v] 生长；增长' },
  { name: 'learn', trans: '[v] 学习' },
  { name: 'dream', trans: '[n] 梦；[v] 做梦' },
  { name: 'ocean', trans: '[n] 海洋' },
  { name: 'smile', trans: '[n] 微笑；[v] 微笑' },
  { name: 'brave', trans: '[adj] 勇敢的' },
]

/**
 * 生成干扰项
 * 1. 排除当前单词
 * 2. 优先同词性
 * 3. 排除形近词（编辑距离 ≤ 2）
 * 4. 随机取 count 个
 * 5. 词本词数不足时从备用池补充
 */
function getDistractors(word, allWords, type, count = 3) {
  const candidates = allWords.filter(w => w.name !== word.name)

  // 根据题型决定用哪个字段比较词性
  const pos = parsePosFromTrans(word.trans)

  // 排除形近词（编辑距离 ≤ 2），硬性规则不可放松
  const targetName = word.name.toLowerCase()
  const notSimilar = candidates.filter(w => {
    return levenshtein(targetName, w.name.toLowerCase()) > 2
  })

  // 优先同词性 + 非形近
  let pool = notSimilar.filter(w => parsePosFromTrans(w.trans) === pos)
  // 不够则降级为任意词性（形近词排除仍然生效）
  if (pool.length < count) pool = notSimilar

  let result = shuffle(pool).slice(0, count)

  // 词本词数不足时，从备用池补充干扰项
  if (result.length < count) {
    const existingNames = new Set([
      word.name.toLowerCase(),
      ...result.map(w => w.name.toLowerCase())
    ])
    const fallback = FALLBACK_DISTRACTORS.filter(
      w => !existingNames.has(w.name.toLowerCase())
        && levenshtein(targetName, w.name.toLowerCase()) > 2
    )
    result = [...result, ...shuffle(fallback).slice(0, count - result.length)]
  }

  return result
}

/**
 * 生成单道题目
 */
function generateQuestion(word, allWords, type) {
  const distractors = getDistractors(word, allWords, type)

  let correctLabel
  if (type === 'en2cn' || type === 'listening') {
    // 选项是中文释义
    correctLabel = word.trans
  } else {
    // cn2en：选项是英文单词
    correctLabel = word.name
  }

  const correctOption = { label: correctLabel, isCorrect: true }
  const wrongOptions = distractors.map(w => {
    const label = (type === 'en2cn' || type === 'listening') ? w.trans : w.name
    return { label, isCorrect: false }
  })

  // 如果干扰项不足 3 个，有多少放多少
  const allOptions = [correctOption, ...wrongOptions]
  const shuffled = shuffle(allOptions)
  const correctIndex = shuffled.findIndex(o => o.isCorrect)

  return {
    type,
    stem: word,
    options: shuffled,
    correctIndex,
  }
}

/**
 * 批量生成题目
 */
function generateQuestions(words, allWords, questionTypes, count) {
  const sampled = shuffle(words).slice(0, count)
  return sampled.map(word => {
    const type = questionTypes[Math.floor(Math.random() * questionTypes.length)]
    return generateQuestion(word, allWords, type)
  })
}

// ========== useQuiz Hook ==========

export default function useQuiz(words, options = {}) {
  const {
    questionTypes = ['en2cn', 'cn2en', 'listening'],
    questionsPerSession,
  } = options

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
  const stateRef = useRef({ questions, currentIndex, score, selectedOption, isFinished })
  stateRef.current = { questions, currentIndex, score, selectedOption, isFinished }

  const handleAnswer = useCallback(async (index) => {
    const s = stateRef.current
    if (s.selectedOption !== null || s.isFinished) return // 已答过或已结束

    const question = s.questions[s.currentIndex]
    if (!question) return

    const correct = question.options[index]?.isCorrect ?? false

    setSelectedOption(index)
    setIsCorrect(correct)

    await unlockAudio() // 确保在用户手势（点击选项）中解锁 AudioContext

    if (correct) {
      setScore(prev => prev + 1)
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
    const removedCountBeforeCurrent = s.questions.slice(0, s.currentIndex).filter(q => q.stem.name === wordName).length
    const isCurrentWord = s.questions[s.currentIndex]?.stem.name === wordName

    setQuestions(prev => prev.filter(q => q.stem.name !== wordName))

    const filteredLen = s.questions.length - s.questions.filter(q => q.stem.name === wordName).length
    if (filteredLen === 0) {
      setIsFinished(true)
    } else if (isCurrentWord) {
      // 当前题被移除，保持 index 不变（自然指向下一题），除非已到末尾
      setCurrentIndex(prev => Math.min(prev, Math.max(0, filteredLen - 1)))
    } else {
      // 移除的题在当前题之前，index 需前移
      setCurrentIndex(prev => Math.max(0, prev - removedCountBeforeCurrent))
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
