import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { useUserConfig } from '../hooks/useUserConfig'
import { trainingModules } from '../data/trainingModules'

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
          {trainingModules.map((mod, index) => {
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
