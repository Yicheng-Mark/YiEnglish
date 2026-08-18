import { Routes, Route } from 'react-router-dom'
import GrammarHome from './pages/GrammarHome'
import PartsOfSpeech from './pages/PartsOfSpeech'
import Tenses from './pages/Tenses'
import SentenceAnalysis from './pages/SentenceAnalysis'
import useStudyTracker from '../reading/hooks/useStudyTracker'

export default function GrammarModule() {
  useStudyTracker('grammar')
  return (
    <Routes>
      <Route index element={<GrammarHome />} />
      <Route path="parts-of-speech" element={<PartsOfSpeech />} />
      <Route path="parts-of-speech/:id" element={<PartsOfSpeech />} />
      <Route path="tenses" element={<Tenses />} />
      <Route path="tenses/:id" element={<Tenses />} />
      <Route path="sentence-analysis" element={<SentenceAnalysis />} />
      <Route path="sentence-analysis/:id" element={<SentenceAnalysis />} />
    </Routes>
  )
}
