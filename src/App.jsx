// AI 助手下线（DeepSeek key 无额度），恢复时取消注释各「AI 助手下线」标记处，
// 并把 useState 加回本行 react import
import { Suspense, useEffect } from 'react'
import { lazyRetry } from './utils/lazyRetry'
import { useScrollingFlag } from './hooks/useScrollingFlag'
import { Routes, Route, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import Layout from './components/Layout'
import PageLoading from './components/PageLoading'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { WordProvider } from './contexts/WordContext'
// AI 助手下线（DeepSeek key 无额度），恢复时取消注释本行
// import { isAIAssistantHidden } from './lib/ai-settings'
import { migrateFromLocalStorage } from './utils/idb.js'

const Home = lazyRetry(() => import('./pages/Home'))
const WordBooks = lazyRetry(() => import('./pages/WordBooks'))
const ChapterSelect = lazyRetry(() => import('./pages/ChapterSelect'))
const Typing = lazyRetry(() => import('./pages/Typing'))
const Stats = lazyRetry(() => import('./pages/Stats'))
const ReadingModule = lazyRetry(() => import('./modules/reading'))
const CorpusModule = lazyRetry(() => import('./modules/corpus'))
const PersonalCenter = lazyRetry(() => import('./pages/PersonalCenter'))
const Devices = lazyRetry(() => import('./pages/Devices'))
const LearningMethodsModule = lazyRetry(() => import('./modules/learning-methods'))
const ReviewSetup = lazyRetry(() => import('./pages/ReviewSetup'))
const ReviewQuiz = lazyRetry(() => import('./pages/ReviewQuiz'))
const Login = lazyRetry(() => import('./pages/Login'))
const Register = lazyRetry(() => import('./pages/Register'))
const Demo = lazyRetry(() => import('./pages/Demo'))
const Activate = lazyRetry(() => import('./pages/Activate'))
const Recover = lazyRetry(() => import('./pages/Recover'))
const DemoLayout = lazyRetry(() => import('./pages/demo/DemoLayout'))
const DemoWord = lazyRetry(() => import('./pages/demo/DemoWord'))
const DemoReading = lazyRetry(() => import('./pages/demo/DemoReading'))
const DemoCorpus = lazyRetry(() => import('./pages/demo/DemoCorpus'))
const DemoProfile = lazyRetry(() => import('./pages/demo/DemoProfile'))
// AI 助手下线：页面与悬浮球 chunk 不再加载，恢复时取消注释
// const AIChatPage = lazyRetry(() => import('./pages/AIChatPage'))
// const AICircleFloat = lazyRetry(() => import('./components/AIAssistant/AICircleFloat'))

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
  typeof requestIdleCallback === 'function'
    ? requestIdleCallback(() => moduleLoaders.forEach((fn) => fn()))
    : setTimeout(() => moduleLoaders.forEach((fn) => fn()), 200)
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

// 体验用户：重定向到体验沙箱，禁止进入主应用的词库列表页
function TrialGuard({ children }) {
  const { user } = useAuth()
  if (user?.isTrial) return <Navigate to="/demo/home" replace />
  return children
}

function RegisterGuard() {
  const validatedCode = sessionStorage.getItem('validated_activation_code')
  if (!validatedCode) return <Navigate to="/activate" replace />
  return <Register />
}

// AI 助手下线（DeepSeek key 无额度）：悬浮球全局入口整体停用，恢复时取消注释本组件、
// 顶部 isAIAssistantHidden / AICircleFloat 两处 import，以及路由表中 /ai-assistant 与下方 <AIAssistantGate />
// function AIAssistantGate() {
//   const { user } = useAuth()
//   const location = useLocation()
//   const [visible, setVisible] = useState(() => !isAIAssistantHidden())
//
//   useEffect(() => {
//     const onChange = () => setVisible(!isAIAssistantHidden())
//     window.addEventListener('ai-visibility-change', onChange)
//     return () => window.removeEventListener('ai-visibility-change', onChange)
//   }, [])
//
//   const p = location.pathname
//   const onAuthPage = ['/login', '/register', '/demo', '/activate', '/recover'].some(
//     (path) => p === path || p.startsWith(path + '/')
//   )
//   if (!visible || onAuthPage || user?.isTrial) return null
//
//   return (
//     <Suspense fallback={null}>
//       <AICircleFloat />
//     </Suspense>
//   )
// }

function App() {
  useScrollingFlag()
  useEffect(preloadModules, [])
  useEffect(() => {
    // 空闲时执行 localStorage → IndexedDB 迁移；
    // 不支持 requestIdleCallback 的浏览器（Safari）降级为 setTimeout，否则迁移永远不执行
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => migrateFromLocalStorage().catch(console.warn))
    } else {
      setTimeout(() => migrateFromLocalStorage().catch(console.warn), 2000)
    }
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
              border: '1px solid var(--color-border-strong, rgba(0,0,0,0.1))',
            },
          }}
        />
        <Suspense fallback={<PageLoading />}>
          <Routes>
            {AUTH_ENABLED && <Route path="/login" element={<Login />} />}
            {AUTH_ENABLED && <Route path="/register" element={<RegisterGuard />} />}
            {AUTH_ENABLED && <Route path="/activate" element={<Activate />} />}
            {AUTH_ENABLED && <Route path="/activate/:code" element={<Activate />} />}
            {AUTH_ENABLED && <Route path="/recover" element={<Recover />} />}
            {AUTH_ENABLED && <Route path="/recover/:code" element={<Recover />} />}
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
                <Route
                  path="/word"
                  element={
                    <TrialGuard>
                      <Home />
                    </TrialGuard>
                  }
                />
                <Route
                  path="/wordbooks"
                  element={
                    <TrialGuard>
                      <WordBooks />
                    </TrialGuard>
                  }
                />
                <Route path="/read/*" element={<ReadingModule />} />
                <Route path="/reading/*" element={<ReadingModule />} />
                <Route path="/listening/*" element={<CorpusModule />} />
                <Route path="/profile" element={<PersonalCenter />} />
                <Route path="/profile/devices" element={<Devices />} />
                <Route path="/stats" element={<Stats />} />
                <Route path="/learning-methods/*" element={<LearningMethodsModule />} />
                {/* AI 助手下线：/ai-assistant 路由停用，恢复时取消注释 */}
                {/* <Route path="/ai-assistant" element={<AIChatPage />} /> */}
                <Route path="/dict/:dictId" element={<ChapterSelect />} />
                <Route path="/typing/:dictId/:chapterId" element={<Typing />} />
                <Route path="/review/setup/:bookId" element={<ReviewSetup />} />
                <Route path="/review/quiz/:bookId" element={<ReviewQuiz />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
        {/* AI 助手下线：悬浮球入口停用，恢复时取消注释 */}
        {/* <AIAssistantGate /> */}
      </WordProvider>
    </AuthProvider>
  )
}

export default App
