import { useRef } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import CorpusList from './pages/CorpusList'
import CorpusPlayer from './pages/CorpusPlayer'
import { TRIAL_EPISODE_COUNT } from './data/mockCorpusVideos'
import { useAuth } from '../../contexts/AuthContext'

// 体验用户禁止进入完整列表 → 重定向到体验沙箱（仅显示 1–5 期）
function TrialListGuard({ children }) {
  const { user } = useAuth()
  if (user?.isTrial) return <Navigate to="/demo/corpus" replace />
  return children
}

// 体验用户只能播放第 1–5 期；超出上限（含直链/历史/期号跳转）重定向到体验沙箱
function TrialPlayerGuard() {
  const { user } = useAuth()
  const { id } = useParams()
  if (user?.isTrial && Number(id) > TRIAL_EPISODE_COUNT) {
    return <Navigate to="/demo/corpus" replace />
  }
  return <CorpusPlayer />
}

export default function CorpusModule() {
  const scrollRef = useRef(0)
  return (
    <Routes>
      <Route index element={<TrialListGuard><CorpusList scrollRef={scrollRef} /></TrialListGuard>} />
      <Route path=":id" element={<TrialPlayerGuard />} />
    </Routes>
  )
}
