import { useNavigate } from 'react-router-dom'
import { mockArticles } from '../../modules/reading/data/mockArticles'
import ArticleCard from '../../modules/reading/components/ArticleCard'

const demoArticle = mockArticles.find(a => a.id === 'article2026_01')

export default function DemoReading() {
  const navigate = useNavigate()

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
            <p className="text-content-tertiary text-body max-w-xl leading-relaxed">
              精选英语文章，让每一次阅读都成为沉浸式的语言旅行。
            </p>
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
