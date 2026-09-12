import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ArticleCard from '../../modules/reading/components/ArticleCard'

export default function DemoReading() {
  const navigate = useNavigate()

  // 沙箱只展示这一篇 2026 文章：动态 import 其所在的数据分片（~60KB），
  // 不再静态引入 ~424KB 的全量 mockArticles 聚合库（那会把整库打进 Demo 首屏 chunk）
  const [demoArticle, setDemoArticle] = useState(null)

  useEffect(() => {
    let cancelled = false
    import('../../modules/reading/data/mockArticles6')
      .then((m) => {
        if (cancelled) return
        setDemoArticle((m.articles2026 || []).find((a) => a.id === 'article2026_01') || null)
      })
      .catch(() => {
        if (!cancelled) setDemoArticle(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleClick = (id) => {
    navigate(`/reading/${id}`)
  }

  return (
    <div className="bg-background dark:bg-transparent p-4 md:p-6 transition-colors duration-500 animate-page-fade-in">
      <div className="max-w-6xl mx-auto px-2 md:px-6 w-full">
        <div className="mt-10 md:mt-16 mb-8 md:mb-10">
          <div className="text-left">
            <h1 className="text-display gradient-text mb-3 tracking-tight text-glow-primary">
              阅读
            </h1>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pb-28">
          {demoArticle && (
            <ArticleCard
              article={demoArticle}
              readPercent={0}
              isBookmarked={false}
              onClick={handleClick}
              onToggleBookmark={() => {}}
            />
          )}
        </div>
      </div>
    </div>
  )
}
