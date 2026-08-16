import { useNavigate } from 'react-router-dom'
import { ArrowRight, BookOpen, Type, Clock, MessageSquareText } from 'lucide-react'

const modules = [
  {
    icon: Type,
    label: '词性',
    en: 'Parts of Speech',
    color: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300',
  },
  {
    icon: Clock,
    label: '时态',
    en: 'Tenses',
    color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
  },
  {
    icon: MessageSquareText,
    label: '句子精解',
    en: 'Sentence Analysis',
    color: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
  },
]

export default function GrammarOverview() {
  const navigate = useNavigate()
  return (
    <div
      onClick={() => navigate('/reading/grammar')}
      className="group card card-hover relative overflow-hidden cursor-pointer glow-border-subtle active:scale-[0.98] transition-transform duration-150 flex flex-col min-h-[280px] h-full rounded-xl shadow-sm"
    >
      {/* 右下角装饰 */}
      <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-gradient-to-br from-primary/5 to-violet-500/5 dark:from-primary/10 dark:to-violet-500/10 rounded-full blur-2xl group-hover:from-primary/10 group-hover:to-violet-500/10 transition-all duration-500" />

      <div className="relative p-5 flex flex-col flex-1 justify-between">
        {/* 标签 */}
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">
            <BookOpen className="w-3 h-3" />
            语法体系
          </span>
        </div>

        {/* 标题 */}
        <h3 className="text-lg font-bold leading-tight mb-1 text-content dark:text-gray-100 group-hover:text-primary transition-colors">
          语法体系
        </h3>
        <p className="text-sm text-content-tertiary dark:text-gray-400 mb-4 leading-relaxed line-clamp-1">
          词性、时态、英语句子精解
        </p>

        {/* 三大模块 */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {modules.map((m) => (
            <div
              key={m.label}
              className={`flex flex-col items-center gap-1.5 py-3 px-1 rounded-lg ${m.color} transition-colors`}
            >
              <m.icon className="w-5 h-5" />
              <span className="text-xs font-semibold leading-tight">{m.label}</span>
              <span className="text-[10px] opacity-60 leading-tight">{m.en}</span>
            </div>
          ))}
        </div>

        {/* 底部 */}
        <div className="mt-auto">
          <div className="border-t border-gray-200/70 dark:border-white/[0.06]" />
          <div className="flex items-center justify-between pt-3">
            <span className="text-xs text-content-tertiary dark:text-gray-500">3 大模块</span>
            <span className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/[0.06] text-content-secondary dark:text-gray-300 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors duration-200">
              <ArrowRight className="w-4 h-4" />
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
