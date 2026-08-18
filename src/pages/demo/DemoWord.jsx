import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { dictionaryMeta } from '../../dictionaries/meta.js'
import { getErrorBookCount } from '../../utils/errorBook.js'
import ErrorBookCard from '../../components/ErrorBookCard'
import { loadDictionary } from '../../utils/loadDictionary.js'

const tagColors = {
  'warm-coral': {
    text: 'text-indigo-600 dark:text-indigo-400',
    bg: 'bg-indigo-50 dark:bg-indigo-500/10',
    top: 'bg-indigo-500',
  },
}

const juniorDict = dictionaryMeta.find((d) => d.id === 'junior')

export default function DemoWord() {
  const navigate = useNavigate()
  const errorBookCount = useMemo(() => getErrorBookCount(), [])

  return (
    <div className="min-h-screen bg-background dark:bg-transparent p-6 transition-colors duration-500 animate-page-fade-in">
      <div className="max-w-6xl mx-auto px-6">
        <div className="mt-8 md:mt-12 mb-8">
          <div className="text-left">
            <h1 className="text-display gradient-text mb-4 tracking-tight text-glow-primary animate-pulse-soft">
              选择词库开始练习
            </h1>
            <p className="text-content-tertiary text-body max-w-md">
              体验版提供初中英语词汇和错题本功能
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* 初中英语词汇卡片 */}
          {juniorDict && (
            <div
              onClick={() => navigate(`/dict/${juniorDict.id}`)}
              onMouseEnter={() => {
                loadDictionary(juniorDict.id).catch(() => {})
                import('../ChapterSelect')
              }}
              className="group card card-hover p-6 cursor-pointer relative overflow-hidden animate-card-enter glow-border-subtle active:scale-[0.98] transition-transform duration-150"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-green-500 opacity-80 dark:hidden" />
              <div className="flex items-start justify-between mb-3">
                <h2 className="text-title text-content dark:text-gray-100 group-hover:text-primary transition-colors pr-10">
                  {juniorDict.name}
                </h2>
              </div>
              <p className="text-body text-content-tertiary dark:text-gray-400 mb-4 leading-relaxed">
                {juniorDict.description}
              </p>
              <div className="flex items-center justify-between">
                <span className="bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400 px-2.5 py-1 rounded-lg text-xs font-medium">
                  {juniorDict.category}
                </span>
                <span className="text-xs text-content-tertiary dark:text-gray-500 font-medium">
                  {juniorDict.totalChapters} 章 · {juniorDict.totalWords} 词
                </span>
              </div>
            </div>
          )}

          {/* 错题本卡片 */}
          <ErrorBookCard
            count={errorBookCount}
            onClick={() => navigate('/review/setup/error-book')}
          />
        </div>
      </div>
    </div>
  )
}
