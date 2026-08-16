import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Clock, AlertTriangle } from 'lucide-react'
import { tenses } from '../data/grammarData.jsx'

const TIME_FRAME_BADGE = {
  present: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  past: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  future: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
}

const TIME_FRAME_LABEL = {
  present: '现在',
  past: '过去',
  future: '将来',
}

const ASPECT_ROW_COLORS = [
  'bg-emerald-50 dark:bg-emerald-500/10',
  'bg-sky-50 dark:bg-sky-500/10',
  'bg-amber-50 dark:bg-amber-500/10',
  'bg-violet-50 dark:bg-violet-500/10',
]

const ASPECT_LABELS = ['Simple', 'Continuous', 'Perfect', 'Perfect Continuous']
const ASPECT_LABELS_ZH = ['一般', '进行', '完成', '完成进行']
const TIME_LABELS = ['present', 'past', 'future']
const TIME_LABELS_EN = ['Present', 'Past', 'Future']
const ASPECT_KEYS = ['simple', 'continuous', 'perfect', 'perfectContinuous']

/* ------------------------------------------------------------------ */
/*  Overview + List View                                               */
/* ------------------------------------------------------------------ */
function TenseOverview({ navigate }) {
  const { overview } = tenses
  const tenseList = tenses.tenses

  return (
    <>
      {/* Definition */}
      <section className="mb-8">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-content dark:text-gray-100 mb-1">时态概述</h2>
            <p className="text-sm text-content-secondary dark:text-gray-300 leading-relaxed">
              {overview.definition}
            </p>
            <p className="text-xs text-content-tertiary dark:text-gray-400 mt-1 italic">
              {overview.definitionEn}
            </p>
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex flex-wrap gap-3 mt-4">
          <div className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-center">
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {overview.totalTenses}
            </p>
            <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70">基本时态</p>
          </div>
          <div className="px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-center">
            <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
              {overview.timeDimensions.length}
            </p>
            <p className="text-[10px] text-blue-600/70 dark:text-blue-400/70">时间维度</p>
          </div>
          <div className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-center">
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
              {overview.aspectDimensions.length}
            </p>
            <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70">体维度</p>
          </div>
        </div>
      </section>

      {/* Tense Matrix */}
      <section className="mb-8">
        <h3 className="text-base font-bold text-content dark:text-gray-100 mb-3">时态矩阵</h3>
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="p-2 text-left text-xs font-semibold text-content-tertiary dark:text-gray-400 bg-gray-50 dark:bg-white/[0.03] rounded-tl-lg w-28">
                  体 \ 时间
                </th>
                {TIME_LABELS_EN.map((label, i) => (
                  <th
                    key={label}
                    className={`p-2 text-center text-xs font-semibold text-content-tertiary dark:text-gray-400 ${
                      i === 2 ? 'rounded-tr-lg' : ''
                    } bg-gray-50 dark:bg-white/[0.03]`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ASPECT_KEYS.map((key, rowIdx) => (
                <tr key={key} className="border-t border-gray-100 dark:border-white/[0.04]">
                  <td
                    className={`p-2.5 text-xs font-medium ${ASPECT_ROW_COLORS[rowIdx]} rounded-l-lg`}
                  >
                    <span className="text-content dark:text-gray-200">
                      {ASPECT_LABELS_ZH[rowIdx]}
                    </span>
                    <br />
                    <span className="text-content-tertiary dark:text-gray-400 text-[10px]">
                      {ASPECT_LABELS[rowIdx]}
                    </span>
                  </td>
                  {TIME_LABELS.map((time, colIdx) => (
                    <td
                      key={time}
                      className={`p-2.5 text-center font-mono text-xs text-content-secondary dark:text-gray-300 ${
                        ASPECT_ROW_COLORS[rowIdx]
                      } ${colIdx === 2 ? 'rounded-r-lg' : ''}`}
                    >
                      {overview.tenseMatrix[key]?.[time] || '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Tense List */}
      <section>
        <h3 className="text-base font-bold text-content dark:text-gray-100 mb-3">全部时态</h3>
        <div className="space-y-3">
          {tenseList.map((tense, index) => (
            <button
              key={tense.id}
              onClick={() => navigate(`tenses/${tense.id}`)}
              className="group w-full text-left rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] p-4 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 animate-card-enter"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-base font-bold text-content dark:text-gray-100">
                      {tense.name}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        TIME_FRAME_BADGE[tense.timeFrame] || ''
                      }`}
                    >
                      {TIME_FRAME_LABEL[tense.timeFrame] || tense.timeFrame}
                    </span>
                  </div>
                  <p className="text-xs text-content-tertiary dark:text-gray-400 mb-2">
                    {tense.nameEn}
                  </p>
                  <p className="text-xs text-content-secondary dark:text-gray-300 font-mono bg-gray-50 dark:bg-white/[0.04] rounded-lg px-2.5 py-1.5 truncate">
                    {tense.structure.affirmative.formula}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors shrink-0 mt-1" />
              </div>
            </button>
          ))}
        </div>
      </section>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Detail View                                                        */
/* ------------------------------------------------------------------ */
function TenseDetail({ tense, navigate }) {
  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              TIME_FRAME_BADGE[tense.timeFrame] || ''
            }`}
          >
            {TIME_FRAME_LABEL[tense.timeFrame] || tense.timeFrame}
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            {tense.aspect}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-content dark:text-gray-100">{tense.name}</h1>
        <p className="text-sm text-content-tertiary dark:text-gray-400 mt-0.5">{tense.nameEn}</p>
      </div>

      {/* Structure */}
      <section className="mb-8">
        <h2 className="text-base font-bold text-content dark:text-gray-100 mb-3 flex items-center gap-2">
          <span className="w-1 h-5 rounded-full bg-emerald-500" />
          句型结构
        </h2>
        <div className="space-y-3">
          {['affirmative', 'negative', 'question'].map((type) => {
            const section = tense.structure[type]
            if (!section) return null
            const typeLabel = {
              affirmative: '肯定句',
              negative: '否定句',
              question: '疑问句',
            }[type]
            const typeLabelEn = {
              affirmative: 'Affirmative',
              negative: 'Negative',
              question: 'Question',
            }[type]
            const typeColor = {
              affirmative:
                'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
              negative: 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300',
              question: 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300',
            }[type]

            return (
              <div
                key={type}
                className="rounded-xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${typeColor}`}>
                    {typeLabel}
                  </span>
                  <span className="text-[10px] text-content-tertiary dark:text-gray-400">
                    {typeLabelEn}
                  </span>
                </div>
                <p className="text-sm font-mono font-medium text-content dark:text-gray-100 bg-gray-50 dark:bg-white/[0.04] rounded-lg px-3 py-2 mb-3">
                  {section.formula}
                </p>
                <div className="space-y-1.5">
                  {section.examples.map((ex, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="w-1 h-1 rounded-full bg-emerald-400 dark:bg-emerald-500 shrink-0 mt-2" />
                      <div>
                        <span className="text-content dark:text-gray-200">{ex.sentence}</span>
                        <span className="text-content-tertiary dark:text-gray-400 ml-2 text-xs">
                          {ex.meaning}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Usages */}
      {tense.usages && tense.usages.length > 0 && (
        <section className="mb-8">
          <h2 className="text-base font-bold text-content dark:text-gray-100 mb-3 flex items-center gap-2">
            <span className="w-1 h-5 rounded-full bg-blue-500" />
            用法详解
          </h2>
          <div className="space-y-3">
            {tense.usages.map((usage, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] p-4"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm font-bold text-content dark:text-gray-100">
                    {usage.usage}
                  </span>
                  <span className="text-[10px] text-content-tertiary dark:text-gray-400">
                    {usage.usageEn}
                  </span>
                </div>
                <p className="text-xs text-content-secondary dark:text-gray-300 mb-3 leading-relaxed">
                  {usage.explanation}
                </p>
                {usage.examples && usage.examples.length > 0 && (
                  <div className="space-y-1.5 bg-gray-50 dark:bg-white/[0.03] rounded-lg p-3">
                    {usage.examples.map((ex, i) => (
                      <div key={i} className="text-sm">
                        <span className="text-content dark:text-gray-200">{ex.sentence}</span>
                        <span className="text-content-tertiary dark:text-gray-400 ml-2 text-xs">
                          {ex.meaning}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Time Markers */}
      {tense.timeMarkers && tense.timeMarkers.length > 0 && (
        <section className="mb-8">
          <h2 className="text-base font-bold text-content dark:text-gray-100 mb-3 flex items-center gap-2">
            <span className="w-1 h-5 rounded-full bg-amber-500" />
            时间标志词
          </h2>
          <div className="flex flex-wrap gap-2">
            {tense.timeMarkers.map((marker, idx) => (
              <span
                key={idx}
                className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20"
              >
                {marker}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Common Errors */}
      {tense.commonErrors && tense.commonErrors.length > 0 && (
        <section className="mb-8">
          <h2 className="text-base font-bold text-content dark:text-gray-100 mb-3 flex items-center gap-2">
            <span className="w-1 h-5 rounded-full bg-rose-500" />
            常见错误
          </h2>
          <div className="space-y-3">
            {tense.commonErrors.map((err, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-rose-200 dark:border-rose-500/15 bg-rose-50/50 dark:bg-rose-500/10 p-4"
              >
                <div className="flex items-start gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-rose-600 dark:text-rose-400 line-through font-mono">
                      {err.error.replace(/~~/g, '')}
                    </p>
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                      {err.correct}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-content-secondary dark:text-gray-300 pl-6 leading-relaxed">
                  {err.explanation}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Comparison */}
      {tense.comparisonWith && tense.comparisonWith.length > 0 && (
        <section className="mb-8">
          <h2 className="text-base font-bold text-content dark:text-gray-100 mb-3 flex items-center gap-2">
            <span className="w-1 h-5 rounded-full bg-violet-500" />
            对比辨析
          </h2>
          <div className="space-y-3">
            {tense.comparisonWith.map((comp, idx) => {
              const otherTense = tenses.tenses.find((t) => t.id === comp.withTense)
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] p-4"
                >
                  <p className="text-sm text-content-secondary dark:text-gray-300 leading-relaxed mb-3">
                    {comp.distinction}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-lg bg-emerald-50 dark:bg-emerald-500/10 p-3">
                      <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 mb-1">
                        {tense.name}
                      </p>
                      <p className="text-sm font-mono text-content dark:text-gray-200">
                        {comp.exampleThis}
                      </p>
                    </div>
                    <div className="rounded-lg bg-violet-50 dark:bg-violet-500/10 p-3">
                      <p className="text-[10px] font-medium text-violet-600 dark:text-violet-400 mb-1">
                        {otherTense ? otherTense.name : comp.withTense}
                      </p>
                      <p className="text-sm font-mono text-content dark:text-gray-200">
                        {comp.exampleOther}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
export default function Tenses() {
  const { id } = useParams()
  const navigate = useNavigate()

  // Find the tense if id is present
  const tense = id ? tenses.tenses.find((t) => t.id === id) : null

  // Not found
  if (id && !tense) {
    return (
      <div className="min-h-[calc(100vh-3rem-3.5rem)] md:min-h-[calc(100vh-4rem-3.5rem)] flex flex-col items-center justify-center px-6 text-center animate-page-fade-in">
        <p className="text-content-secondary dark:text-gray-300 mb-4">没有找到该时态</p>
        <button
          onClick={() => navigate('/reading/grammar/tenses')}
          className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors"
        >
          返回时态列表
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-3rem-3.5rem)] md:min-h-[calc(100vh-4rem-3.5rem)] px-4 py-6 max-w-4xl mx-auto animate-page-fade-in">
      {/* Back button */}
      <button
        onClick={() => {
          if (id) {
            navigate('/reading/grammar/tenses')
          } else {
            navigate('/reading/grammar')
          }
        }}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-content-secondary dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-colors mb-4 -ml-1.5"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>{id ? '返回时态列表' : '返回语法首页'}</span>
      </button>

      {/* Module badge */}
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium mb-3">
        <Clock className="w-3.5 h-3.5" />
        时态体系
      </div>

      {id && tense ? (
        <TenseDetail tense={tense} navigate={(path) => navigate(`/reading/grammar/${path}`)} />
      ) : (
        <TenseOverview navigate={(path) => navigate(`/reading/grammar/${path}`)} />
      )}
    </div>
  )
}
