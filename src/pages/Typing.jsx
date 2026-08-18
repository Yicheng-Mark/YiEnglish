import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { List } from 'lucide-react'
import { loadDictionary } from '../utils/loadDictionary.js'
import { playMediaSafe } from '../utils/playMediaSafe.js'
import { getErrorBookCount, removeFromErrorBook } from '../utils/errorBook.js'
import { getReadingWordBookCount, removeFromReadingWordBook } from '../utils/readingWordBook.js'
import { getCorpusWordBookCount, removeFromCorpusWordBook } from '../utils/corpusWordBook.js'
import { getFavoriteWordsCount, removeFromFavoriteWords } from '../utils/favoriteWords.js'
import { getMeta } from '../dictionaries/meta.js'
import useTyping from '../hooks/useTyping.js'
import { useUserConfig } from '../hooks/useUserConfig.js'
import { getReadingStoreActions } from '../modules/reading/hooks/useReadingStore.js'
import StatsPanel from '../components/StatsPanel.jsx'
import ResultModal from '../components/ResultModal.jsx'
import TypingToolbar from '../components/TypingToolbar.jsx'
import WrongBookModal from '../components/WrongBookModal.jsx'
import WordListPanel from '../components/WordListPanel.jsx'
import NextWordPreview from '../components/NextWordPreview.jsx'
import WordDisplay from '../components/WordDisplay.jsx'
import EmptyState from '../components/EmptyState.jsx'
import useIsMobile from '../hooks/useIsMobile.js'
import useVirtualKeyboard from '../hooks/useVirtualKeyboard.js'
import useTypingInput from '../hooks/useTypingInput.js'
import useTypingGestures from '../hooks/useTypingGestures.js'
import useProgressSync from '../hooks/useProgressSync.js'
import { saveProgress } from '../lib/api.js'
import { saveLocalProgress } from '../utils/localProgress.js'
import { addWordToReview, updateReviewCard } from '../utils/reviewCards.js'
import { useWordContext } from '../contexts/WordContext.jsx'
import useErrorTracking from '../hooks/useErrorTracking.js'
import { useAuth } from '../contexts/AuthContext.jsx'

const TRIAL_CHAPTER_COUNT = 5

