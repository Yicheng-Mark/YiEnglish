import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, BookOpen, Calendar, Keyboard, Headphones, ArrowLeft } from 'lucide-react'
import { useReadingStore } from '../modules/reading/hooks/useReadingStore'
import StudyCalendar from '../components/StudyCalendar'

const WEEKDAY_LABEL = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function pad(n) {
  return String(n).padStart(2, '0')
}

function dayKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function StatsCard({ label, value, unit, Icon }) {
  return (
    <div className="bg-surface dark:bg-surface-dark rounded-2xl p-5 md:p-6 shadow-sm border border-gray-100/80 dark:border-white/[0.06]">
      <div className="flex items-start justify-between mb-6">
        <span className="text-sm text-content-secondary dark:text-gray-400">{label}</span>
        <span className="w-9 h-9 rounded-full flex items-center justify-center bg-primary/10 text-primary">
          <Icon className="w-[18px] h-[18px]" />
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl md:text-4xl font-bold text-content dark:text-gray-100 leading-none">
          {value}
        </span>
        {unit && (
          <span className="text-base text-content-secondary dark:text-gray-400">{unit}</span>
        )}
      </div>
    </div>
  )
}

function WeeklyChart({ days }) {
  const maxMinutes = Math.max(1, ...days.map((d) => d.minutes))
  const chartHeight = 160

  const barGradient = (d) => {
    if (d.isToday) return 'linear-gradient(to top, #6366f1, #a78bfa)'
    if (d.minutes > 0) return 'linear-gradient(to top, #34d399, #6ee7b7)'
    return undefined
  }

  return (
    <div className="bg-surface dark:bg-surface-dark rounded-2xl p-5 md:p-6 shadow-sm border border-gray-100/80 dark:border-white/[0.06]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-content-secondary dark:text-gray-400" />
          <h3 className="font-semibold text-content dark:text-gray-100">最近7天学习节奏</h3>
        </div>
        <span className="text-[10px] tracking-[0.18em] font-semibold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-white/[0.05] text-content-tertiary dark:text-gray-500">
          DAILY ACTIVITY
        </span>
      </div>

      <div className="flex items-end gap-3 md:gap-4" style={{ height: chartHeight }}>
        {days.map((d, i) => {
          const ratio = d.minutes / maxMinutes
          const heightPx = d.minutes > 0 ? Math.max(8, Math.round(ratio * (chartHeight - 24))) : 4
          const gradient = barGradient(d)
          return (
            <div key={d.key} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
              {d.minutes > 0 && (
                <span className="text-[10px] font-semibold text-content-secondary dark:text-gray-400">
                  {d.minutes}m
                </span>
              )}
              <div
                title={`${d.minutes} 分钟`}
                className="w-full rounded-t-lg"
                style={{
                  height: `${heightPx}px`,
                  animation: `barGrow 0.6s ease-out both`,
                  animationDelay: `${i * 80}ms`,
                  transformOrigin: 'bottom',
                }}
              >
                <div
                  className={`w-full h-full rounded-t-lg transition-all duration-200 hover:brightness-110 hover:scale-105 origin-bottom cursor-pointer ${
                    !gradient ? 'bg-gray-100 dark:bg-white/[0.04]' : ''
                  }`}
                  style={gradient ? { background: gradient } : undefined}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex gap-3 md:gap-4 mt-3">
        {days.map((d) => (
          <div
            key={`${d.key}-label`}
            className={`flex-1 text-center text-xs ${
              d.isToday
                ? 'text-primary font-medium'
                : 'text-content-tertiary dark:text-gray-500'
            }`}
          >
            {d.label}
          </div>
        ))}
      </div>

      <div className="mt-6 text-center text-sm text-content-secondary dark:text-gray-400">
        最近7天共学习 <span className="font-semibold text-content dark:text-gray-200">{days.reduce((s, d) => s + d.minutes, 0)}</span> 分钟
      </div>

      <style>{`
        @keyframes barGrow {
          from { transform: scaleY(0); }
          to { transform: scaleY(1); }
        }
      `}</style>
    </div>
  )
}

export default function Stats() {
  const navigate = useNavigate()
  const store = useReadingStore()

  const days = useMemo(() => {
    const today = new Date()
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today)
      d.setDate(today.getDate() - (6 - i))
      const key = dayKey(d)
      const seconds = store.getDailySeconds(key) + store.getDailyTypingSeconds(key) + store.getDailyListeningSeconds(key)
      return {
        key,
        label: WEEKDAY_LABEL[d.getDay()],
        minutes: Math.round(seconds / 60),
        isToday: i === 6,
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.dailyReadingSeconds, store.dailyTypingSeconds, store.dailyListeningSeconds])

  const totalReadingMinutes = Math.round(store.getTotalReadingSeconds() / 60)
  const totalTypingMinutes = Math.round(store.getTotalTypingSeconds() / 60)
  const totalListeningMinutes = Math.round(store.getTotalListeningSeconds() / 60)
  const totalMinutes = totalReadingMinutes + totalTypingMinutes + totalListeningMinutes

  return (
    <div className="min-h-screen animate-page-fade-in">
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-12">
        <header className="mb-8 md:mb-10">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-content-tertiary hover:text-primary hover:bg-primary-soft transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            返回列表
          </button>
          <h1 className="text-3xl md:text-4xl font-bold text-content dark:text-gray-100 mb-2">学习数据</h1>
          <p className="text-content-secondary dark:text-gray-400">让每一次进步都看得见。</p>
        </header>

        <div className="grid grid-cols-2 gap-4 md:gap-5 mb-6 md:mb-8">
          <StatsCard
            label="累计学习"
            value={totalMinutes}
            unit="m"
            Icon={Clock}
          />
          <StatsCard
            label="单词练习"
            value={totalTypingMinutes}
            unit="m"
            Icon={Keyboard}
          />
          <StatsCard
            label="阅读"
            value={totalReadingMinutes}
            unit="m"
            Icon={BookOpen}
          />
          <StatsCard
            label="语料中心"
            value={totalListeningMinutes}
            unit="m"
            Icon={Headphones}
          />
        </div>

        <StudyCalendar store={store} />
        <WeeklyChart days={days} />
      </div>
    </div>
  )
}
