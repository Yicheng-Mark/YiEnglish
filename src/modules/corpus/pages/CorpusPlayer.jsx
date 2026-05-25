import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, Settings as SettingsIcon } from 'lucide-react'
import { getVideoById } from '../data/mockCorpusVideos'
import { resolveVideoCover } from '../utils/videoCover'
import {
  CorpusPlayerProvider,
  useCorpusContext,
} from '../context/CorpusPlayerContext.jsx'
import VideoPlayer from '../components/VideoPlayer'
import SubtitlePanel from '../components/SubtitlePanel'
import ModeTabs from '../components/ModeTabs'
import PlayerControls from '../components/PlayerControls'
import SettingsPanel from '../components/SettingsPanel'
import CurrentSentencePanel from '../components/CurrentSentencePanel'
import WordPopup from '../../../components/WordPopup.jsx'

function SettingsLauncher() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-9 h-9 flex items-center justify-center rounded-full text-content-secondary dark:text-gray-300 hover:bg-gray-100/60 dark:hover:bg-white/[0.06] transition-colors shrink-0"
        aria-label="设置"
      >
        <SettingsIcon className="w-4 h-4" />
      </button>
      <SettingsPanel open={open} onClose={() => setOpen(false)} />
    </>
  )
}

function CorpusPlayerInner({ video, posterUrl, onBack }) {
  const { player, popup, closePopup, saveWord, removeWord, loadError } =
    useCorpusContext()

  // 键盘快捷键
  useEffect(() => {
    function onKey(e) {
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.code === 'Space') {
        e.preventDefault()
        player.toggle()
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault()
        player.seek(player.currentTime - 5)
      } else if (e.code === 'ArrowRight') {
        e.preventDefault()
        player.seek(player.currentTime + 5)
      } else if (e.code === 'ArrowUp') {
        e.preventDefault()
        player.prevCue()
      } else if (e.code === 'ArrowDown') {
        e.preventDefault()
        player.nextCue()
      } else if (e.key === 'l' || e.key === 'L') {
        player.toggleLoop()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [player])

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-background dark:bg-[#0f0f13] transition-colors duration-500 animate-page-fade-in">
      {/* 顶栏 */}
      <div className="shrink-0 bg-white dark:bg-[#0f0f13] border-b border-gray-200/70 dark:border-white/[0.06]">
        <div className="w-full px-4 md:px-6 h-14 md:h-16 flex items-center gap-3 md:gap-4">
          <button
            onClick={onBack}
            className="w-9 h-9 flex items-center justify-center rounded-full text-content-secondary dark:text-gray-300 hover:bg-gray-100/60 dark:hover:bg-white/[0.06] transition-colors shrink-0"
            aria-label="返回"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0 flex-1 flex flex-col justify-center leading-tight">
            <h1 className="text-sm md:text-base font-semibold text-content dark:text-gray-100 truncate tracking-tight">
              {video.title}
            </h1>
            {video.subtitle && (
              <p className="text-xs text-content-tertiary dark:text-gray-400 truncate hidden md:block mt-0.5">
                {video.subtitle}
              </p>
            )}
          </div>
          {/* 模式 Tab */}
          <div className="hidden md:flex items-center gap-2">
            <ModeTabs />
          </div>
          <button
            type="button"
            onClick={player.toggleAllSubtitles}
            aria-pressed={player.hideSubtitleRight && player.hideSubtitleBottom}
            aria-label={player.hideSubtitleRight && player.hideSubtitleBottom ? '显示字幕' : '隐藏字幕'}
            title={player.hideSubtitleRight && player.hideSubtitleBottom ? '显示字幕' : '隐藏字幕'}
            className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors shrink-0 ${
              player.hideSubtitleRight && player.hideSubtitleBottom
                ? 'bg-primary-soft text-primary dark:bg-white/10 dark:text-white'
                : 'text-content-secondary dark:text-gray-300 hover:bg-gray-100/60 dark:hover:bg-white/[0.06]'
            }`}
          >
            {player.hideSubtitleRight && player.hideSubtitleBottom ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <SettingsLauncher />
        </div>
      </div>

      {/* 移动端模式 Tab */}
      <div className="md:hidden shrink-0 border-b border-gray-200/70 dark:border-white/[0.06] bg-surface dark:bg-white/[0.02]">
        <ModeTabs />
      </div>

      {/* 主体 */}
      <div className="flex-1 min-h-0 w-full flex">
        {/* 左侧 ~45%：视频 + 控制栏 + 当前句子 */}
        <div className="hidden md:flex md:flex-[45] min-w-0 min-h-0 flex-col gap-2 md:gap-3 p-3 md:p-4 border-r border-gray-200/70 dark:border-white/[0.06]">
          <VideoPlayer src={video.videoUrl} poster={posterUrl} />
          <PlayerControls />
          <CurrentSentencePanel />
        </div>
        {/* 右侧 ~55%：字幕列表 */}
        <div className="flex-1 md:flex-[55] min-w-0 min-h-0 h-full">
          {player.hideSubtitleRight ? (
            <button
              type="button"
              onClick={player.toggleHideSubtitleRight}
              className="w-full h-full flex items-center justify-center text-content-secondary dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
            >
              <div className="text-center">
                <p className="text-sm">已隐藏字幕</p>
                <p className="text-xs text-content-tertiary dark:text-gray-500 mt-1">点击显示</p>
              </div>
            </button>
          ) : (
            <SubtitlePanel />
          )}
        </div>
      </div>

      {/* 单词弹窗 */}
      {popup && (
        <WordPopup
          wordData={popup.wordData}
          rect={popup.rect}
          isSaved={popup.isSaved}
          onSave={saveWord}
          onRemove={removeWord}
          onClose={closePopup}
          wordBookLabel="语料词本"
        />
      )}
    </div>
  )
}

export default function CorpusPlayer() {
  const { id } = useParams()
  const navigate = useNavigate()
  const video = getVideoById(id)
  const posterUrl = useMemo(() => resolveVideoCover(video), [video])

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
            返回语料中心
          </button>
        </div>
      </div>
    )
  }

  return (
    <CorpusPlayerProvider video={video}>
      <CorpusPlayerInner
        video={video}
        posterUrl={posterUrl}
        onBack={() => navigate('/listening')}
      />
    </CorpusPlayerProvider>
  )
}
