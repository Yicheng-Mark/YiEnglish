import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Lightbulb,
  BookOpen,
  Eye,
  Ear,
  Target,
} from 'lucide-react'
import methodData from '../../../data/english_learning_methods_data.json'

const evidenceColors = {
  '最强': {
    text: 'text-emerald-600 dark:text-emerald-300',
    bg: 'bg-emerald-100/70 dark:bg-emerald-500/15',
    bar: 'bg-gradient-to-r from-emerald-500 to-emerald-400 dark:from-emerald-400 dark:to-emerald-300',
    border: 'hover:border-emerald-300/70 dark:hover:border-emerald-400/30',
    glow: 'from-emerald-400/[0.12] dark:from-emerald-400/[0.18]',
  },
  '强': {
    text: 'text-sky-600 dark:text-sky-300',
    bg: 'bg-sky-100/70 dark:bg-sky-500/15',
    bar: 'bg-gradient-to-r from-sky-500 to-sky-400 dark:from-sky-400 dark:to-sky-300',
    border: 'hover:border-sky-300/70 dark:hover:border-sky-400/30',
    glow: 'from-sky-400/[0.12] dark:from-sky-400/[0.18]',
  },
  '中强': {
    text: 'text-amber-600 dark:text-amber-300',
    bg: 'bg-amber-100/70 dark:bg-amber-500/15',
    bar: 'bg-gradient-to-r from-amber-500 to-amber-400 dark:from-amber-400 dark:to-amber-300',
    border: 'hover:border-amber-300/70 dark:hover:border-amber-400/30',
    glow: 'from-amber-400/[0.12] dark:from-amber-400/[0.18]',
  },
  '中': {
    text: 'text-slate-600 dark:text-slate-300',
    bg: 'bg-slate-100/70 dark:bg-slate-500/15',
    bar: 'bg-gradient-to-r from-slate-500 to-slate-400 dark:from-slate-400 dark:to-slate-300',
    border: 'hover:border-slate-300/70 dark:hover:border-slate-400/30',
    glow: 'from-slate-400/[0.12] dark:from-slate-400/[0.18]',
  },
}

const iconMap = {
  1: Brain,
  2: Lightbulb,
  3: BookOpen,
  4: Eye,
  5: Ear,
  6: Target,
}

