/**
 * Streak 打卡计算工具
 * @param {Object} dailyMap - { "YYYY-MM-DD": totalSeconds } 合并后的每日总学习秒数
 * @param {number} dailyGoalMinutes - 每日目标分钟数（来自 useProfileStore）
 * @returns {Object} streak 信息
 */
export function calculateStreak(dailyMap, dailyGoalMinutes = 30) {
  const today = new Date()
  const todayStr = dayKey(today)

  // 判断某天是否有学习
  function hasStudy(dateStr) {
    return (dailyMap[dateStr] || 0) > 0
  }

  // 1. 计算当前连续天数（从今天往回数）
  let current = 0
  let d = new Date(today)
  while (true) {
    const key = dayKey(d)
    if (hasStudy(key)) {
      current++
      d.setDate(d.getDate() - 1)
    } else {
      break
    }
  }

  // 2. 自然周保护：如果今天没学，检查本周是否已缺 1 天
  //    如果本周还没缺过，streak 不算断（给用户一天宽限）
  if (!hasStudy(todayStr) && current === 0) {
    const weekStart = getMonday(today)
    let missedThisWeek = 0
    for (let i = 0; i < 7; i++) {
      const wd = new Date(weekStart)
      wd.setDate(weekStart.getDate() + i)
      if (wd > today) break
      if (!hasStudy(dayKey(wd))) missedThisWeek++
    }
    if (missedThisWeek <= 1) {
      // 本周只缺了今天（或更少），streak 继续算昨天往前的
      d = new Date(today)
      d.setDate(d.getDate() - 1)
      while (hasStudy(dayKey(d))) {
        current++
        d.setDate(d.getDate() - 1)
      }
    }
  }

  // 3. 计算最长连续天数
  let longest = current
  const allDates = Object.keys(dailyMap).sort()
  if (allDates.length > 0) {
    let tempStreak = 0
    let prevDate = null
    for (const dateStr of allDates) {
      if (!hasStudy(dateStr)) continue
      if (prevDate && isConsecutive(prevDate, dateStr)) {
        tempStreak++
      } else {
        tempStreak = 1
      }
      longest = Math.max(longest, tempStreak)
      prevDate = dateStr
    }
  }

  // 4. 本周打卡圆点（周一到周日）
  const weekStart = getMonday(today)
  const weeklyDots = Array.from({ length: 7 }, (_, i) => {
    const wd = new Date(weekStart)
    wd.setDate(weekStart.getDate() + i)
    return wd <= today && hasStudy(dayKey(wd))
  })

  // 5. 今日目标进度
  const todayGoalSeconds = dailyMap[todayStr] || 0
  const todayGoalTarget = dailyGoalMinutes * 60
  const todayProgress = Math.min(1, todayGoalSeconds / todayGoalTarget)

  return { current, longest, weeklyDots, todayGoalSeconds, todayGoalTarget, todayProgress }
}

function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getMonday(d) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function isConsecutive(a, b) {
  const da = new Date(a), db = new Date(b)
  const diff = (db - da) / 86400000
  return diff === 1
}
