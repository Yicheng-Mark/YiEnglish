import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { Bookmark, BookOpen, Search } from 'lucide-react'
import {
  mockArticles,
  categories,
  years,
} from '../data/mockArticles'
import { useReadingStore } from '../hooks/useReadingStore'
import { getReadingWordBookCount } from '../../../utils/readingWordBook.js'
import ArticleCard from '../components/ArticleCard'
import GrammarOverview from '../components/GrammarOverview'
import Dropdown from '../../../components/Dropdown'
import { VirtualGrid } from '../../../components/virtual/VirtualGrid'

export default function ArticleList({ scrollRef }) {
  const navigate = useNavigate()
  const store = useReadingStore()
  const gridRef = useRef(null)
  const isRestoring = useRef(scrollRef?.current > 0)

  const categoryFilter = store.filters.category
  const yearFilter = store.filters.year
  const searchQuery = store.filters.search
  const bookmarkOnly = store.filters.bookmarkOnly
  const deferredQuery = useDeferredValue(searchQuery)
  const [readingWordCount, setReadingWordCount] = useState(0)

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
    setReadingWordCount(getReadingWordBookCount())
  }, [])

  // bookmarks 数组转 Set，加速 has 查找并避免每次 filter/render 都遍历数组
  const bookmarkSet = useMemo(
    () => new Set(store.bookmarks),
    [store.bookmarks]
  )

  // 缓存 years.map(String)，避免每次渲染重建数组
  const yearOptions = useMemo(() => years.map(String), [])

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    const articles = mockArticles.filter((a) => {
      if (categoryFilter !== '全部' && a.category !== categoryFilter) return false
      if (yearFilter !== '全部' && String(a.year) !== yearFilter) return false
      if (bookmarkOnly && !bookmarkSet.has(a.id)) return false
      if (q) {
        const hay = (
          (a.enTitle || a.title || '') +
          ' ' +
          (a.cnTitle || '') +
          ' ' +
          (a.description || '')
        ).toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    if (categoryFilter === '全部' && yearFilter === '全部' && !bookmarkOnly && !q) {
      return [{ id: '__grammar__' }, ...articles]
    }
    return articles
  }, [categoryFilter, yearFilter, bookmarkOnly, deferredQuery, bookmarkSet])

  // 稳定的事件回调
  const handleArticleClick = useCallback(
    (id) => {
      scrollRef.current = window.scrollY
      navigate(`/reading/${id}`)
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
    store.setFilters({ category: value })
  }, [store])

  const handleYearChange = useCallback((value) => {
    store.setFilters({ year: value })
  }, [store])

  const handleBookmarkOnlyToggle = useCallback(() => {
    store.setFilters({ bookmarkOnly: !store.filters.bookmarkOnly })
  }, [store])

  const handleSearchChange = useCallback((e) => {
    store.setFilters({ search: e.target.value })
  }, [store])

  const handleNavigateWordBook = useCallback(() => {
    navigate('/dict/reading-word-book')
  }, [navigate])

  const renderArticle = useCallback(
    (article) => {
      if (article.id === '__grammar__') return <GrammarOverview />
      return (
        <ArticleCard
          article={article}
          readPercent={store.getProgress(article.id)}
          lastReadAt={store.getLastReadAt(article.id)}
          isBookmarked={bookmarkSet.has(article.id)}
          onClick={handleArticleClick}
          onToggleBookmark={handleToggleBookmark}
        />
      )
    },
    [store, bookmarkSet, handleArticleClick, handleToggleBookmark]
  )

  return (
    <div className={`bg-background dark:bg-transparent p-4 md:p-6 transition-colors duration-500 ${isRestoring.current ? '' : 'animate-page-fade-in'}`}>
      <div className="max-w-6xl mx-auto px-2 md:px-6 w-full">
        {/* 顶部标题区 */}
        <div>
          <div className="mt-10 md:mt-16 mb-8 md:mb-10">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
              <div className="text-left">
                <h1 className="text-display gradient-text mb-3 tracking-tight text-glow-primary">
                  阅读
                </h1>
                <p className="text-content-tertiary text-body max-w-xl leading-relaxed">
                  精选英语文章，让每一次阅读都成为沉浸式的语言旅行。
                </p>
              </div>

              {/* 筛选栏 */}
              <div className="grid grid-cols-2 md:flex md:flex-wrap items-center gap-2 md:gap-3">
                <button
                  onClick={handleNavigateWordBook}
                  className="flex items-center justify-center gap-2 w-full md:w-auto px-4 py-2 glass-card rounded-button text-sm font-medium text-content-secondary dark:text-gray-300 hover:border-primary/40 transition-colors cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>阅读词本</span>
                  {readingWordCount > 0 && (
                    <span className="ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-500/20 px-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300">
                      {readingWordCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={handleBookmarkOnlyToggle}
                  className={`flex items-center justify-center gap-2 w-full md:w-auto px-4 py-2 rounded-button text-sm font-medium transition-colors cursor-pointer ${
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
                  label="全部年份"
                  value={yearFilter}
                  options={yearOptions}
                  onChange={handleYearChange}
                />
                <Dropdown
                  label="全部分类"
                  value={categoryFilter}
                  options={categories}
                  onChange={handleCategoryChange}
                />
              </div>
            </div>
          </div>

          {/* 搜索框 */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-tertiary dark:text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="搜索标题或描述..."
                className="w-full pl-10 pr-4 py-2.5 bg-surface border border-gray-200 dark:border-white/[0.08] rounded-button text-sm text-content placeholder-gray-400 focus:outline-none focus:border-primary/50 transition-all"
              />
            </div>
          </div>
        </div>

        {/* 卡片网格 - 虚拟滚动 */}
        {filtered.length > 0 ? (
          <div className="pb-28">
            <VirtualGrid
              ref={gridRef}
              items={filtered}
              estimateRowSize={320}
              overscan={3}
              gapClass="gap-5"
              renderItem={renderArticle}
            />
          </div>
        ) : (
          <div className="glass-card rounded-card p-12 text-center">
            <p className="text-content-secondary dark:text-gray-300 mb-2">没有匹配的文章</p>
            <p className="text-sm text-content-tertiary dark:text-gray-500">
              试试调整筛选条件，或清除收藏过滤
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
