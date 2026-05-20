import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { dictionaryMeta, categories } from '../dictionaries/meta.js'
import { loadDictionary } from '../utils/loadDictionary.js'
import { buildWordIndex, searchWordIndex } from '../utils/wordIndex.js'
import { getErrorBookCount } from '../utils/errorBook.js'
import { getReadingWordBookCount } from '../utils/readingWordBook.js'
import { getCorpusWordBookCount } from '../utils/corpusWordBook.js'
import { getFavoriteWordsCount } from '../utils/favoriteWords.js'
import { useDebounce } from '../hooks/useDebounce.js'
import { useFavorites } from '../utils/favoriteDicts.js'
import Hero from '../components/Hero'
import Features from '../components/Features'
import ErrorBookCard from '../components/ErrorBookCard'

const SCROLL_KEY = 'lf_wordlib_scroll_y'
const RESTORE_KEY = 'lf_wordlib_should_restore'

function Home() {
  const navigate = useNavigate()
  const location = useLocation()

  const saveScrollAndNavigate = useCallback((path) => {
    sessionStorage.setItem(SCROLL_KEY, String(window.scrollY))
    navigate(path)
  }, [navigate])

  const [selectedCategory, setSelectedCategory] = useState('全部')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const dropdownRef = useRef(null)
  const { favorites, isFavorite, toggleFavorite } = useFavorites()

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const shouldRestore = sessionStorage.getItem(RESTORE_KEY) === 'true'
    const savedY = sessionStorage.getItem(SCROLL_KEY)

    sessionStorage.removeItem(SCROLL_KEY)
    sessionStorage.removeItem(RESTORE_KEY)

    if (shouldRestore && savedY !== null) {
      const y = parseInt(savedY, 10)
      requestAnimationFrame(() => {
        window.scrollTo({ top: y, behavior: 'instant' })
      })
    }
  }, [location.key])

  const [searchQuery, setSearchQuery] = useState('')
  const readingWordCount = getReadingWordBookCount()
  const corpusWordCount = getCorpusWordBookCount()
  const favoriteWordCount = getFavoriteWordsCount()

  // 单词搜索:跨词库
  const [wordQuery, setWordQuery] = useState('')
  const [wordResults, setWordResults] = useState([])
  const [showWordResults, setShowWordResults] = useState(false)
  const [dictionaries, setDictionaries] = useState([])
  const wordSearchRef = useRef(null)
  const debouncedWordQuery = useDebounce(wordQuery, 300)

  // 浏览器空闲时再加载所有词库,避免阻塞首屏渲染
  useEffect(() => {
    let cancelled = false
    const loadAll = async () => {
      const loaded = await Promise.all(
        dictionaryMeta.map((meta) => loadDictionary(meta.id).catch(() => null))
      )
      if (cancelled) return
      setDictionaries(loaded.filter(Boolean))
    }
    const ric = typeof window !== 'undefined' && window.requestIdleCallback
    let idleHandle, timeoutHandle
    if (ric) {
      idleHandle = window.requestIdleCallback(loadAll, { timeout: 2000 })
    } else {
      timeoutHandle = setTimeout(loadAll, 200)
    }
    return () => {
      cancelled = true
      if (idleHandle && window.cancelIdleCallback) window.cancelIdleCallback(idleHandle)
      if (timeoutHandle) clearTimeout(timeoutHandle)
    }
  }, [])

  const wordIndex = useMemo(() => buildWordIndex(dictionaries), [dictionaries])

  useEffect(() => {
    if (debouncedWordQuery.trim()) {
      setWordResults(searchWordIndex(wordIndex, debouncedWordQuery, 10))
      setShowWordResults(true)
    } else {
      setWordResults([])
      setShowWordResults(false)
    }
  }, [debouncedWordQuery, wordIndex])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wordSearchRef.current && !wordSearchRef.current.contains(e.target)) {
        setShowWordResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleWordSelect = (item) => {
    setWordQuery('')
    setShowWordResults(false)
    saveScrollAndNavigate(`/typing/${item.dictId}/${item.chapterId}?wordIndex=${item.wordIndex}`)
  }

  const filteredDictionaries = dictionaryMeta.filter((d) => {
    const categoryMatch = selectedCategory === '全部' || d.category === selectedCategory
    const query = searchQuery.trim().toLowerCase()
    const searchMatch = !query ||
      d.name.toLowerCase().includes(query) ||
      d.description.toLowerCase().includes(query) ||
      d.category.toLowerCase().includes(query)
    const favoriteMatch = !favoriteOnly || isFavorite(d.id)
    return categoryMatch && searchMatch && favoriteMatch
  })

  // 错题本数量（从 localStorage 读取，不依赖状态变化）
  const errorBookCount = getErrorBookCount()

  const categoryIcons = {
    '功能词本': (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
    ),
    '中学英语': (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
    ),
    '大学英语': (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
    ),
    '英专生英语': (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
    ),
    '留学英语': (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    ),
    '考研英语': (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
    ),
    '专业英语': (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
    ),
  }

  const getCategoryColor = (title) => {
    const t = title.toLowerCase()
    if (t.includes('中学') || t.includes('初中') || t.includes('中考') || t.includes('高中') || t.includes('高考')) return 'bg-green-500'
    if (t.includes('大学') || t.includes('四级') || t.includes('六级')) return 'bg-orange-500'
    if (t.includes('英专')) return 'bg-red-500'
    if (t.includes('留学')) return 'bg-purple-500'
    if (t.includes('考研')) return 'bg-indigo-500'
    if (t.includes('程序员')) return 'bg-slate-500'
    return 'bg-indigo-500'
  }

  const tagColors = {
    'warm-coral': { text: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-500/10', top: 'bg-indigo-500' },
    'warm-amber': { text: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-500/10', top: 'bg-violet-500' },
    'warm-rose': { text: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-500/10', top: 'bg-slate-500' },
    'warm-sage': { text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10', top: 'bg-emerald-500' },
    'warm-sky': { text: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-50 dark:bg-sky-500/10', top: 'bg-sky-500' },
    'warm-violet': { text: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-500/10', top: 'bg-violet-500' },
    'warm-slate': { text: 'text-stone-600 dark:text-stone-400', bg: 'bg-stone-50 dark:bg-stone-500/10', top: 'bg-stone-500' },
    'warm-teal': { text: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-500/10', top: 'bg-teal-500' },
  };

  return (
    <>
      <div className="hidden md:block"><Hero /></div>
      <div className="hidden md:block"><Features /></div>
      <div className="min-h-screen bg-background dark:bg-transparent p-6 transition-colors duration-500 animate-page-fade-in">
      <div className="max-w-6xl mx-auto px-6">
        <div id="wordbooks" className="mt-8 md:mt-12 mb-8">
          <div className="flex items-start justify-between">
            <div className="text-left">
              <h1 className="text-display gradient-text mb-4 tracking-tight text-glow-primary animate-pulse-soft">
                选择词库开始练习
              </h1>
              <p className="text-content-tertiary text-body max-w-md">
                从丰富的词库中选择，开启你的单词记忆之旅
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 px-4 py-2 glass-card rounded-button text-sm font-medium text-content-secondary dark:text-gray-300 hover:border-primary/40 dark:hover:border-primary/40 transition-colors cursor-pointer"
                >
                  <span>{selectedCategory === '全部' ? '全部分类' : selectedCategory}</span>
                  <svg
                    className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {dropdownOpen && (
                  <div className="dropdown-menu">
                    <button
                      onClick={() => { setSelectedCategory('全部'); setDropdownOpen(false) }}
                      className={`dropdown-item ${selectedCategory === '全部' ? 'dropdown-item-active' : 'dropdown-item-inactive'}`}
                    >
                      全部分类
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => { setSelectedCategory(cat); setDropdownOpen(false) }}
                        className={`dropdown-item ${selectedCategory === cat ? 'dropdown-item-active' : 'dropdown-item-inactive'}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => setFavoriteOnly(!favoriteOnly)}
                className={`flex items-center gap-2 px-4 py-2 rounded-button text-sm font-medium transition-colors cursor-pointer ${
                  favoriteOnly
                    ? 'bg-amber-500 text-white shadow-md shadow-amber-500/25'
                    : 'glass-card text-content-secondary dark:text-gray-300 hover:border-amber-400/40 dark:hover:border-amber-400/40'
                }`}
              >
                <svg className="w-4 h-4" fill={favoriteOnly ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                <span>{favoriteOnly ? '已收藏' : '只看收藏'}</span>
              </button>
            </div>
          </div>

          <div className="max-w-3xl mx-auto mt-8">
            <div className="flex flex-col md:flex-row gap-3 md:gap-4">
              {/* 词库搜索（保留原有功能） */}
              <div className="relative w-full md:flex-1">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-content-tertiary dark:text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索词库名称、描述..."
                  className="input-field input-glow"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-content-tertiary dark:text-gray-500 hover:text-content-secondary dark:hover:text-gray-300 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* 单词搜索（新增：跨词库全局搜索） */}
              <div className="relative w-full md:flex-1" ref={wordSearchRef}>
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-content-tertiary dark:text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <input
                  type="text"
                  value={wordQuery}
                  onChange={(e) => setWordQuery(e.target.value)}
                  onFocus={() => wordResults.length > 0 && setShowWordResults(true)}
                  placeholder={dictionaries.length > 0 ? '搜索单词...' : '正在加载词库...'}
                  className="input-field input-glow disabled:opacity-60"
                  disabled={dictionaries.length === 0}
                />
                {wordQuery && (
                  <button
                    onClick={() => { setWordQuery(''); setShowWordResults(false); }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-content-tertiary dark:text-gray-500 hover:text-content-secondary dark:hover:text-gray-300 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}

                {/* 单词搜索结果下拉面板 */}
                {showWordResults && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-gray-200 dark:border-white/[0.06] rounded-button shadow-lg z-[60] overflow-y-auto backdrop-blur-xl max-h-[60vh] md:max-h-80">
                    {wordResults.length > 0 ? (
                      wordResults.map((item) => (
                        <div
                          key={`${item.dictId}-${item.chapterIndex}-${item.wordIndex}`}
                          onClick={() => handleWordSelect(item)}
                          className="px-4 py-3 cursor-pointer border-b last:border-0 border-gray-100 dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
                        >
                          <div className="flex justify-between items-center gap-2">
                            <span className="font-bold text-base text-content">
                              {item.word}
                            </span>
                            <span className="text-xs text-content-tertiary font-mono shrink-0">
                              {item.phonetic}
                            </span>
                          </div>
                          <div className="text-sm mt-1 truncate text-content-secondary">
                            {item.definition}
                          </div>
                          <div className="flex items-center gap-1 mt-1.5 text-xs text-primary">
                            <span>{item.dictName}</span>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <span>第 {item.chapterIndex + 1} 章</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-sm text-content-secondary">
                        未找到匹配的单词
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {(() => {
            const q = searchQuery.trim().toLowerCase()
            const match = (keywords) => !q || keywords.some(k => k.toLowerCase().includes(q))
            const showFunctionBooks = (selectedCategory === '全部' || selectedCategory === '功能词本') && !favoriteOnly
            return (<>
          {/* 错题本卡片 */}
          {showFunctionBooks && match(['错题本']) && <ErrorBookCard
            count={errorBookCount}
            onClick={() => saveScrollAndNavigate('/dict/error-book')}
          />}
          {/* 阅读词本卡片 */}
          {showFunctionBooks && match(['阅读词本']) && <div
            onClick={() => saveScrollAndNavigate('/dict/reading-word-book')}
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 p-6 cursor-pointer hover:shadow-lg hover:border-violet-300 dark:border-violet-900/40 dark:from-violet-950/30 dark:to-purple-950/20 dark:hover:border-violet-700/60 dark:hover:shadow-violet-900/20 animate-card-enter glow-border-subtle transition-all duration-150 active:scale-[0.98]"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-violet-500 opacity-80" />
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-violet-900 dark:text-violet-200">阅读词本</h3>
                  <p className="text-sm text-violet-600/80 dark:text-violet-400/70">语境中积累词汇</p>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <div className="inline-flex items-center rounded-lg bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                阅读
              </div>
              <p className="mt-2 text-sm text-violet-600/70 dark:text-violet-400/60">
                {readingWordCount > 0
                  ? `已积累 ${readingWordCount} 个词汇`
                  : '精选文章，在阅读中自然掌握单词'}
              </p>
            </div>
          </div>}
          {/* 语料词本卡片 */}
          {showFunctionBooks && match(['语料词本']) && <div
            onClick={() => saveScrollAndNavigate('/dict/corpus-word-book')}
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border-2 border-cyan-200 bg-gradient-to-br from-cyan-50 to-sky-50 p-6 cursor-pointer hover:shadow-lg hover:border-cyan-300 dark:border-cyan-900/40 dark:from-cyan-950/30 dark:to-sky-950/20 dark:hover:border-cyan-700/60 dark:hover:shadow-cyan-900/20 animate-card-enter glow-border-subtle transition-all duration-150 active:scale-[0.98]"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-cyan-500 opacity-80" />
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-cyan-900 dark:text-cyan-200">语料词本</h3>
                  <p className="text-sm text-cyan-600/80 dark:text-cyan-400/70">从语料字幕中积累词汇</p>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <div className="inline-flex items-center rounded-lg bg-cyan-100 px-2.5 py-1 text-xs font-medium text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300">
                语料中心
              </div>
              <p className="mt-2 text-sm text-cyan-600/70 dark:text-cyan-400/60">
                {corpusWordCount > 0
                  ? `已积累 ${corpusWordCount} 个词汇`
                  : '观看语料视频，在真实语境中掌握单词'}
              </p>
            </div>
          </div>}
          {/* 收藏词本卡片 */}
          {showFunctionBooks && match(['收藏词本']) && <div
            onClick={() => saveScrollAndNavigate('/dict/favorite-words')}
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 p-6 cursor-pointer hover:shadow-lg hover:border-amber-300 dark:border-amber-900/40 dark:from-amber-950/30 dark:to-yellow-950/20 dark:hover:border-amber-700/60 dark:hover:shadow-amber-900/20 animate-card-enter glow-border-subtle transition-all duration-150 active:scale-[0.98]"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-amber-500 opacity-80" />
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-amber-900 dark:text-amber-200">收藏词本</h3>
                  <p className="text-sm text-amber-600/80 dark:text-amber-400/70">你收藏的词汇</p>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <div className="inline-flex items-center rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                收藏
              </div>
              <p className="mt-2 text-sm text-amber-600/70 dark:text-amber-400/60">
                {favoriteWordCount > 0
                  ? `已收藏 ${favoriteWordCount} 个词汇`
                  : '练习中收藏感兴趣的单词'}
              </p>
            </div>
          </div>}
          {filteredDictionaries.map((dict, index) => {
            const colors = tagColors[dict.color] || tagColors['warm-coral'];
            return (
              <div
                key={dict.id}
                onClick={() => saveScrollAndNavigate(`/dict/${dict.id}`)}
                onMouseEnter={() => {
                  // 预加载词库数据
                  loadDictionary(dict.id).catch(() => {});
                  // 预加载章节选择页 chunk
                  import('./ChapterSelect');
                }}
                className="group card card-hover p-6 cursor-pointer relative overflow-hidden animate-card-enter glow-border-subtle active:scale-[0.98] transition-transform duration-150"
                style={{ animationDelay: `${(index + 2) * 0.05}s` }}
              >
                <div className={`absolute top-0 left-0 w-full h-1 ${getCategoryColor(dict.name)} opacity-80`} />
                <button
                  onClick={(e) => { e.stopPropagation(); toggleFavorite(dict.id) }}
                  aria-label={isFavorite(dict.id) ? '取消收藏' : '收藏词库'}
                  className={`absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full transition-colors cursor-pointer ${
                    isFavorite(dict.id)
                      ? 'bg-amber-100 text-amber-500 dark:bg-amber-500/15 dark:text-amber-400'
                      : 'bg-transparent text-gray-300 hover:text-amber-500 hover:bg-amber-50 dark:text-gray-600 dark:hover:text-amber-400 dark:hover:bg-amber-500/10'
                  }`}
                >
                  <svg className="w-4 h-4" fill={isFavorite(dict.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </button>
                <div className="flex items-start justify-between mb-3">
                  <h2 className="text-title text-content dark:text-gray-100 group-hover:text-primary transition-colors pr-10">{dict.name}</h2>
                </div>
                <p className="text-body text-content-tertiary dark:text-gray-400 mb-4 leading-relaxed">{dict.description}</p>
                <div className="flex items-center justify-between">
                  <span className={`${colors.bg} ${colors.text} px-2.5 py-1 rounded-lg text-xs font-medium`}>
                    {dict.category}
                  </span>
                  <span className="text-xs text-content-tertiary dark:text-gray-500 font-medium">
                    {dict.totalChapters} 章 · {dict.totalWords} 词
                  </span>
                </div>
              </div>
            );
          })}
          </>)})()}
        </div>
      </div>
      </div>
    </>
  )
}

export default Home
