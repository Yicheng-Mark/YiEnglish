import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

function pad(n) { return String(n).padStart(2, '0') }
function dateKey(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}` }
function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate() }

export default function StudyCalendar({ store }) {
  const today = new Date()
  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate())

  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedKey, setSelectedKey] = useState(null)

  const days = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1)
    // Monday=0 ... Sunday=6
    let startWeekday = firstDay.getDay() - 1
    if (startWeekday < 0) startWeekday = 6

    const total = daysInMonth(viewYear, viewMonth)
    const prevTotal = daysInMonth(viewYear, viewMonth - 1)

    const cells = []

    // Previous month padding
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = prevTotal - i
      const m = viewMonth - 1
      const y = m < 0 ? viewYear - 1 : viewYear
      const actualM = m < 0 ? 11 : m
      const key = dateKey(y, actualM, d)
      cells.push({ day: d, key, current: false })
    }

    // Current month
    for (let d = 1; d <= total; d++) {
      const key = dateKey(viewYear, viewMonth, d)
      cells.push({ day: d, key, current: true })
    }

    // Next month padding
    const remaining = (7 - (cells.length % 7)) % 7
    for (let d = 1; d <= remaining; d++) {
      const m = viewMonth + 1
      const y = m > 11 ? viewYear + 1 : viewYear
      const actualM = m > 11 ? 0 : m
      const key = dateKey(y, actualM, d)
      cells.push({ day: d, key, current: false })
    }

    return cells
  }, [viewYear, viewMonth])

  const studyMap = useMemo(() => {
    const map = {}
    for (const cell of days) {
      const sec = store.getDailySeconds(cell.key) + store.getDailyTypingSeconds(cell.key) + store.getDailyListeningSeconds(cell.key)
      map[cell.key] = Math.round(sec / 60)
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.dailyReadingSeconds, store.dailyTypingSeconds, store.dailyListeningSeconds, viewYear, viewMonth])

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const handleClick = (key) => {
    setSelectedKey(prev => prev === key ? null : key)
  }

  const selectedMinutes = selectedKey ? studyMap[selectedKey] : null
  const selectedDay = selectedKey ? parseInt(selectedKey.split('-')[2]) : null
  const selectedMonth = selectedKey ? parseInt(selectedKey.split('-')[1]) : null

  return (
    <div className="bg-surface dark:bg-surface-dark rounded-2xl p-5 md:p-6 shadow-sm border border-gray-100/80 dark:border-white/[0.06]">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-5">
        <button onClick={prevMonth} className="p-1.5 rounded-lg text-content-secondary dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h3 className="text-base font-semibold text-content dark:text-gray-100">
          {viewYear}年{viewMonth + 1}月
        </h3>
        <button onClick={nextMonth} className="p-1.5 rounded-lg text-content-secondary dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-2">
        {WEEKDAYS.map(w => (
          <div key={w} className="text-center text-xs text-content-tertiary dark:text-gray-500 font-medium py-1">
            {w}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {days.map((cell) => {
          const isToday = cell.key === todayKey
          const minutes = studyMap[cell.key] || 0
          const hasStudy = cell.current && minutes > 0
          const isSelected = selectedKey === cell.key

          return (
            <button
              key={cell.key}
              onClick={() => handleClick(cell.key)}
              className={`relative flex flex-col items-center justify-center py-1.5 rounded-lg transition-all ${
                cell.current
                  ? 'text-content dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.06]'
                  : 'text-content-tertiary/40 dark:text-gray-600'
              } ${isSelected && cell.current ? 'bg-primary/10 dark:bg-primary/15 ring-1 ring-primary/30' : ''} ${
                isToday ? '' : ''
              }`}
            >
              <span className={`relative text-sm leading-none ${
                isToday
                  ? 'font-semibold text-green-600 dark:text-green-400'
                  : ''
              }`}>
                {cell.current ? cell.day : ''}
                {hasStudy && (
                  <Check className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-4 text-green-500 drop-shadow-sm" strokeWidth={3} />
                )}
              </span>
            </button>
          )
        })}
      </div>

      {/* Selected date info */}
      {selectedKey && (
        <div className="mt-4 text-sm text-center text-content-secondary dark:text-gray-400 animate-page-fade-in">
          {selectedMonth}月{selectedDay}日：
          {selectedMinutes > 0
            ? <span className="font-semibold text-content dark:text-gray-200"> {selectedMinutes} </span>
            : <span className="text-content-tertiary dark:text-gray-500"> 未学习</span>
          }
          {selectedMinutes > 0 && ' 分钟学习'}
        </div>
      )}
    </div>
  )
}
