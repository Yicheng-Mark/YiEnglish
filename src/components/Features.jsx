import { useNavigate } from 'react-router-dom'
import { Keyboard, BookOpen, Monitor, Target } from 'lucide-react'

const features = [
  {
    icon: Keyboard,
    title: '打字记忆',
    desc: '手指动起来，单词记得牢',
    path: '/word',
    bg: 'bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/40 dark:to-violet-950/30',
    color: 'text-indigo-600 dark:text-indigo-400',
    iconBg: 'bg-indigo-100 dark:bg-indigo-500/20',
    accent: 'from-indigo-500 to-violet-500',
    border: 'border-indigo-200/50 dark:border-indigo-500/20',
    hoverBorder: 'hover:border-indigo-400/60 dark:hover:border-indigo-400/40',
    glow: 'group-hover:shadow-indigo-200/60 dark:group-hover:shadow-indigo-500/20',
  },
  {
    icon: BookOpen,
    title: '阅读',
    desc: '沉浸阅读，逐句精听',
    path: '/reading',
    bg: 'bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30',
    color: 'text-emerald-600 dark:text-emerald-400',
    iconBg: 'bg-emerald-100 dark:bg-emerald-500/20',
    accent: 'from-emerald-500 to-teal-500',
    border: 'border-emerald-200/50 dark:border-emerald-500/20',
    hoverBorder: 'hover:border-emerald-400/60 dark:hover:border-emerald-400/40',
    glow: 'group-hover:shadow-emerald-200/60 dark:group-hover:shadow-emerald-500/20',
  },
  {
    icon: Monitor,
    title: '语料中心',
    desc: '视频语料，沉浸学习',
    path: '/listening',
    bg: 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30',
    color: 'text-amber-600 dark:text-amber-400',
    iconBg: 'bg-amber-100 dark:bg-amber-500/20',
    accent: 'from-amber-500 to-orange-500',
    border: 'border-amber-200/50 dark:border-amber-500/20',
    hoverBorder: 'hover:border-amber-400/60 dark:hover:border-amber-400/40',
    glow: 'group-hover:shadow-amber-200/60 dark:group-hover:shadow-amber-500/20',
  },
  {
    icon: Target,
    title: '训练中心',
    desc: '专项训练，全面提升',
    path: '/training',
    bg: 'bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/40 dark:to-pink-950/30',
    color: 'text-rose-600 dark:text-rose-400',
    iconBg: 'bg-rose-100 dark:bg-rose-500/20',
    accent: 'from-rose-500 to-pink-500',
    border: 'border-rose-200/50 dark:border-rose-500/20',
    hoverBorder: 'hover:border-rose-400/60 dark:hover:border-rose-400/40',
    glow: 'group-hover:shadow-rose-200/60 dark:group-hover:shadow-rose-500/20',
  },
]

function scrollToWordbooks() {
  const element = document.getElementById('wordbooks')
  if (element) {
    const offset = 80
    const top = element.getBoundingClientRect().top + window.scrollY - offset
    window.scrollTo({ top, behavior: 'smooth' })
  }
}

export default function Features() {
  const navigate = useNavigate()

  const handleClick = (feature) => {
    if (feature.path === '/word') {
      scrollToWordbooks()
    } else {
      navigate(feature.path)
    }
  }

  return (
    <section className="w-full py-12 px-4 bg-slate-50 dark:bg-slate-950/50 transition-colors">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f, i) => {
            const Icon = f.icon
            return (
              <div
                key={i}
                onClick={() => handleClick(f)}
                className={`group relative overflow-hidden ${f.bg} rounded-2xl p-5 border ${f.border} ${f.hoverBorder} hover:shadow-lg ${f.glow} hover:-translate-y-1 transition-all duration-300 cursor-pointer`}
              >
                <span className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${f.accent}`} />
                <div className={`w-10 h-10 rounded-xl ${f.iconBg} ${f.color} flex items-center justify-center mb-3`}>
                  <Icon className="w-5 h-5" strokeWidth={2.2} />
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
                  {f.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {f.desc}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
