import { Suspense, lazy } from 'react'
import { useScrollingFlag } from './hooks/useScrollingFlag'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import Layout from './components/Layout'
import PageLoading from './components/PageLoading'
import AICircleFloat from './components/AIAssistant/AICircleFloat'

const Home = lazy(() => import('./pages/Home'))
const ChapterSelect = lazy(() => import('./pages/ChapterSelect'))
const Typing = lazy(() => import('./pages/Typing'))
const Stats = lazy(() => import('./pages/Stats'))
const ReadingModule = lazy(() => import('./modules/reading'))
const CorpusModule = lazy(() => import('./modules/corpus'))
const TrainingCenter = lazy(() => import('./pages/TrainingCenter'))
const PersonalCenter = lazy(() => import('./pages/PersonalCenter'))
const LearningMethodsModule = lazy(() => import('./modules/learning-methods'))
const AIChatPage = lazy(() => import('./pages/AIChatPage'))

function App() {
  useScrollingFlag()

  return (
    <>
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
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/word" replace />} />
            <Route path="/word" element={<Home />} />
            <Route path="/read/*" element={<ReadingModule />} />
            <Route path="/reading/*" element={<ReadingModule />} />
            <Route path="/listening/*" element={<CorpusModule />} />
            <Route path="/training" element={<TrainingCenter />} />
            <Route path="/profile" element={<PersonalCenter />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/learning-methods/*" element={<LearningMethodsModule />} />
            <Route path="/dict/:dictId" element={<ChapterSelect />} />
            <Route path="/typing/:dictId/:chapterId" element={<Typing />} />
            <Route path="/ai-assistant" element={<AIChatPage />} />
          </Route>
        </Routes>
      </Suspense>
      <AICircleFloat />
    </>
  )
}

export default App
