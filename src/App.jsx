import { Suspense, lazy, useState, useEffect } from 'react'
import { useScrollingFlag } from './hooks/useScrollingFlag'
import { Routes, Route, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import Layout from './components/Layout'
import PageLoading from './components/PageLoading'
import AICircleFloat from './components/AIAssistant/AICircleFloat'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { WordProvider } from './contexts/WordContext'
import { isAIAssistantHidden } from './lib/ai-settings'
import { migrateFromLocalStorage } from './utils/idb.js'

const Home = lazy(() => import('./pages/Home'))
const WordBooks = lazy(() => import('./pages/WordBooks'))
const ChapterSelect = lazy(() => import('./pages/ChapterSelect'))
const Typing = lazy(() => import('./pages/Typing'))
const Stats = lazy(() => import('./pages/Stats'))
const ReadingModule = lazy(() => import('./modules/reading'))
const CorpusModule = lazy(() => import('./modules/corpus'))
const PersonalCenter = lazy(() => import('./pages/PersonalCenter'))
const LearningMethodsModule = lazy(() => import('./modules/learning-methods'))
const AIChatPage = lazy(() => import('./pages/AIChatPage'))
const ReviewSetup = lazy(() => import('./pages/ReviewSetup'))
const ReviewQuiz = lazy(() => import('./pages/ReviewQuiz'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const Demo = lazy(() => import('./pages/Demo'))
const Activate = lazy(() => import('./pages/Activate'))
const DemoLayout = lazy(() => import('./pages/demo/DemoLayout'))
const DemoWord = lazy(() => import('./pages/demo/DemoWord'))
const DemoReading = lazy(() => import('./pages/demo/DemoReading'))
const DemoCorpus = lazy(() => import('./pages/demo/DemoCorpus'))
const DemoProfile = lazy(() => import('./pages/demo/DemoProfile'))

// 预加载底部导航对应的模块 chunk，避免切换时闪"加载中"
const moduleLoaders = [
  () => import('./pages/Home'),
  () => import('./modules/reading'),
  () => import('./modules/corpus'),
  () => import('./pages/PersonalCenter'),
]
let preloaded = false
function preloadModules() {
  if (preloaded) return
  preloaded = true
  // 等主线程空闲后再预加载，不影响首屏
  requestIdleCallback
    ? requestIdleCallback(() => moduleLoaders.forEach(fn => fn()))
    : setTimeout(() => moduleLoaders.forEach(fn => fn()), 200)
}

function Navigator() {
  const navigate = useNavigate()
  const { setNavigator } = useAuth()
  setNavigator(navigate)
  return null
}

const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED !== 'false'

function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (!AUTH_ENABLED) return <Outlet />
  if (loading) return <PageLoading />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  return <Outlet />
}

function RegisterGuard() {
  const validatedCode = sessionStorage.getItem('validated_activation_code')
  if (!validatedCode) return <Navigate to="/activate" replace />
  return <Register />
}

function App() {
  useScrollingFlag()
  const location = useLocation()
  useEffect(preloadModules, [])
  useEffect(() => {
    // 空闲时执行 localStorage → IndexedDB 迁移
    if (requestIdleCallback) {
      requestIdleCallback(() => migrateFromLocalStorage().catch(console.warn))
    }
  }, [])
  const [aiHidden, setAiHidden] = useState(isAIAssistantHidden)
  const hideAI = (AUTH_ENABLED && ['/login', '/register', '/demo', '/activate'].includes(location.pathname)) || location.pathname.startsWith('/demo/') || location.pathname.startsWith('/activate/') || aiHidden

  useEffect(() => {
    const handler = () => setAiHidden(isAIAssistantHidden())
    window.addEventListener('ai-visibility-change', handler)
    return () => window.removeEventListener('ai-visibility-change', handler)
  }, [])

  return (
    <AuthProvider>
      <WordProvider>
      <Navigator />
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: 'var(--color-surface)',
            color: 'var(--color-content)',
            border: '1px solid rgba(0,0,0,0.1)',
          },
        }}
      />
      <Suspense fallback={<PageLoading />}>
        <Routes>
          {AUTH_ENABLED && <Route path="/login" element={<Login />} />}
          {AUTH_ENABLED && <Route path="/register" element={<RegisterGuard />} />}
          {AUTH_ENABLED && <Route path="/activate" element={<Activate />} />}
          {AUTH_ENABLED && <Route path="/activate/:code" element={<Activate />} />}
          {/* Demo 路由（体验码输入 + demo 应用） */}
          {AUTH_ENABLED && (
            <Route path="/demo">
              <Route index element={<Demo />} />
              <Route element={<DemoLayout />}>
                <Route path="home" element={<DemoWord />} />
                <Route path="reading" element={<DemoReading />} />
                <Route path="corpus" element={<DemoCorpus />} />
                <Route path="profile" element={<DemoProfile />} />
              </Route>
            </Route>
          )}
          <Route element={<ProtectedRoute />}>
            {/* 主应用路由 */}
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/word" replace />} />
              <Route path="/word" element={<Home />} />
              <Route path="/wordbooks" element={<WordBooks />} />
              <Route path="/read/*" element={<ReadingModule />} />
              <Route path="/reading/*" element={<ReadingModule />} />
              <Route path="/listening/*" element={<CorpusModule />} />
              <Route path="/profile" element={<PersonalCenter />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/learning-methods/*" element={<LearningMethodsModule />} />
              <Route path="/dict/:dictId" element={<ChapterSelect />} />
              <Route path="/typing/:dictId/:chapterId" element={<Typing />} />
              <Route path="/review/setup/:bookId" element={<ReviewSetup />} />
              <Route path="/review/quiz/:bookId" element={<ReviewQuiz />} />
              <Route path="/ai-assistant" element={<AIChatPage />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
      {!hideAI && <AICircleFloat />}
      </WordProvider>
    </AuthProvider>
  )
}

export default App
