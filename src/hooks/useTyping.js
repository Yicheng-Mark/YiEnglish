import { useState, useEffect, useCallback, useRef } from 'react'
import { getAudioContext } from '../utils/audioContext.js'
import { addToErrorBook } from '../utils/errorBook.js'
import { normalizeWordName } from '../utils/wordName.js'
import { playMediaSafe } from '../utils/playMediaSafe.js'

// ========== 音频合成（机械键盘模拟）==========

// 预生成白噪声 buffer，避免每次按键都重新分配内存
function createNoiseBuffer(ctx) {
  if (!ctx) return null
  const bufferSize = ctx.sampleRate * 0.008 // 8ms
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

function playKeySound(noiseBufferRef) {
  const audioCtx = getAudioContext()
  if (!audioCtx) return
  // audioContext.js 重建 ctx（close→new）后，缓存的 buffer 仍属于已关闭的 ctx，
  // Safari 上播放会抛错（被 catch 吞掉）导致之后按键一直静音：ctx 不一致时重建 buffer
  if (!noiseBufferRef.current || noiseBufferRef.current.ctx !== audioCtx) {
    noiseBufferRef.current = { ctx: audioCtx, buffer: createNoiseBuffer(audioCtx) }
  }
  const noiseBuffer = noiseBufferRef.current.buffer
  if (!noiseBuffer) return
  try {
    const ctx = audioCtx
    const now = ctx.currentTime

    // 1. 白噪声 burst（复用预生成的 buffer）
    const noise = ctx.createBufferSource()
    noise.buffer = noiseBuffer

    const filter = ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = 4000

    const noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(0.4, now)
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.008)

    noise.connect(filter)
    filter.connect(noiseGain)
    noiseGain.connect(ctx.destination)
    noise.start(now)
    noise.stop(now + 0.008)

    // 2. 短促高频 tone
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = 1000
    const toneGain = ctx.createGain()
    toneGain.gain.setValueAtTime(0.2, now)
    toneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04)
    osc.connect(toneGain)
    toneGain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.04)
  } catch (e) {}
}

function playSound(type) {
  const audioCtx = getAudioContext()
  if (!audioCtx) return
  try {
    const ctx = audioCtx
    const now = ctx.currentTime

    if (type === 'correct') {
      const osc1 = ctx.createOscillator()
      osc1.type = 'sine'
      osc1.frequency.value = 1200
      const g1 = ctx.createGain()
      g1.gain.setValueAtTime(0.3, now)
      g1.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
      osc1.connect(g1)
      g1.connect(ctx.destination)
      osc1.start(now)
      osc1.stop(now + 0.12)

      const osc2 = ctx.createOscillator()
      osc2.type = 'sine'
      osc2.frequency.value = 1500
      const g2 = ctx.createGain()
      g2.gain.setValueAtTime(0.2, now)
      g2.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
      osc2.connect(g2)
      g2.connect(ctx.destination)
      osc2.start(now)
      osc2.stop(now + 0.12)
    } else if (type === 'wrong') {
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.value = 180
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.2, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.18)
    } else if (type === 'finish') {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.3, now)
      osc.frequency.setValueAtTime(800, now)
      osc.frequency.setValueAtTime(1200, now + 0.12)
      osc.frequency.setValueAtTime(1600, now + 0.25)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.4)
    }
  } catch (e) {}
}

