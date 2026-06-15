import { useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getVideoById } from '../data/mockCorpusVideos'
import { resolveVideoCover } from '../utils/videoCover'
import { CorpusPlayerProvider } from '../context/CorpusPlayerContext.jsx'
import useCorpusLayout from '../hooks/useCorpusLayout.js'
import MobileCorpusPlayer from '../components/mobile/MobileCorpusPlayer.jsx'
import DesktopCorpusPlayer from '../components/DesktopCorpusPlayer.jsx'
import { useAuth } from '../../../contexts/AuthContext'

export default function CorpusPlayer() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const video = getVideoById(id)
  const posterUrl = useMemo(() => resolveVideoCover(video), [video])
  const isMobile = useCorpusLayout()

  // 体验用户从沙箱点进来看视频，返回时应回到体验沙箱而非完整列表
  const backTo = user?.isTrial ? '/demo/corpus' : '/listening'

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [])

  if (!video) {
    return (
      <div className="min-h-screen bg-background dark:bg-transparent p-6 flex items-center justify-center">
        <div className="glass-card rounded-card p-12 text-center max-w-md">
          <p className="text-content-secondary dark:text-gray-300 mb-2">视频不存在</p>
          <p className="text-sm text-content-tertiary dark:text-gray-500 mb-4">
            ID: {id}
          </p>
          <button
            onClick={() => navigate(backTo)}
            className="px-4 py-2 rounded-button bg-primary text-white text-sm hover:opacity-90 transition-opacity"
          >
            返回语料
          </button>
        </div>
      </div>
    )
  }

  return (
    <CorpusPlayerProvider video={video}>
      {isMobile ? (
        <MobileCorpusPlayer video={video} posterUrl={posterUrl} onBack={() => navigate(backTo)} />
      ) : (
        <div className="corpus-tablet-wrapper">
          <DesktopCorpusPlayer video={video} posterUrl={posterUrl} onBack={() => navigate(backTo)} />
        </div>
      )}
    </CorpusPlayerProvider>
  )
}
