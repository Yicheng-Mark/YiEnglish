import { useState, useEffect, Suspense, lazy } from 'react'
import { useScrollingFlag } from './hooks/useScrollingFlag'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import Layout from './components/Layout'
import PageLoading from './components/PageLoading'
import AICircleFloat from './components/AIAssistant/AICircleFloat'
import { AuthContext } from './contexts/AuthContext'
import { apiGetProfile, apiLogout } from './lib/auth'
import { apiFetch } from './lib/api'
import { syncFavoriteWordsFromServer } from './utils/favoriteWords'
import { syncErrorBookFromServer } from './utils/errorBook'
import { syncReadingWordBookFromServer } from './utils/readingWordBook'
import { syncCorpusWordBookFromServer } from './utils/corpusWordBook'
import { syncFavoriteDictsFromServer } from './utils/favoriteDicts'
import { syncReviewCardsFromServer } from './utils/reviewCards'
import { syncSettingsFromServer } from './hooks/useUserConfig'
import { syncProfileFromServer } from './hooks/useProfileStore'

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
const Login = lazy(() => import('./pages/Login'))

const MIGRATION_FLAG = 'lingoforge_data_migrated'

async function migrateLocalToServer() {
  try {
    const payload = {}

    const favWords = localStorage.getItem('lingoforge_favorite_words')
    if (favWords) {
      const parsed = JSON.parse(favWords)
      if (parsed.words?.length) payload.favoriteWords = parsed.words
    }

    const errorWords = localStorage.getItem('typingword_wrong')
    if (errorWords) {
      const parsed = JSON.parse(errorWords)
      if (parsed.words?.length) payload.errorBook = parsed.words
    }

    const readingWords = localStorage.getItem('lingoforge_reading_words')
    if (readingWords) {
      const parsed = JSON.parse(readingWords)
      if (parsed.words?.length) payload.readingWords = parsed.words
    }

    const corpusWords = localStorage.getItem('lingoforge_corpus_words')
    if (corpusWords) {
      const parsed = JSON.parse(corpusWords)
      if (parsed.words?.length) payload.corpusWords = parsed.words
    }

    const favDicts = localStorage.getItem('lf_favorite_dicts')
    if (favDicts) {
      const parsed = JSON.parse(favDicts)
      if (Array.isArray(parsed) && parsed.length) payload.favoriteDicts = parsed
    }

    const config = localStorage.getItem('typingword_config')
    if (config) payload.config = JSON.parse(config)

    const theme = localStorage.getItem('lingoforge-theme')
    if (theme) payload.theme = theme

    const hasData = Object.keys(payload).length > 0
    if (!hasData) {
      localStorage.setItem(MIGRATION_FLAG, 'true')
      return
    }

    await apiFetch('/api/migrate/local-to-server', {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    localStorage.setItem(MIGRATION_FLAG, 'true')
  } catch (e) {
    console.warn('Migration failed, will retry next login:', e)
  }
}

function App() {
  useScrollingFlag()
  const location = useLocation()

  const [user, setUser] = useState(null)
  const [authLoaded, setAuthLoaded] = useState(false)

  useEffect(() => {
    apiGetProfile().then(profile => {
      setUser(profile)
      setAuthLoaded(true)

      if (profile) {
        // One-time migration from localStorage to server
        if (!localStorage.getItem(MIGRATION_FLAG)) {
          migrateLocalToServer()
        }

        // Sync all data from server
        Promise.all([
          syncFavoriteWordsFromServer(),
          syncErrorBookFromServer(),
          syncReadingWordBookFromServer(),
          syncCorpusWordBookFromServer(),
          syncFavoriteDictsFromServer(),
          syncSettingsFromServer(),
          syncProfileFromServer(),
          syncReviewCardsFromServer(),
        ]).catch(err => console.warn('Data sync failed:', err))
      }
    }).catch(() => {
      setUser(null)
      setAuthLoaded(true)
    })
  }, [])

  const authValue = {
    user,
    setUser,
    isAuthenticated: !!user,
    logout: async () => {
      await apiLogout()
      setUser(null)
    },
  }

  return (
    <AuthContext.Provider value={authValue}>
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
          <Route path="/login" element={<Login />} />
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
      {authLoaded && location.pathname !== '/login' && <AICircleFloat />}
    </AuthContext.Provider>
  )
}

export default App
