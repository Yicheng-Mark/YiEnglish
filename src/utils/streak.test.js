import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { calculateStreak } from './streak.js'

// streak 依赖 new Date() 取「今天」，用 fake timers 固定当前日期保证确定性
beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

// 固定「今天」为 2026-06-20（周六）
const TODAY = new Date('2026-06-20T12:00:00')

describe('calculateStreak', () => {
  it('今天有学习记录 → current 至少为 1', () => {
    vi.setSystemTime(TODAY)
    const r = calculateStreak({ '2026-06-20': 1800 }, 30)
    expect(r.current).toBe(1)
  })

  it('连续多天有记录 → current 累计', () => {
    vi.setSystemTime(TODAY)
    const map = { '2026-06-18': 100, '2026-06-19': 100, '2026-06-20': 100 }
    const r = calculateStreak(map, 30)
    expect(r.current).toBe(3)
  })

  it('中间断档 → current 只计到断档前', () => {
    vi.setSystemTime(TODAY)
    // 06-17 有、06-18 断、06-19/20 有 → 从今天往回：20✓19✓18✗停 → current=2
    const map = { '2026-06-17': 100, '2026-06-19': 100, '2026-06-20': 100 }
    const r = calculateStreak(map, 30)
    expect(r.current).toBe(2)
  })

  it('学习时长 >0 即算「有学习」（无论是否达标）', () => {
    vi.setSystemTime(TODAY)
    const r = calculateStreak({ '2026-06-20': 10 }, 30)
    expect(r.current).toBe(1) // 10s > 0 算学习
    expect(r.todayProgress).toBeLessThan(1) // 但未达 30min 目标
  })

  it('达到每日目标 → todayProgress = 1', () => {
    vi.setSystemTime(TODAY)
    const r = calculateStreak({ '2026-06-20': 1800 }, 30) // 1800s = 30min
    expect(r.todayProgress).toBe(1)
    expect(r.todayGoalSeconds).toBe(1800)
    expect(r.todayGoalTarget).toBe(1800)
  })

  it('超过目标 → todayProgress 封顶为 1', () => {
    vi.setSystemTime(TODAY)
    const r = calculateStreak({ '2026-06-20': 99999 }, 30)
    expect(r.todayProgress).toBe(1)
  })

  it('weeklyDots 长度为 7', () => {
    vi.setSystemTime(TODAY)
    const r = calculateStreak({}, 30)
    expect(r.weeklyDots).toHaveLength(7)
    expect(r.weeklyDots.every((d) => d === false)).toBe(true)
  })

  it('longest 至少等于 current', () => {
    vi.setSystemTime(TODAY)
    const map = { '2026-06-18': 100, '2026-06-19': 100, '2026-06-20': 100 }
    const r = calculateStreak(map, 30)
    expect(r.longest).toBeGreaterThanOrEqual(r.current)
  })
})
