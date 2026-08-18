// @vitest-environment jsdom
// reviewCards 的 SM-2 间隔重复算法测试（标准 EF 更新公式）。
//
// 覆盖：q=5/4/3 的 EF 变化、EF 下限 1.3、q<3 重置、间隔 1→6→×EF 阶梯、
// legacy 卡片缺字段时的默认值兜底（防 NaN 扩散）。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const { apiUpsertReviewCards, apiAddReviewCard, apiFetchReviewCards } = vi.hoisted(() => ({
  apiUpsertReviewCards: vi.fn().mockResolvedValue(),
  apiAddReviewCard: vi.fn().mockResolvedValue(),
  apiFetchReviewCards: vi.fn().mockResolvedValue({ cards: [] }),
}))

vi.mock('../lib/api-review', () => ({
  apiUpsertReviewCards,
  apiAddReviewCard,
  apiFetchReviewCards,
}))
vi.mock('./idb.js', () => ({
  idbPut: vi.fn().mockResolvedValue(),
  idbDelete: vi.fn().mockResolvedValue(),
  idbClear: vi.fn().mockResolvedValue(),
  idbBulkPut: vi.fn().mockResolvedValue(),
}))

import { updateReviewCard, getDueReviewCount, getTotalReviewCount } from './reviewCards.js'

const KEY = 'lingoforge_review_cards'

function seedCard(name, card) {
  localStorage.setItem(KEY, JSON.stringify({ cards: { [name]: card } }))
}

function readCard(name) {
  return JSON.parse(localStorage.getItem(KEY)).cards[name]
}

// 一张已复习过两轮的成熟卡：下次应进入 interval × EF 档
function matureCard(overrides = {}) {
  return { dictId: 'cet4', interval: 6, easeFactor: 2.5, repetitions: 2, ...overrides }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-06-20T12:00:00'))
  localStorage.clear()
  apiUpsertReviewCards.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('updateReviewCard（标准 SM-2）', () => {
  it('q=5：EF +0.1，间隔进入 ×EF 档', () => {
    seedCard('apple', matureCard())
    updateReviewCard('apple', 5)
    const card = readCard('apple')
    expect(card.repetitions).toBe(3)
    expect(card.easeFactor).toBeCloseTo(2.6)
    expect(card.interval).toBe(Math.round(6 * 2.6)) // 16
  })

  it('q=4：EF 不变（0.1 - 1×(0.08+0.02) = 0）', () => {
    seedCard('apple', matureCard())
    updateReviewCard('apple', 4)
    const card = readCard('apple')
    expect(card.easeFactor).toBeCloseTo(2.5)
    expect(card.repetitions).toBe(3)
  })

  it('q=3：EF 下降 0.14（标准算法，修复前不降）', () => {
    seedCard('apple', matureCard())
    updateReviewCard('apple', 3)
    const card = readCard('apple')
    expect(card.easeFactor).toBeCloseTo(2.36)
    expect(card.repetitions).toBe(3) // q>=3 仍算通过
  })

  it('EF 有 1.3 下限', () => {
    seedCard('apple', matureCard({ easeFactor: 1.3 }))
    updateReviewCard('apple', 3)
    expect(readCard('apple').easeFactor).toBeCloseTo(1.3)
  })

  it('q<3：重置 repetitions 与 interval，EF 保留', () => {
    seedCard('apple', matureCard())
    updateReviewCard('apple', 2)
    const card = readCard('apple')
    expect(card.repetitions).toBe(0)
    expect(card.interval).toBe(1)
    expect(card.easeFactor).toBeCloseTo(2.5)
  })

  it('首次复习（repetitions 0→1）间隔为 1 天，第二次为 6 天', () => {
    seedCard('apple', matureCard({ repetitions: 0, interval: 0 }))
    updateReviewCard('apple', 5)
    expect(readCard('apple').interval).toBe(1)

    updateReviewCard('apple', 5)
    expect(readCard('apple').interval).toBe(6)
    expect(readCard('apple').repetitions).toBe(2)
  })

  it('legacy 卡片缺 interval/easeFactor/repetitions 时兜底默认值，不产生 NaN', () => {
    seedCard('apple', { dictId: 'cet4' }) // 老数据形态：只有 dictId
    updateReviewCard('apple', 5)
    const card = readCard('apple')
    expect(card.interval).toBe(1)
    expect(card.repetitions).toBe(1)
    expect(card.easeFactor).toBeCloseTo(2.6)
    expect(Number.isFinite(card.nextReview)).toBe(true)
  })

  it('更新后同步上报服务端，携带最新 SM-2 字段', () => {
    seedCard('apple', matureCard())
    updateReviewCard('apple', 5)
    expect(apiUpsertReviewCards).toHaveBeenCalledTimes(1)
    const payload = apiUpsertReviewCards.mock.calls[0][0][0]
    expect(payload).toMatchObject({
      wordName: 'apple',
      interval: 16,
      repetitions: 3,
      lastQuality: 5,
    })
    expect(payload.easeFactor).toBeCloseTo(2.6)
  })
})

describe('getCards · 非 migrated 路径的损坏数据兜底', () => {
  it('localStorage 为数组/空对象等畸形形状 → 返回空卡组而非抛错（回归：修复前 Object.values(undefined) 让 Home 整页崩）', () => {
    // 老版本数组格式（未设置 _migrated 标记，走非 migrated 分支）
    localStorage.setItem(KEY, JSON.stringify(['apple', 'dog']))
    expect(() => getDueReviewCount()).not.toThrow()
    expect(getDueReviewCount()).toBe(0)
    expect(getTotalReviewCount()).toBe(0)

    // 缺 cards 字段的对象
    localStorage.setItem(KEY, JSON.stringify({}))
    expect(() => getDueReviewCount()).not.toThrow()
    expect(getTotalReviewCount()).toBe(0)

    // JSON 解析失败（半损坏）
    localStorage.setItem(KEY, '{broken')
    expect(() => getDueReviewCount()).not.toThrow()
  })

  it('正常形状不受影响', () => {
    seedCard('apple', { dictId: 'cet4', interval: 999, easeFactor: 2.5, repetitions: 9 })
    expect(getTotalReviewCount()).toBe(1)
  })
})