export default function useTyping(
  words,
  soundEnabled,
  wordRepeatCount = 1,
  isErrorBookMode = false,
  dictName = '',
  autoRemoveErrorWord = true,
  onWordComplete = null,
  onAutoRemove = null,
  onError = null
) {
  const [wordIndex, setWordIndex] = useState(0)
  const [currentInput, setCurrentInput] = useState('')
  const [isWrong, setIsWrong] = useState(false)
  const [isFinished, setIsFinished] = useState(false)
  const [startTime, setStartTime] = useState(null)
  const [stats, setStats] = useState({
    time: 0,
    inputCount: 0,
    correctCount: 0,
    wpm: 0,
    accuracy: 0,
  })
  const timerRef = useRef(null)
  const inputCountRef = useRef(0)
  const correctCountRef = useRef(0)
  const repeatCountRef = useRef(0)
  const currentInputRef = useRef('')
  const hasWrongInCurrentWordRef = useRef(false)
  const lastWordHadErrorRef = useRef(false)
  const wordIndexRef = useRef(0)
  const wordsRef = useRef(words)
  wordsRef.current = words
  const prevWordsRef = useRef(words)
  wordIndexRef.current = wordIndex
  const onWordCompleteRef = useRef(onWordComplete)
  onWordCompleteRef.current = onWordComplete
  const onAutoRemoveRef = useRef(onAutoRemove)
  onAutoRemoveRef.current = onAutoRemove
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  // 白噪声 buffer，首次播放时懒创建
  const noiseBufferRef = useRef(null)

  // 跟踪语音合成状态，避免空 cancel()
  const speakingRef = useRef(false)

  // 收集 setTimeout 引用，组件卸载时统一清理
  const timeoutsRef = useRef([])

  // 错字后 300ms 自动清空输入的定时器句柄：
  // 跳词/切章/退格/重打时必须先取消，否则到点会把新上下文里已敲的输入清掉
  const wrongResetTimerRef = useRef(null)
  const clearWrongResetTimer = useCallback(() => {
    if (wrongResetTimerRef.current) {
      clearTimeout(wrongResetTimerRef.current)
      wrongResetTimerRef.current = null
    }
  }, [])

  const audioCacheRef = useRef(new Map())

  const getOrCreateAudio = useCallback((word) => {
    const cache = audioCacheRef.current
    let audio = cache.get(word)
    if (!audio) {
      audio = new Audio(
        `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=2`
      )
      audio.preload = 'auto'
      cache.set(word, audio)
    }
    return audio
  }, [])

  const preloadWord = useCallback(
    (word) => {
      if (!soundEnabled || !word) return
      const audio = getOrCreateAudio(word)
      if (audio.readyState === 0) {
        try {
          audio.load()
        } catch {}
      }
    },
    [soundEnabled, getOrCreateAudio]
  )

  const speakWord = useCallback(
    (word) => {
      if (!soundEnabled || !word) return
      const audio = getOrCreateAudio(word)
      try {
        audio.currentTime = 0
      } catch {}
      playMediaSafe(audio)
    },
    [soundEnabled, getOrCreateAudio]
  )

  // words 变化时处理状态：区分"单词移除"和"新词库加载"
  useEffect(() => {
    const prev = prevWordsRef.current
    const prevLen = prev.length
    const newLen = words.length

    if (newLen < prevLen && prevLen > 0) {
      // 单词被移除：智能调整 wordIndex，保留统计数据
      const removedIdx = prev.findIndex((w, i) => !words[i] || w.name !== words[i].name)
      if (removedIdx !== -1) {
        if (removedIdx < wordIndexRef.current) {
          // 被移除的词在当前词之前，index 需要前移
          setWordIndex((prev) => Math.max(0, prev - 1))
        } else if (removedIdx === wordIndexRef.current) {
          // 当前词被移除，保持 index（此时该位置已是下一个词）
          setWordIndex(Math.min(wordIndexRef.current, Math.max(0, newLen - 1)))
        }
        // removedIdx > wordIndex: 无需调整
      }
      // 清空输入状态，但保留统计
      setCurrentInput('')
      currentInputRef.current = ''
      setIsWrong(false)
      repeatCountRef.current = 0
      hasWrongInCurrentWordRef.current = false

      if (newLen === 0) {
        setIsFinished(true)
      }
    } else {
      // 新词库加载：完整重置
      setWordIndex(0)
      setCurrentInput('')
      currentInputRef.current = ''
      setIsWrong(false)
      setIsFinished(false)
      setStartTime(null)
      setStats({ time: 0, inputCount: 0, correctCount: 0, wpm: 0, accuracy: 0 })
      inputCountRef.current = 0
      correctCountRef.current = 0
      repeatCountRef.current = 0
      hasWrongInCurrentWordRef.current = false
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }

    prevWordsRef.current = words

    return () => {
      if (wrongResetTimerRef.current) {
        clearTimeout(wrongResetTimerRef.current)
        wrongResetTimerRef.current = null
      }
      timeoutsRef.current.forEach(clearTimeout)
      timeoutsRef.current = []
      audioCacheRef.current.forEach((audio) => {
        try {
          audio.pause()
          audio.currentTime = 0
        } catch {}
      })
      audioCacheRef.current.clear()
    }
  }, [words])

  // soundEnabled 为 true 时朗读首词
  useEffect(() => {
    if (soundEnabled && words.length > 0 && wordIndex === 0 && currentInput === '') {
      speakWord(words[0]?.name)
      preloadWord(words[1]?.name)
    }
  }, [soundEnabled, words, wordIndex, currentInput, speakWord, preloadWord])

  // 计时器
  useEffect(() => {
    if (startTime && !isFinished) {
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000)
        setStats((prev) => {
          if (prev.time === elapsed) return prev
          return {
            ...prev,
            time: elapsed,
            wpm: elapsed > 0 ? Math.round((correctCountRef.current / elapsed) * 60) : 0,
          }
        })
      }, 1000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [startTime, isFinished])

  const safeIndex = words.length > 0 ? Math.min(wordIndex, words.length - 1) : 0
  const currentWord = words[safeIndex] || null

  const handleInput = useCallback(
    (key) => {
      if (isFinished || !currentWord) return
      // 任何新输入（含退格）都使先前错字触发的 300ms 自动清空作废，
      // 连错时也避免定时器堆叠
      clearWrongResetTimer()
      if (!startTime) setStartTime(Date.now())
      if (key === 'Backspace') {
        setCurrentInput((prev) => {
          const next = prev.slice(0, -1)
          currentInputRef.current = next
          return next
        })
        setIsWrong(false)
        return
      }

      if (soundEnabled) playKeySound(noiseBufferRef)

      const target = normalizeWordName(currentWord.name)
      const nextInput = currentInputRef.current + key
      inputCountRef.current += 1

      if (target.startsWith(nextInput)) {
        currentInputRef.current = nextInput
        setCurrentInput(nextInput)
        setIsWrong(false)
        if (nextInput === target) {
          if (soundEnabled) playSound('correct')
          correctCountRef.current += target.length
          if (autoRemoveErrorWord && !hasWrongInCurrentWordRef.current) {
            onAutoRemoveRef.current?.(currentWord.name)
          }
          const completedTimes = repeatCountRef.current + 1
          const shouldAdvance = wordRepeatCount !== 0 && completedTimes >= wordRepeatCount
          if (shouldAdvance) {
            lastWordHadErrorRef.current = hasWrongInCurrentWordRef.current
            onWordCompleteRef.current?.(currentWord.name)
            if (wordIndex >= words.length - 1) {
              if (soundEnabled) playSound('finish')
              setIsFinished(true)
              const elapsed = Math.floor((Date.now() - startTime) / 1000) || 1
              setStats({
                time: elapsed,
                inputCount: inputCountRef.current,
                correctCount: correctCountRef.current,
                wpm: Math.round((correctCountRef.current / elapsed) * 60),
                accuracy:
                  inputCountRef.current > 0
                    ? Math.round((correctCountRef.current / inputCountRef.current) * 100) / 100
                    : 0,
              })
            } else {
              setWordIndex((prev) => prev + 1)
              currentInputRef.current = ''
              setCurrentInput('')
              repeatCountRef.current = 0
              hasWrongInCurrentWordRef.current = false
              speakWord(wordsRef.current[wordIndex + 1]?.name)
              preloadWord(wordsRef.current[wordIndex + 2]?.name)
            }
          } else {
            repeatCountRef.current = completedTimes
            currentInputRef.current = ''
            setCurrentInput('')
            speakWord(currentWord?.name)
          }
        }
      } else {
        if (soundEnabled) playSound('wrong')
        currentInputRef.current = nextInput
        setCurrentInput(nextInput)
        setIsWrong(true)
        hasWrongInCurrentWordRef.current = true

        if (onErrorRef.current) {
          const letterIndex = currentInputRef.current.length - 1
          onErrorRef.current(currentWord, target[letterIndex], key, letterIndex)
        }

        if (!isErrorBookMode && currentWord) {
          addToErrorBook({
            word: currentWord.name,
            trans: Array.isArray(currentWord.trans)
              ? currentWord.trans.join('; ')
              : currentWord.trans,
            notation: currentWord.notation,
            dictName,
          })
        }

        clearWrongResetTimer()
        wrongResetTimerRef.current = setTimeout(() => {
          wrongResetTimerRef.current = null
          currentInputRef.current = ''
          setCurrentInput('')
          setIsWrong(false)
        }, 300)
      }
    },
    [
      currentWord,
      wordIndex,
      words,
      isFinished,
      startTime,
      speakWord,
      preloadWord,
      soundEnabled,
      wordRepeatCount,
      isErrorBookMode,
      dictName,
      autoRemoveErrorWord,
      onAutoRemove,
      clearWrongResetTimer,
    ]
  )

  const jumpTo = useCallback(
    (index) => {
      if (index < 0 || index >= wordsRef.current.length) return
      clearWrongResetTimer()
      setWordIndex(index)
      currentInputRef.current = ''
      setCurrentInput('')
      setIsWrong(false)
      setIsFinished(false)
      repeatCountRef.current = 0
      hasWrongInCurrentWordRef.current = false
      if (soundEnabled) {
        speakWord(wordsRef.current[index]?.name)
        preloadWord(wordsRef.current[index + 1]?.name)
      }
    },
    [soundEnabled, speakWord, preloadWord, clearWrongResetTimer]
  )

  const reset = useCallback(() => {
    clearWrongResetTimer()
    setWordIndex(0)
    currentInputRef.current = ''
    setCurrentInput('')
    setIsWrong(false)
    setIsFinished(false)
    setStartTime(null)
    setStats({ time: 0, inputCount: 0, correctCount: 0, wpm: 0, accuracy: 0 })
    inputCountRef.current = 0
    correctCountRef.current = 0
    repeatCountRef.current = 0
    hasWrongInCurrentWordRef.current = false
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (soundEnabled && wordsRef.current.length > 0) {
      speakWord(wordsRef.current[0]?.name)
      preloadWord(wordsRef.current[1]?.name)
    }
  }, [soundEnabled, speakWord, preloadWord, clearWrongResetTimer])

  return {
    currentWord,
    currentInput,
    wordIndex,
    stats,
    isFinished,
    isWrong,
    handleInput,
    jumpTo,
    reset,
    startTime,
    lastWordHadErrorRef,
  }
}
