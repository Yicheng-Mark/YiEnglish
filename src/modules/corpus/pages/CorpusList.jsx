import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bookmark, BookOpen, Hash, Search, Video } from 'lucide-react'
import {
  mockCorpusVideos,
  categories,
  totalCount,
} from '../data/mockCorpusVideos'
import { DIFFICULTY_LABELS, getDifficultyLabel } from '../utils/difficulty'
import { useCorpusStore } from '../hooks/useCorpusStore'
import useCorpusLayout from '../hooks/useCorpusLayout'
import { getCorpusWordBookCount } from '../../../utils/corpusWordBook.js'
import VideoCard from '../components/VideoCard'
import Dropdown from '../../../components/Dropdown'
import { VirtualGrid } from '../../../components/virtual/VirtualGrid'

export default function CorpusList({ scrollRef }) {
  const navigate = useNavigate()
  const store = useCorpusStore()
  const isMobile = useCorpusLayout()
  const gridRef = useRef(null)
  const isRestoring = useRef(scrollRef?.current > 0)

  const [categoryFilter, setCategoryFilter] = useState('全部')
  const [difficultyFilter, setDifficultyFilter] = useState('全部')
  const [searchQuery, setSearchQuery] = useState('')
  const deferredQuery = useDeferredValue(searchQuery)
  const [bookmarkOnly, setBookmarkOnly] = useState(false)
  const [episodeNum, setEpisodeNum] = useState('')
  const [corpusWordCount, setCorpusWordCount] = useState(0)

  useEffect(() => {
    const top = scrollRef.current
    if (top <= 0) return

    const timer = setTimeout(() => {
      scrollRef.current = 0
      window.scrollTo({ top, behavior: 'instant' })
    }, 100)

    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    setCorpusWordCount(getCorpusWordBookCount())
  }, [])

  const bookmarkSet = useMemo(
    () => new Set(store.bookmarks),
    [store.bookmarks]
  )

  const difficultyOptions = useMemo(() => ['全部', ...DIFFICULTY_LABELS], [])

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    return mockCorpusVideos.filter((v) => {
      if (categoryFilter !== '全部' && v.category !== categoryFilter) return false
      if (difficultyFilter !== '全部' && getDifficultyLabel(v.sentenceCount) !== difficultyFilter) return false
      if (bookmarkOnly && !bookmarkSet.has(v.id)) return false
      if (q) {
        const hay = (
          (v.title || '') +
          ' ' +
          (v.subtitle || '') +
          ' ' +
          (v.description || '') +
          ' ' +
          (v.speaker || '') +
          ' ' +
          (v.tags || []).join(' ')
        ).toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [categoryFilter, difficultyFilter, bookmarkOnly, deferredQuery, bookmarkSet])

  const handleVideoClick = useCallback(
    (id) => {
      scrollRef.current = window.scrollY
      navigate(`/listening/${id}`)
    },
    [navigate]
  )

  const handleToggleBookmark = useCallback(
    (id) => {
      store.toggleBookmark(id)
    },
    [store]
  )

  const handleCategoryChange = useCallback((value) => {
    setCategoryFilter(value)
  }, [])

  const handleDifficultyChange = useCallback((value) => {
    setDifficultyFilter(value)
  }, [])

  const handleBookmarkOnlyToggle = useCallback(() => {
    setBookmarkOnly((v) => !v)
  }, [])

  const handleSearchChange = useCallback((e) => {
    setSearchQuery(e.target.value)
  }, [])

  const handleEpisodeJump = useCallback(() => {
    const num = parseInt(episodeNum, 10)
    if (!num || num < 1) return
    const idx = filtered.findIndex((v) => v.id === String(num))
    if (!gridRef.current) return
    if (idx >= 0) {
      gridRef.current.scrollToIndex(idx, { behavior: 'smooth' })
    } else {
      gridRef.current.scrollToIndex(filtered.length - 1, { behavior: 'smooth' })
    }
  }, [episodeNum, filtered])

  const handleNavigateWordBook = useCallback(() => {
    navigate('/dict/corpus-word-book')
  }, [navigate])

  const renderVideo = useCallback(
    (video) => (
      <VideoCard
        video={video}
        isBookmarked={bookmarkSet.has(video.id)}
        onClick={handleVideoClick}
        onToggleBookmark={handleToggleBookmark}
      />
    ),
    [bookmarkSet, handleVideoClick, handleToggleBookmark]
  )

  return (
    <div className={`bg-background dark:bg-transparent ${isMobile ? 'p-4' : 'p-6'} transition-colors duration-500 ${isRestoring.current ? '' : 'animate-page-fade-in'}`}>
      <div className={`max-w-6xl mx-auto ${isMobile ? 'px-2' : 'px-6'} w-full`}>
        <div>
          <div className={`${isMobile ? 'mt-6' : 'mt-16'} ${isMobile ? 'mb-6' : 'mb-10'}`}>
            <div className={`flex ${isMobile ? 'flex-col' : 'flex-row items-end justify-between'} gap-6`}>
              <div className="text-left">
                <h1 className="text-display gradient-text mb-3 tracking-tight text-glow-primary">
                  语料
                </h1>
                <p className={`text-content-tertiary text-body max-w-xl leading-relaxed ${isMobile ? 'line-clamp-2' : 'line-clamp-none'}`}>
                  精选演讲与短视频，逐句字幕跟读、单句循环、变速练习,在真实语境中磨炼听说能力。
                </p>
                <div className="mt-3 flex items-center gap-3 text-sm text-content-tertiary dark:text-gray-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    共 {totalCount} 期
                  </span>
                  <span className="text-gray-300 dark:text-gray-700">|</span>
                  <span className="inline-flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5" />
                    视频 + 双语字幕
                  </span>
                </div>
              </div>

              {/* 筛选栏 */}
              <div className={`${isMobile ? 'grid grid-cols-2' : 'flex flex-wrap'} items-center ${isMobile ? 'gap-2' : 'gap-3'}`}>
                <button
                  onClick={handleNavigateWordBook}
                  className={`flex items-center justify-center ${isMobile ? 'w-full' : 'w-auto'} gap-2 px-4 py-2 glass-card rounded-button text-sm font-medium text-content-secondary dark:text-gray-300 hover:border-primary/40 transition-colors cursor-pointer`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span>语料词本</span>
                  {corpusWordCount > 0 && (
                    <span className="ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-500/20 px-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300">
                      {corpusWordCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={handleBookmarkOnlyToggle}
                  className={`flex items-center justify-center ${isMobile ? 'w-full' : 'w-auto'} gap-2 px-4 py-2 rounded-button text-sm font-medium transition-colors cursor-pointer ${
                    bookmarkOnly
                      ? 'bg-primary text-white shadow-sm'
                      : 'glass-card text-content-secondary dark:text-gray-300 hover:border-primary/40'
                  }`}
                  aria-pressed={bookmarkOnly}
                >
                  <Bookmark
                    className="w-4 h-4"
                    fill={bookmarkOnly ? 'currentColor' : 'none'}
                    strokeWidth={2}
                  />
                  <span>{bookmarkOnly ? '已收藏' : '只看收藏'}</span>
                </button>
                <Dropdown
                  label="全部难度"
                  value={difficultyFilter}
                  options={difficultyOptions}
                  onChange={handleDifficultyChange}
                  className={isMobile ? "" : "w-auto"}
                />
                <Dropdown
                  label="全部分类"
                  value={categoryFilter}
                  options={categories}
                  onChange={handleCategoryChange}
                  className={isMobile ? "" : "w-auto"}
                />
              </div>
            </div>
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-tertiary dark:text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="搜索标题、主讲人或标签..."
                className="w-full pl-10 pr-4 py-2.5 bg-surface border border-gray-200 dark:border-white/[0.08] rounded-button text-sm text-content placeholder-gray-400 focus:outline-none focus:border-primary/50 transition-all"
              />
            </div>
            <div className="relative w-full md:w-auto">
              <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-content-tertiary dark:text-gray-500" />
              <input
                type="number"
                min="1"
                value={episodeNum}
                onChange={(e) => setEpisodeNum(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleEpisodeJump()}
                placeholder="请输入要跳转的期号"
                className="w-full md:w-44 pl-8 pr-2 py-2.5 bg-surface border border-gray-200 dark:border-white/[0.08] rounded-button text-sm text-content placeholder-gray-400 focus:outline-none focus:border-primary/50 transition-all text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>
        </div>

        {filtered.length > 0 ? (
          <div className="pb-28">
            <VirtualGrid
              ref={gridRef}
              items={filtered}
              estimateRowSize={500}
              overscan={3}
              gapClass="gap-5"
              renderItem={renderVideo}
            />
          </div>
        ) : (
          <div className="glass-card rounded-card p-12 text-center">
            <p className="text-content-secondary dark:text-gray-300 mb-2">没有匹配的视频</p>
            <p className="text-sm text-content-tertiary dark:text-gray-500">
              试试调整筛选条件，或清除收藏过滤
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
