import { useNavigate } from 'react-router-dom'
import { Headphones, Mic, Target, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { useUserConfig } from '../hooks/useUserConfig'

const modules = [
  {
    id: 'listen',
    name: '听',
    nameEn: 'Listening',
    description: '听力训练，通过精听、泛听、听写等方式提升英语听觉理解能力',
    Icon: Headphones,
    path: null,
    textColor: 'text-blue-600 dark:text-blue-300',
    iconBg: 'bg-blue-100/70 dark:bg-blue-500/15',
    accentBar: 'bg-gradient-to-r from-blue-500 to-blue-400 dark:from-blue-400 dark:to-blue-300',
    hoverBorder: 'hover:border-blue-300/70 dark:hover:border-blue-400/30',
    glowFrom: 'from-blue-400/[0.12] dark:from-blue-400/[0.18]',
    tags: ['精听', '泛听', '听写'],
    available: false,
  },
  {
    id: 'speak',
    name: '说',
    nameEn: 'Speaking',
    description: '口语训练，通过跟读、复述、朗读等方式提升英语口头表达能力',
    Icon: Mic,
    path: null,
    textColor: 'text-emerald-600 dark:text-emerald-300',
    iconBg: 'bg-emerald-100/70 dark:bg-emerald-500/15',
    accentBar: 'bg-gradient-to-r from-emerald-500 to-emerald-400 dark:from-emerald-400 dark:to-emerald-300',
    hoverBorder: 'hover:border-emerald-300/70 dark:hover:border-emerald-400/30',
    glowFrom: 'from-emerald-400/[0.12] dark:from-emerald-400/[0.18]',
    tags: ['跟读', '复述', '朗读'],
    available: false,
  },
  {
    id: 'practice',
    name: '练',
    nameEn: 'Practice',
    description: '综合训练，通过大量的练习，以及拆解问题，巩固学习成果',
    Icon: Target,
    path: null,
    textColor: 'text-amber-600 dark:text-amber-300',
    iconBg: 'bg-amber-100/70 dark:bg-amber-500/15',
    accentBar: 'bg-gradient-to-r from-amber-500 to-amber-400 dark:from-amber-400 dark:to-amber-300',
    hoverBorder: 'hover:border-amber-300/70 dark:hover:border-amber-400/30',
    glowFrom: 'from-amber-400/[0.12] dark:from-amber-400/[0.18]',
    tags: ['单词', '语法', '句型'],
    available: false,
  },
]

export default function TrainingCenter() {
  const navigate = useNavigate()
  const { theme } = useUserConfig()
  const isDark = theme === 'gray' || theme === 'star'
  const isWarm = theme === 'warm'

  const handleClick = (mod) => {
    if (mod.available && mod.path) {
      navigate(mod.path)
    } else {
      toast('敬请期待', { description: `${mod.name}（${mod.nameEn}）功能正在开发中` })
    }
  }

  return (
    <div className="min-h-[calc(100vh-3rem-6rem)] md:min-h-[calc(100vh-4rem-6rem)] flex flex-col px-4 max-w-5xl mx-auto animate-page-fade-in">
      <header className="pt-4 pb-2 flex-shrink-0">
        <h1 className="text-2xl md:text-3xl font-bold text-content tracking-tight">
          训练中心
        </h1>
        <p className="text-sm text-content-secondary mt-1 leading-relaxed max-w-2xl">
          听说读写，全面提升英语能力
        </p>
      </header>

      <div className="flex-1 flex flex-col justify-center pb-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {modules.map((mod, index) => {
            const Icon = mod.Icon
            return (
              <button
                key={mod.id}
                onClick={() => handleClick(mod)}
                style={{ animationDelay: `${index * 80}ms` }}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-content-tertiary/15 bg-surface text-left p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg dark:hover:shadow-black/40 active:scale-[0.985] animate-card-enter cursor-pointer"
              >
                <span className={`absolute top-0 left-0 right-0 h-[3px] ${mod.accentBar}`} />
                <span
                  className={`pointer-events-none absolute -top-12 -right-12 w-40 h-40 rounded-full bg-gradient-to-br ${mod.glowFrom} to-transparent blur-2xl opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500`}
                />

                <div className="relative flex items-start justify-between mb-3">
                  <div className={`w-11 h-11 rounded-xl ${mod.iconBg} ${mod.textColor} flex items-center justify-center`}>
                    <Icon className="w-[22px] h-[22px]" strokeWidth={2.1} />
                  </div>
                </div>

                <h3 className="relative text-2xl font-bold text-content leading-tight">
                  {mod.name}
                </h3>
                <p className={`relative text-[11px] font-medium uppercase tracking-wider ${mod.textColor} opacity-80 mb-2`}>
                  {mod.nameEn}
                </p>
                <p className="relative text-xs text-content-secondary leading-relaxed line-clamp-3">
                  {mod.description}
                </p>

                <div className="relative flex flex-wrap gap-1 my-4">
                  {mod.tags.map((t) => (
                    <span
                      key={t}
                      className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium ${mod.iconBg} ${mod.textColor}`}
                    >
                      {t}
                    </span>
                  ))}
                </div>

                <div className="relative mt-auto pt-3 border-t border-content-tertiary/10 flex items-center justify-between">
                  <span className="text-xs font-medium text-content-secondary group-hover:text-content transition-colors">
                    进入训练
                  </span>
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 group-hover:bg-primary group-hover:text-white"
                    style={
                      isDark
                        ? { background: 'rgba(255,255,255,0.06)', color: '#fff', boxShadow: '0 0 10px rgba(255,255,255,0.25)' }
                        : isWarm
                          ? { background: '#EFE8DF', color: '#8a7a6b' }
                          : { background: '#f3f4f6', color: '#6b7280' }
                    }
                  >
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
