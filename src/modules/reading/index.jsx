import { lazy, useRef, Suspense } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import ArticleList from './pages/ArticleList'
import ArticleDetail from './pages/ArticleDetail'
import { useAuth } from '../../contexts/AuthContext'

const GrammarModule = lazy(() => import('../grammar'))

// 体验沙箱（DemoReading）向体验用户开放的文章白名单：仅 2026 试读一篇
const TRIAL_ARTICLE_IDS = ['article2026_01']

// 体验用户禁止进入完整文章列表 → 重定向到体验沙箱（仅展示试读文章），
// 与语料模块 TrialListGuard 同款；沙箱文章页的「返回列表」也因此回到沙箱
function TrialListGuard({ children }) {
  const { user } = useAuth()
  if (user?.isTrial) return <Navigate to="/demo/reading" replace />
  return children
}

// 体验用户只能读白名单文章；直链/其他 id（含从沙箱文章页猜跳的任意文章）重定向到沙箱
function TrialArticleGuard() {
  const { user } = useAuth()
  const { id } = useParams()
  if (user?.isTrial && !TRIAL_ARTICLE_IDS.includes(id)) {
    return <Navigate to="/demo/reading" replace />
  }
  return <ArticleDetail />
}

export default function ReadingModule() {
  const scrollRef = useRef(0)
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route
          index
          element={
            <TrialListGuard>
              <ArticleList scrollRef={scrollRef} />
            </TrialListGuard>
          }
        />
        <Route path="grammar/*" element={<GrammarModule />} />
        <Route path=":id" element={<TrialArticleGuard />} />
      </Routes>
    </Suspense>
  )
}
