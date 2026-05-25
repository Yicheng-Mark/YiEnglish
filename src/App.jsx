import { Suspense, lazy } from 'react'
import { useScrollingFlag } from './hooks/useScrollingFlag'
import { Routes, Route, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import Layout from './components/Layout'
import PageLoading from './components/PageLoading'
import AICircleFloat from './components/AIAssistant/AICircleFloat'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { WordProvider } from './contexts/WordContext'

const Home = lazy(() => import('./pages/Home'))
const ChapterSelect = lazy(() => import('./pages/ChapterSelect'))
const Typing = lazy(() => import('./pages/Typing'))
const Stats = lazy(() => import('./pages/Stats'))
const ReadingModule = lazy(() => import('./modules/reading'))
const CorpusModule = lazy(() => import('./modules/corpus'))
const PersonalCenter = lazy(() => import('./pages/PersonalCenter'))
const LearningMethodsModule = lazy(() => import('./modules/learning-methods'))
const AIChatPage = lazy(() => import('./pages/AIChatPage'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))

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

function App() {
  useScrollingFlag()
  const location = useLocation()
  const hideAI = AUTH_ENABLED && ['/login', '/register'].includes(location.pathname)

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
          {AUTH_ENABLED && <Route path="/register" element={<Register />} />}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/word" replace />} />
              <Route path="/word" element={<Home />} />
              <Route path="/read/*" element={<ReadingModule />} />
              <Route path="/reading/*" element={<ReadingModule />} />
              <Route path="/listening/*" element={<CorpusModule />} />
              <Route path="/profile" element={<PersonalCenter />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/learning-methods/*" element={<LearningMethodsModule />} />
              <Route path="/dict/:dictId" element={<ChapterSelect />} />
              <Route path="/typing/:dictId/:chapterId" element={<Typing />} />
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
