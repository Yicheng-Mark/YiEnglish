import { useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getVideoById } from '../data/mockCorpusVideos'
import { resolveVideoCover } from '../utils/videoCover'
import { CorpusPlayerProvider } from '../context/CorpusPlayerContext.jsx'
import useCorpusLayout from '../hooks/useCorpusLayout.js'
import MobileCorpusPlayer from '../components/mobile/MobileCorpusPlayer.jsx'
import DesktopCorpusPlayer from '../components/DesktopCorpusPlayer.jsx'

export default function CorpusPlayer() {
  const { id } = useParams()
  const navigate = useNavigate()
  const video = getVideoById(id)
  const posterUrl = useMemo(() => resolveVideoCover(video), [video])
  const isMobile = useCorpusLayout()

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
            onClick={() => navigate('/listening')}
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
        <MobileCorpusPlayer video={video} posterUrl={posterUrl} onBack={() => navigate('/listening')} />
      ) : (
        <div className="corpus-tablet-wrapper">
          <DesktopCorpusPlayer video={video} posterUrl={posterUrl} onBack={() => navigate('/listening')} />
        </div>
      )}
    </CorpusPlayerProvider>
  )
}
