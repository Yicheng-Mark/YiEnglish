import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Bookmark, ChevronDown, FileText, MapPin } from 'lucide-react'
import { getArticleById } from '../data/mockArticles'
import { useReadingStore } from '../hooks/useReadingStore'
import useStudyTracker from '../hooks/useStudyTracker'
import { loadDictionary } from '../../../utils/loadDictionary.js'
import {
  addToReadingWordBook,
  isInReadingWordBook,
  removeFromReadingWordBook,
  findWordInMap,
} from '../../../utils/readingWordBook.js'
import {
  tokenizeText,
} from '../../../utils/wordTokenize.jsx'
import WordPopup from '../../../components/WordPopup.jsx'

const CATEGORY_TAG = {
  健康: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300',
  教育: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300',
  文化: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300',
  生活: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  科技: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-300',
  社会: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300',
  环境: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
  经济: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300',
}

const renderParagraph = (text, paraIndex, onWordClick) => {
  if (!text || typeof text !== 'string') {
    console.warn(`[Reading] Paragraph ${paraIndex} is not string:`, text)
    return <p className="article-paragraph" key={paraIndex}>{text}</p>
  }

  let decoded = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

  const elements = []
  const tagRegex = /<(strong|em|b|i|u)>([\s\S]*?)<\/\1>/g
  let match
  let lastIndex = 0

  while ((match = tagRegex.exec(decoded)) !== null) {
    const [fullMatch, tag, content] = match
    const index = match.index

    if (index > lastIndex) {
      elements.push(...tokenizeText(decoded.slice(lastIndex, index), paraIndex, onWordClick, `out-${index}`))
    }

    const innerElements = tokenizeText(content, paraIndex, onWordClick, `${tag}-${index}`)
    const Tag = tag
    elements.push(<Tag key={`${paraIndex}-tag-${index}`}>{innerElements}</Tag>)

    lastIndex = index + fullMatch.length
  }

  if (lastIndex < decoded.length) {
    elements.push(...tokenizeText(decoded.slice(lastIndex), paraIndex, onWordClick, `tail-${lastIndex}`))
  }

  return (
    <p className="article-paragraph text-[17px] md:text-lg leading-[1.85] text-content dark:text-gray-200" key={paraIndex}>
      {elements}
    </p>
  )
}

