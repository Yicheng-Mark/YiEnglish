import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Brain,
  Lightbulb,
  BookOpen,
  Eye,
  Ear,
  Target,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import methodData from '../../../../english_learning_methods_data.json'

const evidenceColors = {
  '最强': {
    text: 'text-emerald-600 dark:text-emerald-300',
    bg: 'bg-emerald-100/70 dark:bg-emerald-500/15',
    bar: 'bg-gradient-to-r from-emerald-500 to-emerald-400 dark:from-emerald-400 dark:to-emerald-300',
    badgeBg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  },
  '强': {
    text: 'text-sky-600 dark:text-sky-300',
    bg: 'bg-sky-100/70 dark:bg-sky-500/15',
    bar: 'bg-gradient-to-r from-sky-500 to-sky-400 dark:from-sky-400 dark:to-sky-300',
    badgeBg: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
  },
  '中强': {
    text: 'text-amber-600 dark:text-amber-300',
    bg: 'bg-amber-100/70 dark:bg-amber-500/15',
    bar: 'bg-gradient-to-r from-amber-500 to-amber-400 dark:from-amber-400 dark:to-amber-300',
    badgeBg: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  },
  '中': {
    text: 'text-slate-600 dark:text-slate-300',
    bg: 'bg-slate-100/70 dark:bg-slate-500/15',
    bar: 'bg-gradient-to-r from-slate-500 to-slate-400 dark:from-slate-400 dark:to-slate-300',
    badgeBg: 'bg-slate-50 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300',
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

export default function MethodDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const method = methodData.methods.find((m) => String(m.id) === id)

  if (!method) {
    return (
      <div className="min-h-[calc(100vh-3rem-6rem)] flex flex-col items-center justify-center px-6 text-center pb-20 animate-page-fade-in">
        <p className="text-content-secondary dark:text-gray-300 mb-4">没有找到该学习方法</p>
        <button
          onClick={() => navigate('/learning-methods')}
          className="px-4 py-2 rounded-lg bg-primary text-white text-sm hover:opacity-90 transition-opacity cursor-pointer"
        >
          返回学习方法
        </button>
      </div>
    )
  }

  const Icon = iconMap[method.id] || Lightbulb
  const colors = evidenceColors[method.evidence_level] || evidenceColors['中']

  return (
    <div className="min-h-[calc(100vh-3rem-6rem)] md:min-h-[calc(100vh-4rem-6rem)] flex flex-col px-4 max-w-4xl mx-auto animate-page-fade-in pb-20">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-content-secondary dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-colors mt-4 mb-4 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>返回列表</span>
      </button>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-12 h-12 rounded-xl ${colors.bg} ${colors.text} flex items-center justify-center`}>
            <Icon className="w-6 h-6" strokeWidth={2} />
          </div>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${colors.badgeBg}`}>
            证据等级: {method.evidence_level}
          </span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-content dark:text-white mb-1">
          {method.name}
        </h1>
        <p className={`text-sm font-medium uppercase tracking-wider ${colors.text} opacity-80`}>
          {method.name_en}
        </p>
      </div>

      {/* Top accent bar */}
      <div className={`h-[3px] w-full rounded-full ${colors.bar} mb-6`} />

      {/* Core Data */}
      {method.core_data && method.core_data.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-content dark:text-white mb-3">核心数据</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {method.core_data.map((d, i) => (
              <div
                key={i}
                className="p-4 rounded-2xl bg-surface border border-content-tertiary/15 hover:border-primary/20 transition-colors"
              >
                <p className="text-xs text-content-tertiary dark:text-gray-500 mb-1">{d.metric}</p>
                <p className={`text-2xl font-bold ${colors.text} mb-1`}>{d.value}</p>
                {d.comparison && (
                  <p className="text-xs text-content-secondary dark:text-gray-400">{d.comparison}</p>
                )}
                {d.source && (
                  <p className="text-[11px] text-content-tertiary/70 dark:text-gray-600 mt-1">— {d.source}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Neuroscience Basis */}
      {method.neuroscience_basis && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-content dark:text-white mb-3">神经科学基础</h2>
          <div className="p-5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/10">
            <p className="text-sm font-medium text-indigo-700 dark:text-indigo-400 mb-1">
              {method.neuroscience_basis.institution} · {method.neuroscience_basis.method}
            </p>
            <p className="text-base text-indigo-600/80 dark:text-indigo-300/70 leading-relaxed">
              {method.neuroscience_basis.finding}
            </p>
            {method.neuroscience_basis.correlation && (
              <p className="text-sm text-indigo-500/70 dark:text-indigo-400/60 mt-2">
                {method.neuroscience_basis.correlation}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Mechanism / Theory / Key Distinction */}
      {(method.mechanism || method.theory || method.key_distinction) && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-content dark:text-white mb-3">原理说明</h2>
          <div className="space-y-3">
            {method.mechanism && (
              <div className="p-4 rounded-2xl bg-surface border border-content-tertiary/15">
                <p className="text-sm text-content-secondary dark:text-gray-400 leading-relaxed">
                  {method.mechanism}
                </p>
              </div>
            )}
            {method.theory && (
              <div className="p-4 rounded-2xl bg-surface border border-content-tertiary/15">
                <p className="text-sm text-content-secondary dark:text-gray-400 leading-relaxed">
                  {method.theory}
                </p>
              </div>
            )}
            {method.key_distinction && (
              <div className="p-4 rounded-2xl bg-surface border border-content-tertiary/15">
                <p className="text-sm text-content-secondary dark:text-gray-400 leading-relaxed">
                  {method.key_distinction}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sensory Channels */}
      {method.sensory_channels && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-content dark:text-white mb-3">感官通道</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {method.sensory_channels.map((s, i) => (
              <div
                key={i}
                className="p-4 rounded-2xl bg-surface border border-content-tertiary/15 hover:border-primary/20 transition-colors"
              >
                <span className="text-sm font-semibold text-primary dark:text-primary-dark">{s.channel}</span>
                <p className="text-sm text-content-secondary dark:text-gray-400 mt-1">{s.action}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Optimal Review Schedule */}
      {method.optimal_review_schedule && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-content dark:text-white mb-3">最佳复习间隔</h2>
          <div className="flex flex-wrap gap-2">
            {method.optimal_review_schedule.map((t, i) => (
              <span
                key={i}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium ${colors.bg} ${colors.text}`}
              >
                <Clock className="w-3.5 h-3.5" />
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Best Practices */}
      {method.best_practices && method.best_practices.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-content dark:text-white mb-3">最佳实践</h2>
          <div className="space-y-2">
            {method.best_practices.map((bp, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-4 rounded-2xl bg-surface border border-content-tertiary/15 hover:border-primary/20 transition-colors"
              >
                <CheckCircle2 className={`w-5 h-5 mt-0.5 shrink-0 ${colors.text}`} />
                <span className="text-sm text-content-secondary dark:text-gray-400 leading-relaxed">{bp}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Example */}
      {method.example && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-content dark:text-white mb-3">示例对比</h2>
          <div className="space-y-3">
            {method.example.bad && (
              <div className="p-4 rounded-2xl bg-red-50/60 dark:bg-red-500/5 border border-red-100 dark:border-red-500/10">
                <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">低效方式</p>
                <p className="text-sm text-red-600/80 dark:text-red-300/70">{method.example.bad}</p>
              </div>
            )}
            {method.example.good && (
              <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/10">
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">科学方式</p>
                <p className="text-sm text-emerald-600/80 dark:text-emerald-300/70">{method.example.good}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