export default function Typing() {
  const { dictId, chapterId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isTrial = !!user?.isTrial
  const [searchParams] = useSearchParams()
  const [words, setWords] = useState([])
  const [chapters, setChapters] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showWrongBook, setShowWrongBook] = useState(false)
  const [isWordListOpen, setIsWordListOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const hiddenInputRef = useRef(null)
  const hasJumpedRef = useRef(false)
  const completedBufferRef = useRef([])
  const [keyboardActive, setKeyboardActive] = useState(true)
  const keyboardActiveRef = useRef(true)
  const blurTimerRef = useRef(null)

  const isMobile = useIsMobile()
  // 移动端：监听 visualViewport 高度变化，检测虚拟键盘弹出/收起（统一到 useVirtualKeyboard）
  const { keyboardHeight, viewportHeight } = useVirtualKeyboard({ active: isMobile })
  const isErrorBookMode = dictId === 'error-book'
  const isReadingWordBookMode = dictId === 'reading-word-book'
  const isCorpusWordBookMode = dictId === 'corpus-word-book'
  const isFavoriteWordBookMode = dictId === 'favorite-words'
  const isReviewMode = dictId === 'review'
  const isWordBookMode = isReadingWordBookMode || isCorpusWordBookMode || isFavoriteWordBookMode

  const targetWordIndex = parseInt(searchParams.get('wordIndex')) || 0

  const { config, toggleConfig, updateConfig, theme, setTheme } = useUserConfig()
  const { onError: onErrorTracking } = useErrorTracking()

  useEffect(() => {
    // 竞态防护：快速切换词书/章节时，旧 dictId 的慢响应后到会覆盖新数据，
    // 页面显示 A 的单词但 URL 是 B，后续进度会记到错误的词书名下
    let cancelled = false
    setLoading(true)
    setError(null)
    hasJumpedRef.current = false
    loadDictionary(dictId)
      .then((dict) => {
        if (cancelled) return
        if (!dict) {
          setError('加载失败')
          setLoading(false)
          return
        }
        setChapters(dict.chapters || [])
        const chapter = dict.chapters?.find((c) => c.id === Number(chapterId))
        if (chapter?.words?.length > 0) {
          setWords(chapter.words)
        } else if (isErrorBookMode && (!dict.chapters || dict.chapters.length === 0)) {
          setError('错题本暂无单词')
        } else if (isReviewMode && (!dict.chapters || dict.chapters.length === 0)) {
          setError('暂无待复习单词')
        } else if (isFavoriteWordBookMode && (!dict.chapters || dict.chapters.length === 0)) {
          setError('收藏词本暂无单词')
          setWords([])
        } else {
          setError('章节不存在或为空')
        }
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError('加载失败')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [dictId, chapterId, isErrorBookMode, isFavoriteWordBookMode, isReviewMode, reloadKey])

  const dictName = useMemo(() => getMeta(dictId)?.name || dictId, [dictId])

  const flushServerProgress = useCallback(() => {
    if (isErrorBookMode || isWordBookMode || isReviewMode) return
    const buffered = completedBufferRef.current.splice(0)
    if (buffered.length === 0) return
    saveProgress(dictId, Number(chapterId), buffered).catch(() => {
      completedBufferRef.current.push(...buffered)
    })
  }, [isErrorBookMode, isWordBookMode, isReviewMode, dictId, chapterId])

  const handleWordComplete = useCallback(
    (wordName) => {
      if (isReviewMode) {
        const hadError = lastWordHadErrorRef.current
        updateReviewCard(wordName, hadError ? 3 : 5)
        return
      }
      if (isErrorBookMode || isWordBookMode) return
      saveLocalProgress(dictId, Number(chapterId), [wordName])
      addWordToReview(wordName, dictId)
      completedBufferRef.current.push(wordName)
      if (completedBufferRef.current.length >= 5) {
        flushServerProgress()
      }
    },
    [isReviewMode, isErrorBookMode, isWordBookMode, dictId, chapterId, flushServerProgress]
  )

  const handleAutoRemove = useCallback(
    (wordName) => {
      if (isReviewMode) return
      if (isErrorBookMode) removeFromErrorBook(wordName)
      else if (isReadingWordBookMode) removeFromReadingWordBook(wordName)
      else if (isCorpusWordBookMode) removeFromCorpusWordBook(wordName)
      else if (isFavoriteWordBookMode) removeFromFavoriteWords(wordName)
    },
    [
      isReviewMode,
      isErrorBookMode,
      isReadingWordBookMode,
      isCorpusWordBookMode,
      isFavoriteWordBookMode,
    ]
  )

  const {
    currentWord,
    currentInput,
    wordIndex,
    stats,
    isFinished,
    handleInput,
    jumpTo,
    reset,
    isWrong,
    startTime,
    lastWordHadErrorRef,
  } = useTyping(
    words,
    config.soundEnabled,
    config.wordRepeatCount,
    isErrorBookMode,
    dictName,
    config.autoRemoveErrorWord,
    handleWordComplete,
    handleAutoRemove,
    onErrorTracking
  )
  const { setCurrentWord } = useWordContext()
  useEffect(() => {
    setCurrentWord(currentWord)
    return () => setCurrentWord(null)
  }, [currentWord, setCurrentWord])
  const addTypingSeconds = getReadingStoreActions().addTypingSeconds
  const typingAccumulatedRef = useRef(0)
  const lastFlushRef = useRef(0)

  const remainingErrorCount = useMemo(() => {
    if (!isErrorBookMode) return 0
    return getErrorBookCount()
  }, [isErrorBookMode, isFinished, reloadKey])

  const remainingReadingCount = useMemo(() => {
    if (!isReadingWordBookMode) return 0
    return getReadingWordBookCount()
  }, [isReadingWordBookMode, isFinished, reloadKey])

  const remainingCorpusCount = useMemo(() => {
    if (!isCorpusWordBookMode) return 0
    return getCorpusWordBookCount()
  }, [isCorpusWordBookMode, isFinished, reloadKey])

  const remainingFavoriteCount = useMemo(() => {
    if (!isFavoriteWordBookMode) return 0
    return getFavoriteWordsCount()
  }, [isFavoriteWordBookMode, isFinished, reloadKey])

  // 进度刷新副作用 / 收藏（机械抽离自原内联代码，逻辑逐行对应；在 useTyping 之后调用，
  // 以便传入真实的 flushServerProgress / isFinished / currentWord）
  const { isCurrentWordFavorited, handleToggleFavorite } = useProgressSync({
    flushServerProgress,
    isFinished,
    currentWord,
  })

  // 加载完成后，自动跳转到 URL 参数指定的单词
  useEffect(() => {
    if (!loading && words.length > 0 && targetWordIndex > 0 && !hasJumpedRef.current) {
      const validIndex = Math.min(targetWordIndex, words.length - 1)
      jumpTo(validIndex)
      hasJumpedRef.current = true
    }
  }, [loading, words, targetWordIndex, jumpTo])

  // 记录单词打字学习时间
  // addTypingSeconds 是模块级稳定引用，避免 studyStore 这类每渲染必变
  // 的对象进依赖数组导致每次按键都拆掉重建 interval
  useEffect(() => {
    if (!startTime || isFinished) {
      if (typingAccumulatedRef.current > lastFlushRef.current) {
        const delta = typingAccumulatedRef.current - lastFlushRef.current
        addTypingSeconds(delta)
        lastFlushRef.current = typingAccumulatedRef.current
      }
      return
    }

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000)
      typingAccumulatedRef.current = elapsed
      const delta = elapsed - lastFlushRef.current
      if (delta >= 30) {
        addTypingSeconds(delta)
        lastFlushRef.current = elapsed
      }
    }, 1000)

    return () => {
      clearInterval(interval)
      const elapsed = Math.floor((Date.now() - startTime) / 1000)
      typingAccumulatedRef.current = elapsed
      const delta = elapsed - lastFlushRef.current
      if (delta > 0) {
        addTypingSeconds(delta)
        lastFlushRef.current = elapsed
      }
    }
  }, [startTime, isFinished, addTypingSeconds])

  // IME 合成处理与输入代理（机械抽离自原内联代码，逻辑逐行对应）
  const {
    isComposingRef,
    justCommittedRef,
    inputValueRef,
    handleCharacterInput,
    handleBackspace,
    handleInputChange,
    handleCompositionStart,
    handleCompositionEnd,
  } = useTypingInput({ isFinished, handleInput, hiddenInputRef })

  // 移动端触摸手势（机械抽离自原内联代码，逻辑逐行对应）
  const { touchStartRef, suppressClickRef, handleTouchStart, handleTouchEnd } = useTypingGestures({
    isMobile,
    isFinished,
    wordIndex,
    wordsLength: words.length,
    jumpTo,
    keyboardActive,
    setKeyboardActive,
    currentWord,
    dictId,
    chapterId,
    hiddenInputRef,
  })

  // 移动端：点击/触摸页面任意位置重新聚焦输入框，防止失焦后无法打字
  useEffect(() => {
    if (!isMobile || isFinished || words.length === 0 || !keyboardActive) return
    const focusInput = (e) => {
      if (suppressClickRef.current) return
      // 点击/触摸工具栏按钮、下拉菜单项等交互控件时不抢焦点，避免移动端干扰其 click
      if (
        e?.target?.closest?.(
          'button, a, .dropdown-menu, .dropdown-item, input, textarea, select, [data-no-refocus]'
        )
      )
        return
      try {
        hiddenInputRef.current?.focus({ preventScroll: true })
      } catch {
        hiddenInputRef.current?.focus()
      }
    }
    document.addEventListener('click', focusInput)
    document.addEventListener('touchstart', focusInput, { passive: true })
    return () => {
      document.removeEventListener('click', focusInput)
      document.removeEventListener('touchstart', focusInput)
    }
  }, [isMobile, isFinished, words.length, keyboardActive, suppressClickRef])

  // 页面加载/章节切换后自动聚焦隐藏输入框并清空残留
  useEffect(() => {
    if (!loading && words.length > 0 && hiddenInputRef.current) {
      setTimeout(() => {
        if (isMobile && !keyboardActiveRef.current) return
        if (isMobile) {
          try {
            hiddenInputRef.current?.focus({ preventScroll: true })
          } catch {
            hiddenInputRef.current?.focus()
          }
        } else {
          hiddenInputRef.current?.focus()
        }
        inputValueRef.current = ''
        if (hiddenInputRef.current) hiddenInputRef.current.value = ''
      }, 300)
    }
  }, [loading, isMobile, inputValueRef])

  // 同步 keyboardActive 到 ref，避免 setTimeout 闭包 stale
  useEffect(() => {
    keyboardActiveRef.current = keyboardActive
  }, [keyboardActive])

  const visibleChapters = isTrial ? chapters.slice(0, TRIAL_CHAPTER_COUNT) : chapters
  const hasNextChapter =
    !isErrorBookMode &&
    !isReadingWordBookMode &&
    !isCorpusWordBookMode &&
    !isFavoriteWordBookMode &&
    !isReviewMode &&
    visibleChapters.some((c) => c.id === Number(chapterId) + 1)

  const handleNextChapter = useCallback(() => {
    const nextId = Number(chapterId) + 1
    navigate(`/typing/${dictId}/${nextId}`)
  }, [navigate, dictId, chapterId])

  // 桌面端：window 级别 keydown 监听，保持原有逻辑不变
  useEffect(() => {
    if (isMobile) return
    const onKeyDown = (e) => {
      if (isFinished) return
      // 安全重置：防止从 IME 切换到直接英文输入时标记残留
      justCommittedRef.current = false
      // Windows IME 发送 Process 键，跳过（字符通过 compositionEnd 或 onChange 到达）
      if (e.key === 'Process') return
      // macOS 中文 IME 的 keydown 中 e.key 为实际字母而非 Process，但 e.isComposing 为 true
      // 优先检查浏览器原生 isComposing，避免 preventDefault 取消 IME 合成
      if (e.isComposing || e.nativeEvent?.isComposing) return
      // Edge bug: 中文 IME 英文模式下 compositionEnd 不触发，isComposingRef 卡在 true。
      // 用原生 e.isComposing 检测：如果浏览器认为合成已结束，立即重置 ref
      if (!e.isComposing) isComposingRef.current = false
      if (isComposingRef.current) return
      // 词表/错题本弹窗打开时不响应打字，避免弹窗内每键重渲染全部错题行
      if (isWordListOpen || showWrongBook) return
      if (
        (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') &&
        e.target !== hiddenInputRef.current
      )
        return
      if (e.key === 'Tab' || e.key === 'ArrowRight') {
        e.preventDefault()
        if (currentWord) {
          saveLocalProgress(dictId, Number(chapterId), [currentWord.name])
        }
        if (wordIndex < words.length - 1) {
          jumpTo(wordIndex + 1)
        } else if (hasNextChapter) {
          flushServerProgress()
          navigate(`/typing/${dictId}/${Number(chapterId) + 1}`)
        }
        return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (wordIndex > 0) {
          jumpTo(wordIndex - 1)
        } else if (Number(chapterId) > 0) {
          flushServerProgress()
          navigate(`/typing/${dictId}/${Number(chapterId) - 1}?wordIndex=999`)
        }
        return
      }
      if (e.key === ' ') e.preventDefault()
      if (e.key === 'Backspace') {
        e.preventDefault()
        handleBackspace()
        return
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        handleCharacterInput(e.key)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    isMobile,
    isFinished,
    isWordListOpen,
    showWrongBook,
    handleBackspace,
    handleCharacterInput,
    wordIndex,
    words.length,
    jumpTo,
    currentWord,
    dictId,
    chapterId,
    hasNextChapter,
    flushServerProgress,
    navigate,
    justCommittedRef,
    isComposingRef,
    hiddenInputRef,
  ])

  const handleInputBlur = useCallback(() => {
    if (isMobile) {
      // 延迟检查：键盘弹出动画期间可能短暂 blur 再 refocus，
      // 避免误将 keyboardActive 设为 false 导致 pointer-events-none 生效
      clearTimeout(blurTimerRef.current)
      blurTimerRef.current = setTimeout(() => {
        if (!document.activeElement || document.activeElement === document.body) {
          setKeyboardActive(false)
        }
      }, 300)
      return
    }
    setTimeout(() => {
      if (isMobile) {
        try {
          hiddenInputRef.current?.focus({ preventScroll: true })
        } catch {
          hiddenInputRef.current?.focus()
        }
      } else {
        hiddenInputRef.current?.focus()
      }
    }, 100)
  }, [isMobile])

  const handleGoHome = useCallback(() => {
    if (
      isErrorBookMode ||
      isReadingWordBookMode ||
      isCorpusWordBookMode ||
      isFavoriteWordBookMode ||
      isReviewMode
    ) {
      navigate('/word')
    } else {
      navigate(`/dict/${dictId}`)
    }
  }, [
    navigate,
    dictId,
    isErrorBookMode,
    isReadingWordBookMode,
    isCorpusWordBookMode,
    isFavoriteWordBookMode,
    isReviewMode,
  ])

  // 完成章节后延迟跳到下一章，让用户看到"已完成"状态
  useEffect(() => {
    if (!isFinished || !hasNextChapter) return
    flushServerProgress()
    const timer = setTimeout(() => {
      navigate(`/typing/${dictId}/${Number(chapterId) + 1}`)
    }, 1500)
    return () => clearTimeout(timer)
  }, [isFinished, hasNextChapter, navigate, dictId, chapterId, flushServerProgress])

  const handleDeleteCurrentWord = useCallback(() => {
    if (!currentWord || words.length === 0) return
    if (isReviewMode) return
    if (isErrorBookMode) {
      removeFromErrorBook(currentWord.name)
    } else if (isReadingWordBookMode) {
      removeFromReadingWordBook(currentWord.name)
    } else if (isCorpusWordBookMode) {
      removeFromCorpusWordBook(currentWord.name)
    } else if (isFavoriteWordBookMode) {
      removeFromFavoriteWords(currentWord.name)
    } else {
      return
    }
    setWords((prev) => prev.filter((w) => w.name !== currentWord.name))
    // words 变化后 useTyping 的 useEffect 会自动重置输入、计时器、统计等状态
  }, [
    currentWord,
    words.length,
    isReviewMode,
    isErrorBookMode,
    isReadingWordBookMode,
    isCorpusWordBookMode,
    isFavoriteWordBookMode,
  ])

  const handleWordRemovedFromModal = useCallback((wordName) => {
    setWords((prev) => {
      if (!prev.some((w) => w.name === wordName)) return prev
      return prev.filter((w) => w.name !== wordName)
    })
  }, [])

  // 稳定引用配合 WrongBookModal 的 memo，避免每键渲染时弹窗整树重建
  const closeWrongBook = useCallback(() => setShowWrongBook(false), [])
  const openWrongBook = useCallback(() => setShowWrongBook(true), [])
  const closeWordList = useCallback(() => setIsWordListOpen(false), [])

  const handleJumpToWord = useCallback(
    (index) => {
      jumpTo(index)
      setIsWordListOpen(false)
      if (isMobile && keyboardActive) {
        try {
          hiddenInputRef.current?.focus({ preventScroll: true })
        } catch {
          hiddenInputRef.current?.focus()
        }
      }
    },
    [jumpTo, isMobile, keyboardActive]
  )

  const handlePlaySound = useCallback((word) => {
    const audio = new Audio(
      `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=2`
    )
    playMediaSafe(audio)
  }, [])

  const showPhonetic = useMemo(
    () => config.showPhonetic && !config.hideEnglish && !currentWord?.name?.includes(' '),
    [config.showPhonetic, config.hideEnglish, currentWord?.name]
  )
  const showTranslation = useMemo(() => config.showTranslation, [config.showTranslation])

  if (loading)
    return (
      <div className="h-[calc(100dvh-3rem)] md:h-[calc(100vh-4rem)] bg-background dark:bg-transparent flex items-center justify-center transition-colors duration-500">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary dark:border-primary-dark border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-content-tertiary dark:text-gray-400 text-sm">
            {isErrorBookMode
              ? '正在加载错题本...'
              : isReviewMode
                ? '正在加载复习计划...'
                : isReadingWordBookMode
                  ? '正在加载阅读词本...'
                  : isCorpusWordBookMode
                    ? '正在加载语料词本...'
                    : isFavoriteWordBookMode
                      ? '正在加载收藏词本...'
                      : '正在加载章节...'}
          </p>
        </div>
      </div>
    )

  if (error)
    return (
      <EmptyState
        iconBg="bg-indigo-50 dark:bg-indigo-500/10"
        icon={
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
        }
      >
        <p className="text-indigo-500 dark:text-violet-400 mb-6 font-medium">{error}</p>
        <button
          onClick={() =>
            isErrorBookMode || isWordBookMode || isReviewMode
              ? navigate('/word')
              : navigate(`/dict/${dictId}`)
          }
          className="px-5 py-2.5 bg-primary hover:opacity-90 text-white rounded-button font-medium transition shadow-lg shadow-primary/20"
        >
          {isFavoriteWordBookMode || isReviewMode ? '返回词库' : '返回章节列表'}
        </button>
      </EmptyState>
    )

  if (words.length === 0) {
    if (isReviewMode) {
      return (
        <EmptyState
          iconBg="bg-emerald-50 dark:bg-emerald-500/10"
          icon={
            <svg
              className="w-8 h-8 text-emerald-500"
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
          }
        >
          <p className="text-emerald-600 dark:text-emerald-400 mb-2 font-medium text-xl">
            复习完成
          </p>
          <p className="text-content-tertiary dark:text-gray-400 mb-6">
            所有待复习单词已练习完毕！
          </p>
          <button
            onClick={() => navigate('/word')}
            className="px-5 py-2.5 bg-primary hover:opacity-90 text-white rounded-button font-medium transition shadow-lg shadow-primary/20"
          >
            返回词库
          </button>
        </EmptyState>
      )
    }
    if (isErrorBookMode || isWordBookMode) {
      const emptyTitle = isErrorBookMode
        ? '错题本已清空'
        : isReadingWordBookMode
          ? '阅读词本已清空'
          : isCorpusWordBookMode
            ? '语料词本已清空'
            : '收藏词本已清空'
      const emptyDesc = isErrorBookMode
        ? '所有单词都已练熟，去挑战新词库吧！'
        : isReadingWordBookMode
          ? '所有积累的词汇都已练习完毕，去阅读新文章吧！'
          : isCorpusWordBookMode
            ? '所有积累的词汇都已练习完毕，去刷新的语料吧！'
            : '收藏的词汇都已练习完毕，去收藏新的单词吧！'
      return (
        <EmptyState
          iconBg="bg-green-50 dark:bg-green-500/10"
          icon={
            <svg
              className="w-8 h-8 text-green-500"
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
          }
        >
          <p className="text-green-600 dark:text-green-400 mb-2 font-medium text-xl">
            {emptyTitle}
          </p>
          <p className="text-content-tertiary dark:text-gray-400 mb-6">{emptyDesc}</p>
          <button
            onClick={() => navigate('/word')}
            className="px-5 py-2.5 bg-primary hover:opacity-90 text-white rounded-button font-medium transition shadow-lg shadow-primary/20"
          >
            返回词库
          </button>
        </EmptyState>
      )
    }
    return null
  }

  return (
    <div
      className="h-[var(--vv-height,calc(100dvh-3rem))] md:h-[calc(100vh-4rem)] flex bg-background dark:bg-transparent transition-colors duration-500 overflow-hidden"
      style={
        isMobile && viewportHeight
          ? { '--vv-height': `calc(${viewportHeight}px - 3rem)` }
          : undefined
      }
    >
      {/* 左侧可折叠单词列表 */}
      <div
        className={`
        transition-all duration-300 ease-in-out shrink-0 self-stretch
        ${isWordListOpen ? 'w-80 opacity-100' : 'w-0 opacity-0 overflow-hidden'}
      `}
      >
        <WordListPanel
          words={words}
          currentIndex={wordIndex}
          onPlaySound={handlePlaySound}
          onJumpTo={handleJumpToWord}
          onClose={closeWordList}
        />
      </div>

      {/* 右侧主练习区 */}
      <div
        className={`flex-1 flex flex-col min-w-0 relative ${keyboardHeight > 0 ? 'justify-between' : ''}`}
        id="typing-container"
        onClick={() => {
          if (!isMobile) {
            hiddenInputRef.current?.focus()
            return
          }
          if (suppressClickRef.current) return
          if (keyboardActive) {
            try {
              hiddenInputRef.current?.focus({ preventScroll: true })
            } catch {
              hiddenInputRef.current?.focus()
            }
          }
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={() => {
          touchStartRef.current = null
        }}
      >
        {/* 左侧中部展开列表按钮 */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            setIsWordListOpen((v) => !v)
            if (isMobile) hiddenInputRef.current?.blur()
          }}
          className={`
            fixed left-2 md:left-4 top-[55%] md:top-1/2 -translate-y-1/2 z-[60] p-3 rounded-full shadow-lg
            transition-all duration-300 backdrop-blur-sm
            ${
              isWordListOpen
                ? 'opacity-0 pointer-events-none -translate-x-4'
                : 'opacity-100 translate-x-0 bg-white/80 dark:bg-elevated/80 text-slate-600 dark:text-gray-300 hover:bg-white dark:hover:bg-white/[0.12]'
            }
          `}
          title="章节单词列表"
        >
          <List className="w-5 h-5" />
        </button>

        {/* 顶部栏 */}
        <div className="min-h-12 md:h-14 shrink-0 flex items-center justify-between px-3 md:px-4 z-[60]">
          <button
            onClick={() =>
              isErrorBookMode ||
              isReadingWordBookMode ||
              isCorpusWordBookMode ||
              isFavoriteWordBookMode ||
              isReviewMode
                ? navigate('/word')
                : navigate(`/dict/${dictId}`)
            }
            className="text-content-tertiary dark:text-gray-400 hover:text-primary dark:hover:text-primary-dark flex items-center gap-2 text-sm transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.04]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <span className="hidden sm:inline">
              {isErrorBookMode ||
              isReadingWordBookMode ||
              isCorpusWordBookMode ||
              isFavoriteWordBookMode ||
              isReviewMode
                ? '返回词库'
                : '返回章节列表'}
            </span>
          </button>

          <div className="flex flex-col items-center">
            <div className="text-base font-semibold text-content dark:text-white">
              {isFinished ? (
                <span className="text-green-600 dark:text-green-400">已完成 ✓</span>
              ) : isReviewMode ? (
                '复习练习'
              ) : isErrorBookMode ? (
                '错题本练习'
              ) : isReadingWordBookMode ? (
                '阅读词本练习'
              ) : isCorpusWordBookMode ? (
                '语料词本练习'
              ) : isFavoriteWordBookMode ? (
                '收藏词本练习'
              ) : (
                `第 ${wordIndex + 1} / ${words.length} 词`
              )}
            </div>
            <div className="w-48 md:w-56 h-2 bg-gray-200 dark:bg-white/[0.08] rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isFinished
                    ? 'bg-green-500 dark:bg-green-400 shadow-[0_0_8px_rgba(34,197,94,0.5)]'
                    : 'bg-primary dark:bg-primary-dark shadow-[0_0_6px_rgba(99,102,241,0.45)] dark:shadow-[0_0_8px_rgba(129,140,248,0.5)]'
                }`}
                style={{ width: `${((wordIndex + 1) / words.length) * 100}%` }}
              />
            </div>
          </div>

          <TypingToolbar
            dictId={dictId}
            currentChapterId={chapterId}
            chapters={visibleChapters}
            config={config}
            toggleConfig={toggleConfig}
            updateConfig={updateConfig}
            theme={theme}
            setTheme={setTheme}
            onOpenWrongBook={openWrongBook}
            isErrorBookMode={isErrorBookMode}
            isReadingWordBookMode={isReadingWordBookMode}
            isCorpusWordBookMode={isCorpusWordBookMode}
            isFavoriteWordBookMode={isFavoriteWordBookMode}
            onDeleteCurrentWord={handleDeleteCurrentWord}
            onToggleFavorite={handleToggleFavorite}
            isCurrentWordFavorited={isCurrentWordFavorited}
          />
        </div>

        {/* 单词前后预览 */}
        <NextWordPreview
          prevWord={wordIndex > 0 ? words[wordIndex - 1] : null}
          nextWord={wordIndex < words.length - 1 ? words[wordIndex + 1] : null}
          showTranslation={showTranslation}
          hideEnglish={config.hideEnglish}
        />

        {/* 单词显示 */}
        <div
          className={`flex flex-col items-center px-4 min-h-0 relative ${keyboardHeight > 0 ? 'flex-1 min-h-0 justify-start pt-2' : 'flex-1 justify-center overflow-hidden'}`}
        >
          {/* 隐藏输入框：桌面端接收 IME 事件，移动端代理键盘输入 */}
          <input
            ref={hiddenInputRef}
            type="text"
            onChange={handleInputChange}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            onBlur={handleInputBlur}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            className={
              isMobile
                ? 'absolute inset-0 w-full h-full opacity-0 z-50'
                : 'fixed opacity-0 w-px h-px top-0 left-0 pointer-events-none'
            }
            style={{
              fontSize: '16px',
              caretColor: 'transparent',
            }}
          />
          <div
            className={`flex flex-col items-center text-center ${keyboardHeight > 0 ? 'gap-0.5' : 'gap-2 md:gap-10'}`}
          >
            {showPhonetic &&
              (currentWord?.usphone ||
                currentWord?.us ||
                currentWord?.ukphone ||
                currentWord?.uk) && (
                <div
                  className={`text-gray-300 dark:text-gray-600 font-mono tracking-wide shrink-0 ${keyboardHeight > 0 ? 'text-lg mb-0' : 'text-xl md:text-5xl mb-1 md:mb-4'}`}
                >
                  /{currentWord.usphone || currentWord.us || currentWord.ukphone || currentWord.uk}/
                </div>
              )}

            <div className="shrink-0">
              <WordDisplay
                key={currentWord?.name}
                word={currentWord}
                currentInput={currentInput}
                isWrong={isWrong}
                hideEnglish={config.hideEnglish}
              />
            </div>

            {currentWord?.trans && showTranslation && (
              <div
                className={`text-content-tertiary dark:text-gray-400 leading-relaxed md:leading-normal max-w-full md:max-w-2xl shrink-0 ${keyboardHeight > 0 ? 'text-xs' : 'text-sm md:text-2xl'}`}
              >
                {(Array.isArray(currentWord.trans)
                  ? currentWord.trans.join('；')
                  : currentWord.trans
                )
                  .split(/(\[[^\]]+\])/g)
                  .map((part, i) =>
                    /^\[.+\]$/.test(part) ? (
                      <span key={i} className="text-content-tertiary dark:text-gray-500">
                        {part}
                      </span>
                    ) : (
                      part
                    )
                  )}
              </div>
            )}
          </div>
        </div>

        <StatsPanel stats={stats} keyboardHeight={keyboardHeight} />

        {isFinished && !hasNextChapter && (
          <ResultModal
            stats={stats}
            onRestart={reset}
            onGoHome={handleGoHome}
            onNextChapter={handleNextChapter}
            hasNextChapter={hasNextChapter}
            isErrorBookMode={isErrorBookMode}
            remainingErrorCount={remainingErrorCount}
            isReadingWordBookMode={isReadingWordBookMode}
            remainingReadingCount={remainingReadingCount}
            isCorpusWordBookMode={isCorpusWordBookMode}
            remainingCorpusCount={remainingCorpusCount}
            isFavoriteWordBookMode={isFavoriteWordBookMode}
            remainingFavoriteCount={remainingFavoriteCount}
            isReviewMode={isReviewMode}
          />
        )}
        {showWrongBook && (
          <WrongBookModal
            onClose={closeWrongBook}
            onWordRemoved={
              isErrorBookMode || isWordBookMode ? handleWordRemovedFromModal : undefined
            }
          />
        )}
      </div>
    </div>
  )
}
