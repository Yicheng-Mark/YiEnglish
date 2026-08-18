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

describe('calculateStreak · 自然周宽限', () => {
  // TODAY = 2026-06-20 周六，本周为 06-15（周一）~ 06-21（周日）
  it('今天没学但本周只缺今天 → 宽限一天，streak 续算到昨天', () => {
    vi.setSystemTime(TODAY)
    const map = {
      '2026-06-15': 100,
      '2026-06-16': 100,
      '2026-06-17': 100,
      '2026-06-18': 100,
      '2026-06-19': 100,
    }
    const r = calculateStreak(map, 30)
    expect(r.current).toBe(5) // 从 06-19 往回连数 5 天
    expect(r.longest).toBe(5) // 宽限值与实际连续段一致，不虚高
  })

  it('本周已缺两天（今天 + 早前某天）→ 宽限不适用，current 归零', () => {
    vi.setSystemTime(TODAY)
    const map = {
      '2026-06-16': 100,
      '2026-06-17': 100,
      '2026-06-18': 100,
      '2026-06-19': 100,
    }
    const r = calculateStreak(map, 30) // 缺 06-15 与 06-20 两天
    expect(r.current).toBe(0)
    expect(r.longest).toBe(4) // 06-16~06-19 的历史最长段仍被统计
  })
})

describe('calculateStreak · longest 与 weeklyDots', () => {
  it('longest 统计与 current 无关的历史最长段', () => {
    vi.setSystemTime(TODAY)
    const map = {
      '2026-06-01': 100,
      '2026-06-02': 100,
      '2026-06-03': 100,
      '2026-06-04': 100,
      '2026-06-05': 100,
      '2026-06-19': 100,
      '2026-06-20': 100,
    }
    const r = calculateStreak(map, 30)
    expect(r.current).toBe(2)
    expect(r.longest).toBe(5)
  })

  it('weeklyDots 按周一到周日映射本周打卡（今天之后的日期恒为 false）', () => {
    vi.setSystemTime(TODAY)
    const map = { '2026-06-15': 100, '2026-06-17': 100, '2026-06-20': 100 }
    const r = calculateStreak(map, 30)
    // 周一✓ 周二✗ 周三✓ 周四✗ 周五✗ 周六(今天)✓ 周日(未来)✗
    expect(r.weeklyDots).toEqual([true, false, true, false, false, true, false])
  })
})
