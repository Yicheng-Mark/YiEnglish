import { useNavigate } from 'react-router-dom'
import { mockCorpusVideos } from '../../modules/corpus/data/mockCorpusVideos'
import VideoCard from '../../modules/corpus/components/VideoCard'

const TRIAL_EPISODE_COUNT = 5
const demoVideos = mockCorpusVideos.filter(v => Number(v.id) <= TRIAL_EPISODE_COUNT)

export default function DemoCorpus() {
  const navigate = useNavigate()

  const handleClick = (id) => {
    navigate(`/listening/${id}`)
  }

  return (
    <div className="bg-background dark:bg-transparent p-4 md:p-6 transition-colors duration-500 animate-page-fade-in">
      <div className="max-w-6xl mx-auto px-2 md:px-6 w-full">
        <div className="mt-6 md:mt-16 mb-6 md:mb-10">
          <div className="text-left">
            <h1 className="text-display gradient-text mb-3 tracking-tight text-glow-primary">
              语料
            </h1>
            <p className="text-content-tertiary text-body max-w-xl leading-relaxed">
              精选演讲与短视频，逐句字幕跟读、单句循环、变速练习，在真实语境中磨炼听说能力。
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pb-28">
          {demoVideos.map(video => (
            <VideoCard
              key={video.id}
              video={video}
              isBookmarked={false}
              onClick={handleClick}
              onToggleBookmark={() => {}}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