function MethodCard({ method, index, onClick }) {
  const Icon = iconMap[method.id] || Lightbulb
  const colors = evidenceColors[method.evidence_level] || evidenceColors['中']

  const stats = method.core_data?.slice(0, 2).map((d) => ({
    value: d.value,
    label: d.metric,
  })) || [{ value: method.evidence_level, label: '证据等级' }]

  return (
    <button
      onClick={onClick}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-content-tertiary/15 bg-surface text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg dark:hover:shadow-black/40 active:scale-[0.985] animate-card-enter ${colors.border}`}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* 顶部 accent bar */}
      <span className={`absolute top-0 left-0 right-0 h-[3px] ${colors.bar}`} />

      {/* 角落径向光晕 */}
      <span
        className={`pointer-events-none absolute -top-12 -right-12 w-40 h-40 rounded-full bg-gradient-to-br ${colors.glow} to-transparent blur-2xl opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500`}
      />

      {/* 卡片内容 */}
      <div className="relative p-5 flex-1 flex flex-col">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-11 h-11 rounded-xl ${colors.bg} ${colors.text} flex items-center justify-center`}>
            <Icon className="w-[22px] h-[22px]" strokeWidth={2.1} />
          </div>
          <span className={`text-[10px] font-bold tracking-wider ${colors.text} opacity-70 px-2 py-0.5 rounded-md ${colors.bg}`}>
            {method.evidence_level}
          </span>
        </div>

        <h3 className="relative text-lg font-bold text-content leading-tight">
          {method.name}
        </h3>
        <p className={`relative text-[11px] font-medium uppercase tracking-wider ${colors.text} opacity-80 mb-2`}>
          {method.name_en}
        </p>

        {/* 核心数据 */}
        <div className="relative grid grid-cols-2 gap-2 my-3">
          {stats.map((s, i) => (
            <div
              key={i}
              className="rounded-lg bg-content-tertiary/[0.06] border border-content-tertiary/10 px-2.5 py-2"
            >
              <div className={`text-xl font-bold leading-none ${colors.text}`}>
                {s.value}
              </div>
              <div className="text-[10px] text-content-tertiary mt-1 leading-tight">
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="relative mt-auto pt-3 border-t border-content-tertiary/10 flex items-center justify-between">
          <span className="text-xs font-medium text-content-secondary group-hover:text-content transition-colors">
            查看详情
          </span>
          <span className={`w-7 h-7 rounded-full bg-content-tertiary/10 ${colors.text} flex items-center justify-center transition-all duration-200 group-hover:translate-x-0.5 group-hover:bg-current`}>
            <ArrowRight
              className="w-3.5 h-3.5 text-white dark:text-gray-900 group-hover:text-white"
              strokeWidth={2.5}
            />
          </span>
        </div>
      </div>
    </button>
  )
}

function ComparisonSection() {
  const data = methodData.comparison_table
  if (!data || data.length === 0) return null

  return (
    <div className="mt-6">
      <h3 className="text-lg font-bold text-content mb-3">科学方法 vs 低效方法</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.map((row, i) => (
          <div
            key={i}
            className="p-4 rounded-2xl bg-surface border border-content-tertiary/15 hover:border-primary/20 transition-colors"
          >
            <p className="text-xs text-content-tertiary mb-2">{row.dimension}</p>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{row.scientific_method}</span>
              <span className="text-xs text-content-tertiary">vs</span>
              <span className="text-sm text-content-tertiary line-through">{row.inefficient_method}</span>
            </div>
            <div className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-100/70 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
              差距: {row.gap}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DailyRoutineSection() {
  const data = methodData.minimum_effective_dose
  if (!data) return null

  return (
    <div className="mt-6">
      <h3 className="text-lg font-bold text-content mb-3">每日 15-20 分钟科学记忆流程</h3>
      <p className="text-sm text-content-secondary mb-4">{data.finding}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {data.daily_routine.map((step) => (
          <div
            key={step.step}
            className="p-4 rounded-2xl bg-surface border border-content-tertiary/15 hover:border-primary/20 transition-colors relative overflow-hidden"
          >
            <span className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-primary to-primary/60 dark:from-primary-dark dark:to-primary-dark/60" />
            <div className="flex items-center gap-2 mb-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 dark:bg-primary-dark/10 text-[10px] font-bold text-primary dark:text-primary-dark">
                {step.step}
              </span>
              <span className="text-xs font-medium text-content-tertiary">{step.duration}</span>
            </div>
            <p className="font-semibold text-content text-sm mb-1">{step.activity}</p>
            <p className="text-xs text-content-secondary leading-relaxed">{step.details}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function LearningMethodsHome() {
  const navigate = useNavigate()

  return (
    <div className="min-h-[calc(100vh-3rem-6rem)] md:min-h-[calc(100vh-4rem-6rem)] flex flex-col px-4 max-w-6xl mx-auto animate-page-fade-in">
      {/* Header */}
      <header className="pt-4 pb-2 flex-shrink-0">
        <div className="flex items-center justify-start gap-2 mb-3">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-content-tertiary hover:text-primary hover:bg-primary-soft transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-[18px] h-[18px]" />
            返回列表
          </button>
        </div>
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="text-2xl md:text-3xl font-bold text-content tracking-tight">
            {methodData.title}
          </h1>
        </div>
        <p className="text-sm text-content-secondary mt-1 leading-relaxed max-w-2xl">
          {methodData.source}
        </p>
      </header>

      {/* 方法卡片网格 */}
      <div className="flex-1 pb-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {methodData.methods.map((method, index) => (
            <MethodCard
              key={method.id}
              method={method}
              index={index}
              onClick={() => navigate(`/learning-methods/${method.id}`)}
            />
          ))}
        </div>

        {/* 对比数据 */}
        <ComparisonSection />

        {/* 每日流程 */}
        <DailyRoutineSection />
      </div>

      {/* Footer */}
      <footer className="flex items-center justify-between text-[11px] text-content-tertiary py-2 flex-shrink-0">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1 h-1 rounded-full bg-primary" />
          {methodData.methods.length} 种科学方法 · {methodData.comparison_table.length} 组对比数据
        </span>
        <span>更新于 {methodData.last_updated}</span>
      </footer>
    </div>
  )
}
