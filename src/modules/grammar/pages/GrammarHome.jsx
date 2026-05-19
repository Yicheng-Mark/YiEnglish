import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react'
import { moduleConfig, metadata } from '../data/grammarData.jsx'

export default function GrammarHome() {
  const navigate = useNavigate()

  return (
    <div className="min-h-[calc(100vh-3rem-6rem)] md:min-h-[calc(100vh-4rem-6rem)] flex flex-col px-4 max-w-5xl mx-auto animate-page-fade-in">
      {/* Header */}
      <header className="pt-4 pb-2 flex-shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => navigate('/reading')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-content-tertiary hover:text-primary hover:bg-primary-soft transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回列表
          </button>
        </div>
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="text-2xl md:text-3xl font-bold text-content tracking-tight">
            {metadata.title}
          </h1>
          <span className="inline-flex items-center gap-1 text-xs text-content-tertiary">
            <Sparkles className="w-3 h-3" />
            由词到句 · 三阶进阶
          </span>
        </div>
        <p className="text-sm text-content-secondary mt-1 leading-relaxed max-w-2xl">
          {metadata.description}
        </p>
      </header>

      {/* 学习路径条 */}
      <nav
        aria-label="学习路径"
        className="flex items-center justify-center gap-2 sm:gap-3 py-1.5 mb-2 flex-shrink-0 animate-card-enter"
      >
        {moduleConfig.map((mod, idx) => (
          <div key={`step-${mod.id}`} className="flex items-center gap-2 sm:gap-3">
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${mod.textColor}`}>
              <span className={`w-5 h-5 rounded-full ${mod.iconBg} ${mod.textColor} flex items-center justify-center text-[10px] font-bold`}>
                {mod.step}
              </span>
              {mod.name}
            </span>
            {idx < moduleConfig.length - 1 && (
              <span className="w-6 sm:w-10 h-px bg-content-tertiary/30" />
            )}
          </div>
        ))}
      </nav>

      {/* 三大模块卡片 */}
      <div className="flex-1 flex flex-col justify-center pb-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {moduleConfig.map((mod, index) => {
          const Icon = mod.Icon
          return (
            <button
              key={mod.id}
              onClick={() => navigate(mod.path)}
              style={{ animationDelay: `${index * 80}ms` }}
              className={`group relative flex flex-col overflow-hidden rounded-2xl border border-content-tertiary/15 bg-surface text-left p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg dark:hover:shadow-black/40 active:scale-[0.985] animate-card-enter ${mod.hoverBorder}`}
            >
              {/* 顶部 accent bar */}
              <span className={`absolute top-0 left-0 right-0 h-[3px] ${mod.accentBar}`} />

              {/* 角落径向光晕 */}
              <span
                className={`pointer-events-none absolute -top-12 -right-12 w-40 h-40 rounded-full bg-gradient-to-br ${mod.glowFrom} to-transparent blur-2xl opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500`}
              />

              {/* 头部：图标 + STEP */}
              <div className="relative flex items-start justify-between mb-3">
                <div className={`w-11 h-11 rounded-xl ${mod.iconBg} ${mod.textColor} flex items-center justify-center`}>
                  <Icon className="w-[22px] h-[22px]" strokeWidth={2.1} />
                </div>
                <span className={`text-[10px] font-bold tracking-wider ${mod.textColor} opacity-70`}>
                  STEP {mod.step}
                </span>
              </div>

              {/* 标题 + 副标 + 描述 */}
              <h3 className="relative text-lg font-bold text-content leading-tight">
                {mod.name}
              </h3>
              <p className={`relative text-[11px] font-medium uppercase tracking-wider ${mod.textColor} opacity-80 mb-2`}>
                {mod.nameEn}
              </p>
              <p className="relative text-xs text-content-secondary leading-relaxed line-clamp-3">
                {mod.description}
              </p>

              {/* stats 2-grid */}
              <div className="relative grid grid-cols-2 gap-2 my-4">
                {mod.stats.map((s, i) => (
                  <div
                    key={i}
                    className="rounded-lg bg-content-tertiary/[0.06] border border-content-tertiary/10 px-2.5 py-2"
                  >
                    <div className={`text-xl font-bold leading-none ${mod.textColor}`}>
                      {s.value}
                    </div>
                    <div className="text-[10px] text-content-tertiary mt-1 leading-tight">
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* tag chips */}
              <div className="relative flex flex-wrap gap-1 mb-4">
                {mod.tags.map((t) => (
                  <span
                    key={t}
                    className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium ${mod.iconBg} ${mod.textColor}`}
                  >
                    {t}
                  </span>
                ))}
              </div>

              {/* CTA 行 */}
              <div className="relative mt-auto pt-3 border-t border-content-tertiary/10 flex items-center justify-between">
                <span className="text-xs font-medium text-content-secondary group-hover:text-content transition-colors">
                  进入学习
                </span>
                <span className={`w-7 h-7 rounded-full bg-content-tertiary/10 ${mod.textColor} flex items-center justify-center transition-all duration-200 group-hover:translate-x-0.5 group-hover:bg-current`}>
                  <ArrowRight
                    className="w-3.5 h-3.5 text-white dark:text-gray-900 group-hover:text-white"
                    strokeWidth={2.5}
                  />
                </span>
              </div>
            </button>
          )
        })}
        </div>
      </div>

      {/* Footer */}
      <footer className="flex items-center justify-between text-[11px] text-content-tertiary py-2 flex-shrink-0">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1 h-1 rounded-full bg-primary" />
          {metadata.modules.length} 大模块 · 由词到句的完整体系
        </span>
        <span>v{metadata.version}</span>
      </footer>
    </div>
  )
}