function ParagraphBlock({
  en,
  zh,
  index,
  onWordClick,
}) {
  const [showTrans, setShowTrans] = useState(false)

  return (
    <div
      id={`para-${index}`}
      className="group mb-4 rounded-2xl p-5 md:p-6 transition-colors bg-[#e8e6e1] dark:bg-white/[0.05]"
    >
      <div className="flex-1 min-w-0">
        {renderParagraph(en, index, onWordClick)}

        {/* 翻译切换 */}
        <div className="mt-3">
          <button
            onClick={() => setShowTrans((s) => !s)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-content-tertiary dark:text-gray-500 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${showTrans ? 'rotate-180' : ''}`}
            />
            <span>{showTrans ? '隐藏翻译' : '显示翻译'}</span>
          </button>
        </div>

        {/* 中文翻译（可折叠） */}
        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-out ${showTrans ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
        >
          <div className="overflow-hidden">
            <div className="mt-3 border-l-2 border-primary/30 dark:border-primary/40">
              <p className="text-[15px] md:text-base leading-[1.8] text-content-secondary dark:text-gray-400 pl-4">
                {zh}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ArticleDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const store = useReadingStore()
  const article = useMemo(() => getArticleById(id), [id])
  const contentRef = useRef(null)
  const persistTimer = useRef(null)

  const [progress, setProgress] = useState(() => store.getProgress(id))

  // Word lookup states
  const [wordMap, setWordMap] = useState(new Map())
  const [popup, setPopup] = useState(null)
  const activeTokenRef = useRef(null)

  useStudyTracker(article ? id : null)

  // Load all dictionaries for word lookup
  useEffect(() => {
    let cancelled = false
    const loadAll = async () => {
      const dictIds = [
        'junior', 'zhongkao', 'senior', 'gaokao',
        'cet4', 'cet4freq', 'cet6', 'cet6freq',
        'tem4', 'tem8', 'ielts', 'toefl', 'sat',
        'postgraduate', 'programmer',
      ]
      const results = await Promise.all(
        dictIds.map((id) => loadDictionary(id).catch(() => null))
      )
      if (cancelled) return
      const map = new Map()
      results.forEach((dict) => {
        if (!dict?.chapters) return
        dict.chapters.forEach((ch) => {
          if (!ch?.words) return
          ch.words.forEach((w) => {
            if (w?.name) {
              map.set(w.name.toLowerCase(), w)
            }
          })
        })
      })
      setWordMap(map)
    }
    loadAll()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!article) return
    const initial = store.getProgress(id)
    setProgress(initial)
    window.scrollTo({ top: 0 })
    if (!store.lastReadAt[id]) {
      store.setProgress(id, Math.max(initial, 1))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (!article) return
    function updateProgress() {
      const el = contentRef.current
      if (!el) return
      const docEl = document.documentElement
      const scrollTop = window.scrollY || docEl.scrollTop || 0
      const elTop = el.offsetTop
      const elHeight = el.offsetHeight
      const viewport = window.innerHeight || docEl.clientHeight || 0
      const readEnd = scrollTop + viewport
      const articleEnd = elTop + elHeight
      const articleStart = elTop
      let pct = ((readEnd - articleStart) / (articleEnd - articleStart)) * 100
      if (!Number.isFinite(pct)) pct = 0
      pct = Math.max(0, Math.min(100, Math.round(pct)))
      setProgress(pct)
      if (persistTimer.current) clearTimeout(persistTimer.current)
      persistTimer.current = setTimeout(() => {
        store.setProgress(id, pct)
      }, 400)
    }
    updateProgress()
    window.addEventListener('scroll', updateProgress, { passive: true })
    window.addEventListener('resize', updateProgress)
    return () => {
      window.removeEventListener('scroll', updateProgress)
      window.removeEventListener('resize', updateProgress)
      if (persistTimer.current) clearTimeout(persistTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, article])

  // 单词点击：直接弹出查词面板
  function handleWordClick(word, rect, tokenEl) {
    console.log('[Reading] Word clicked:', word, tokenEl)
    if (!word) return
    const cleanWord = word.toLowerCase().trim().replace(/[^a-z'-]/g, '')
    if (!cleanWord) return

    if (activeTokenRef.current) {
      activeTokenRef.current.classList.remove('word-token-active')
    }
    if (tokenEl) {
      tokenEl.classList.add('word-token-active')
      activeTokenRef.current = tokenEl
    }

    const wordData = findWordInMap(cleanWord, wordMap) || {
      name: cleanWord,
      usphone: '',
      ukphone: '',
      trans: [],
    }
    setPopup({
      wordData,
      rect,
      isSaved: isInReadingWordBook(wordData.name),
    })
  }

  function handleSaveWord() {
    if (!popup?.wordData) return
    addToReadingWordBook({
      ...popup.wordData,
      sourceArticleId: id,
    })
    setPopup((prev) => (prev ? { ...prev, isSaved: true } : null))
  }

  function handleRemoveWord() {
    if (!popup?.wordData) return
    removeFromReadingWordBook(popup.wordData.name)
    setPopup((prev) => (prev ? { ...prev, isSaved: false } : null))
  }

  function handleClosePopup() {
    if (activeTokenRef.current) {
      activeTokenRef.current.classList.remove('word-token-active')
      activeTokenRef.current = null
    }
    setPopup(null)
  }

  if (!article) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <p className="text-content-secondary dark:text-gray-300 mb-4">没有找到这篇文章</p>
        <button onClick={() => navigate('/reading')} className="btn-secondary">
          返回列表
        </button>
      </div>
    )
  }

  const tagClass =
    CATEGORY_TAG[article.category] ||
    'bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-300'
  const isBookmarked = store.isBookmarked(article.id)

  return (
    <div className="min-h-screen bg-background dark:bg-transparent transition-colors duration-500 animate-page-fade-in">
      {/* 顶部返回栏 */}
      <div className="sticky top-12 md:top-16 z-40 glass-card border-b border-gray-200/70 dark:border-white/[0.06] backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-4 md:px-6 h-12 flex items-center justify-between gap-3">
          <button
            onClick={() => navigate('/reading')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-content-secondary dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>返回列表</span>
          </button>
          <div className="flex-1 min-w-0 text-center">
            <p className="text-sm font-medium text-content dark:text-gray-200 truncate px-3">
              {article.enTitle || article.title}
            </p>
          </div>
          <button
            onClick={() => store.toggleBookmark(article.id)}
            aria-label={isBookmarked ? '取消收藏' : '收藏文章'}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-150 active:scale-90 ${
              isBookmarked
                ? 'text-amber-500 bg-amber-50 dark:bg-amber-500/15'
                : 'text-content-tertiary dark:text-gray-400 hover:text-amber-500 hover:bg-amber-50/60 dark:hover:bg-amber-500/10'
            }`}
          >
            <Bookmark className="w-4 h-4" fill={isBookmarked ? 'currentColor' : 'none'} strokeWidth={2} />
          </button>
        </div>
        {/* 顶部进度条 */}
        <div
          className="h-0.5 w-full bg-gray-100 dark:bg-white/[0.05] overflow-hidden cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
            const el = contentRef.current
            if (!el) return
            const elTop = el.offsetTop
            const elHeight = el.offsetHeight
            const targetScroll = elTop + ratio * elHeight - window.innerHeight / 2
            window.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' })
          }}
        >
          <div className="h-full bg-primary transition-[width] duration-150" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* 阅读区 */}
      <article ref={contentRef} className="article-content max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12">
        {/* 分类标签 */}
        <div className="mb-4">
          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${tagClass}`}>
            {article.category}
          </span>
        </div>

        {/* 标题 */}
        <div className="mb-5">
          <h1 className="text-3xl md:text-4xl font-bold leading-tight text-content dark:text-gray-100">
            {article.enTitle || article.title}
          </h1>
          {article.cnTitle && (
            <p className="text-lg text-content-tertiary dark:text-gray-400 mt-1">
              {article.cnTitle}
            </p>
          )}
        </div>

        {/* 元信息 */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-content-tertiary dark:text-gray-500 mb-8">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span>{article.year} 年</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            <span>{article.region}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            <span>{article.wordCount} 词</span>
          </div>
        </div>

        {/* 中文摘要 */}
        <div className="mb-6 p-4 md:p-5 rounded-xl bg-gray-50 dark:bg-white/[0.03] border-l-4 border-primary/60">
          <p className="text-sm md:text-[15px] text-content-secondary dark:text-gray-300 leading-relaxed">
            {article.description}
          </p>
        </div>

        {/* 正文段落 */}
        <div>
          {article.paragraphs.map((para, i) => (
            <ParagraphBlock
              key={i}
              index={i}
              en={para.en}
              zh={para.zh}
              onWordClick={handleWordClick}
            />
          ))}
        </div>
      </article>

      {/* 底部空间 */}
      <div className="h-28" />

      {/* 单词弹窗 */}
      {popup && (
        <WordPopup
          wordData={popup.wordData}
          rect={popup.rect}
          isSaved={popup.isSaved}
          onSave={handleSaveWord}
          onRemove={handleRemoveWord}
          onClose={handleClosePopup}
          wordBookLabel="阅读词本"
        />
      )}
    </div>
  )
}
