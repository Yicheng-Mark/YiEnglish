// @vitest-environment jsdom
// reviewCards 的 SM-2 间隔重复算法 + 防抖持久化测试。
//
// 覆盖：q=5/4/3 的 EF 变化、EF 下限 1.3、q<3 重置、间隔 1→6→×EF 阶梯、
// legacy 卡片缺字段时的默认值兜底（防 NaN 扩散）、
// 落盘防抖合批（打字高频写不卡顿）、内存优先读、pagehide 兜底 flush。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const { apiUpsertReviewCards, apiAddReviewCard, apiFetchReviewCards, apiDeleteReviewCard } =
  vi.hoisted(() => ({
    apiUpsertReviewCards: vi.fn().mockResolvedValue(),
    apiAddReviewCard: vi.fn().mockResolvedValue(),
    apiFetchReviewCards: vi.fn().mockResolvedValue({ cards: [] }),
    apiDeleteReviewCard: vi.fn().mockResolvedValue(),
  }))

// 词表同步缓存的状态：getDueReviewCount 徽标口径用例按需注入
const dictMapState = vi.hoisted(() => ({ syncMap: null }))
vi.mock('./dictWordMap.js', () => ({
  buildDictWordMap: vi.fn().mockResolvedValue(new Map()),
  getDictWordMapSync: vi.fn(() => dictMapState.syncMap),
}))
vi.mock('../lib/api-review', () => ({
  apiUpsertReviewCards,
  apiAddReviewCard,
  apiFetchReviewCards,
  apiDeleteReviewCard,
}))
vi.mock('./idb.js', () => ({
  idbPut: vi.fn().mockResolvedValue(),
  idbDelete: vi.fn().mockResolvedValue(),
  idbClear: vi.fn().mockResolvedValue(),
  idbBulkPut: vi.fn().mockResolvedValue(),
}))

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

// reviewCards 是模块级单例（_cache / persistTimer），
// 逐用例重载模块拿干净状态；注意旧实例挂在 window 上的 pagehide 兜底监听不会消失，
// 但注册顺序保证最新实例的 flush 最后执行、写入最终生效。
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-06-20T12:00:00'))
  localStorage.clear()
  vi.resetModules()
  apiUpsertReviewCards.mockClear()
  apiAddReviewCard.mockClear()
  apiFetchReviewCards.mockClear().mockResolvedValue({ cards: [] })
  apiDeleteReviewCard.mockClear().mockResolvedValue()
  dictMapState.syncMap = null
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

// 防抖窗口（PERSIST_DEBOUNCE_MS）到期，localStorage 完成落盘
async function flushDebounce(mod) {
  await vi.advanceTimersByTimeAsync(2000)
  return mod
}

describe('updateReviewCard（标准 SM-2）', () => {
  it('q=5：EF +0.1，间隔进入 ×EF 档', async () => {
    seedCard('apple', matureCard())
    const { updateReviewCard } = await import('./reviewCards.js')
    updateReviewCard('apple', 5)
    await flushDebounce()
    const card = readCard('apple')
    expect(card.repetitions).toBe(3)
    expect(card.easeFactor).toBeCloseTo(2.6)
    expect(card.interval).toBe(Math.round(6 * 2.6)) // 16
  })

  it('q=4：EF 不变（0.1 - 1×(0.08+0.02) = 0）', async () => {
    seedCard('apple', matureCard())
    const { updateReviewCard } = await import('./reviewCards.js')
    updateReviewCard('apple', 4)
    await flushDebounce()
    const card = readCard('apple')
    expect(card.easeFactor).toBeCloseTo(2.5)
    expect(card.repetitions).toBe(3)
  })

  it('q=3：EF 下降 0.14（标准算法，修复前不降）', async () => {
    seedCard('apple', matureCard())
    const { updateReviewCard } = await import('./reviewCards.js')
    updateReviewCard('apple', 3)
    await flushDebounce()
    const card = readCard('apple')
    expect(card.easeFactor).toBeCloseTo(2.36)
    expect(card.repetitions).toBe(3) // q>=3 仍算通过
  })

  it('EF 有 1.3 下限', async () => {
    seedCard('apple', matureCard({ easeFactor: 1.3 }))
    const { updateReviewCard } = await import('./reviewCards.js')
    updateReviewCard('apple', 3)
    await flushDebounce()
    expect(readCard('apple').easeFactor).toBeCloseTo(1.3)
  })

  it('q<3：重置 repetitions 与 interval，EF 保留', async () => {
    seedCard('apple', matureCard())
    const { updateReviewCard } = await import('./reviewCards.js')
    updateReviewCard('apple', 2)
    await flushDebounce()
    const card = readCard('apple')
    expect(card.repetitions).toBe(0)
    expect(card.interval).toBe(1)
    expect(card.easeFactor).toBeCloseTo(2.5)
  })

  it('首次复习（repetitions 0→1）间隔为 1 天，第二次为 6 天', async () => {
    seedCard('apple', matureCard({ repetitions: 0, interval: 0 }))
    const { updateReviewCard } = await import('./reviewCards.js')
    updateReviewCard('apple', 5)
    await flushDebounce()
    expect(readCard('apple').interval).toBe(1)

    updateReviewCard('apple', 5)
    await flushDebounce()
    expect(readCard('apple').interval).toBe(6)
    expect(readCard('apple').repetitions).toBe(2)
  })

  it('legacy 卡片缺 interval/easeFactor/repetitions 时兜底默认值，不产生 NaN', async () => {
    seedCard('apple', { dictId: 'cet4' }) // 老数据形态：只有 dictId
    const { updateReviewCard } = await import('./reviewCards.js')
    updateReviewCard('apple', 5)
    await flushDebounce()
    const card = readCard('apple')
    expect(card.interval).toBe(1)
    expect(card.repetitions).toBe(1)
    expect(card.easeFactor).toBeCloseTo(2.6)
    expect(Number.isFinite(card.nextReview)).toBe(true)
  })

  it('更新后同步上报服务端，携带最新 SM-2 字段', async () => {
    seedCard('apple', matureCard())
    const { updateReviewCard } = await import('./reviewCards.js')
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
  it('localStorage 为数组/空对象等畸形形状 → 返回空卡组而非抛错（回归：修复前 Object.values(undefined) 让 Home 整页崩）', async () => {
    // 老版本数组格式（未设置 _migrated 标记）
    localStorage.setItem(KEY, JSON.stringify(['apple', 'dog']))
    const { getDueReviewCount, getTotalReviewCount } = await import('./reviewCards.js')
    expect(() => getDueReviewCount()).not.toThrow()
    expect(getDueReviewCount()).toBe(0)
    expect(getTotalReviewCount()).toBe(0)
  })

  it('缺 cards 字段的对象 / JSON 解析失败（半损坏）→ 兜底空卡组', async () => {
    localStorage.setItem(KEY, JSON.stringify({}))
    const { getDueReviewCount } = await import('./reviewCards.js')
    expect(() => getDueReviewCount()).not.toThrow()

    // 半损坏 JSON：重载模块后 ensureCache 重新解析，同样兜底不抛错
    localStorage.setItem(KEY, '{broken')
    vi.resetModules()
    const mod2 = await import('./reviewCards.js')
    expect(() => mod2.getDueReviewCount()).not.toThrow()
  })

  it('正常形状不受影响', async () => {
    seedCard('apple', { dictId: 'cet4', interval: 999, easeFactor: 2.5, repetitions: 9 })
    const { getTotalReviewCount } = await import('./reviewCards.js')
    expect(getTotalReviewCount()).toBe(1)
  })
})

describe('防抖持久化（回归：修复前每个新词/每次复习都全量 stringify + setItem）', () => {
  it('内存优先：add 后未满防抖窗口，读取立即可见，localStorage 尚未写入', async () => {
    const { addWordToReview, getTotalReviewCount } = await import('./reviewCards.js')
    addWordToReview('apple', 'cet4')
    expect(getTotalReviewCount()).toBe(1)
    expect(localStorage.getItem(KEY)).toBe(null)
  })

  it('同一防抖窗口内多次变更只落盘一次，数据完整', async () => {
    const { addWordToReview, updateReviewCard } = await import('./reviewCards.js')
    addWordToReview('apple', 'cet4')
    addWordToReview('dog', 'cet4')
    updateReviewCard('apple', 5)
    await flushDebounce()
    const data = JSON.parse(localStorage.getItem(KEY))
    expect(Object.keys(data.cards).sort()).toEqual(['apple', 'dog'])
    expect(data.cards.apple.repetitions).toBe(1)
  })

  it('pagehide 兜底 flush：未满防抖窗口离开页面也不丢数据', async () => {
    const { addWordToReview } = await import('./reviewCards.js')
    addWordToReview('apple', 'cet4')
    expect(localStorage.getItem(KEY)).toBe(null)
    window.dispatchEvent(new Event('pagehide'))
    expect(JSON.parse(localStorage.getItem(KEY)).cards.apple).toBeTruthy()
  })

  it('removeFromReviewCards 破坏性操作立即落盘，防抖窗口内删除不复活', async () => {
    const { addWordToReview, removeFromReviewCards } = await import('./reviewCards.js')
    addWordToReview('apple', 'cet4')
    removeFromReviewCards('apple')
    expect(JSON.parse(localStorage.getItem(KEY)).cards).toEqual({})
    await Promise.resolve()
    await Promise.resolve()
    expect(apiDeleteReviewCard).toHaveBeenCalledWith('apple')
  })

  it('同词 add 未完成时 delete 排队等待，避免旧 add 在删除后复活卡片', async () => {
    let resolveAdd
    const pendingAdd = new Promise((resolve) => {
      resolveAdd = resolve
    })
    apiAddReviewCard.mockReturnValueOnce(pendingAdd)
    const { addWordToReview, removeFromReviewCards } = await import('./reviewCards.js')

    addWordToReview('apple', 'cet4')
    expect(apiAddReviewCard).toHaveBeenCalledWith('apple', 'cet4')

    removeFromReviewCards('apple')
    expect(apiDeleteReviewCard).not.toHaveBeenCalled()

    resolveAdd()
    await pendingAdd
    await Promise.resolve()

    expect(apiDeleteReviewCard).toHaveBeenCalledTimes(1)
    expect(apiDeleteReviewCard).toHaveBeenCalledWith('apple')
  })

  it('addWordToReview 触发服务端同步，重复添加同词被跳过', async () => {
    const { addWordToReview } = await import('./reviewCards.js')
    addWordToReview('apple', 'cet4')
    addWordToReview('apple', 'cet4')
    expect(apiAddReviewCard).toHaveBeenCalledTimes(1)
    expect(apiAddReviewCard).toHaveBeenCalledWith('apple', 'cet4')
  })

  it('syncReviewCardsFromServer 覆盖内存并立即落盘', async () => {
    const serverCards = {
      apple: {
        wordName: 'apple',
        dictId: 'cet4',
        nextReview: 1,
        interval: 1,
        easeFactor: 2.5,
        repetitions: 0,
      },
    }
    apiFetchReviewCards.mockResolvedValue({ cards: serverCards })
    const { syncReviewCardsFromServer, getTotalReviewCount } = await import('./reviewCards.js')
    await syncReviewCardsFromServer()
    expect(getTotalReviewCount()).toBe(1)
    expect(JSON.parse(localStorage.getItem(KEY)).cards.apple).toBeTruthy()
  })
})

describe('resetReviewCardsCache（登出断开内存态）', () => {
  it('登出重置后，排队中未执行的旧会话 mutation 被丢弃，不写进新会话', async () => {
    let resolveAdd
    const pendingAdd = new Promise((resolve) => {
      resolveAdd = resolve
    })
    apiAddReviewCard.mockReturnValueOnce(pendingAdd)
    const { addWordToReview, removeFromReviewCards, resetReviewCardsCache } =
      await import('./reviewCards.js')

    addWordToReview('apple', 'cet4') // add 请求在途
    removeFromReviewCards('apple') // delete 排队等待 add 完成
    resetReviewCardsCache() // 登出

    resolveAdd() // 在途 add 完成 → 排队的 delete 因 epoch 变化被丢弃
    await pendingAdd
    await Promise.resolve()

    expect(apiDeleteReviewCard).not.toHaveBeenCalled()
  })

  it('重置只断开内存缓存（下次从 localStorage 重新 bootstrap），不删用户数据', async () => {
    seedCard('apple', matureCard())
    const { resetReviewCardsCache, getTotalReviewCount } = await import('./reviewCards.js')
    expect(getTotalReviewCount()).toBe(1)

    resetReviewCardsCache()

    expect(JSON.parse(localStorage.getItem(KEY)).cards.apple).toBeTruthy()
    expect(getTotalReviewCount()).toBe(1) // 重新 bootstrap 后计数恢复
  })
})

describe('getDueReviewWords（出题数据源）', () => {
  it('到期卡反查词典：查不到释义或 trans 为空的词被过滤，不出空白题', async () => {
    // seedCard 是整键覆盖，多卡一次写入
    localStorage.setItem(
      KEY,
      JSON.stringify({
        cards: {
          known: { wordName: 'known', dictId: 'cet4', nextReview: Date.now() - 1000 },
          unknown: { wordName: 'unknown', dictId: 'chef', nextReview: Date.now() - 2000 },
          emptytrans: { wordName: 'emptytrans', dictId: 'cet4', nextReview: Date.now() - 500 },
        },
      })
    )
    const { buildDictWordMap } = await import('./dictWordMap.js')
    const mocked = vi.mocked(buildDictWordMap)
    mocked.mockResolvedValue(
      new Map([
        ['known', { name: 'known', trans: ['[n] 已知'] }],
        ['emptytrans', { name: 'emptytrans', trans: [] }],
      ])
    )

    const { getDueReviewWords } = await import('./reviewCards.js')
    const words = await getDueReviewWords()

    // unknown（词典查不到）与 emptytrans（trans 空）都不出题，known 按到期序输出
    expect(words.map((w) => w.name)).toEqual(['known'])
    expect(words[0].trans).toEqual(['[n] 已知'])
  })

  it('全部查不到 → 返回空数组（页面走空状态而非空白卡片）', async () => {
    seedCard('unknown', { wordName: 'unknown', dictId: 'chef', nextReview: Date.now() - 1000 })
    const { getDueReviewWords } = await import('./reviewCards.js')
    expect(await getDueReviewWords()).toEqual([])
  })
})

describe('getDueReviewCount（到期徽标口径）', () => {
  // seedCard 是整键覆盖，多卡一次写入
  function seedDueCards(cards) {
    localStorage.setItem(KEY, JSON.stringify({ cards }))
  }

  it('词表缓存未构建 → 不排除任何到期卡（历史行为）', async () => {
    seedDueCards({
      known: { wordName: 'known', dictId: 'cet4', nextReview: Date.now() - 1000 },
      unknown: { wordName: 'unknown', dictId: 'chef', nextReview: Date.now() - 2000 },
    })
    const { getDueReviewCount } = await import('./reviewCards.js')
    expect(getDueReviewCount()).toBe(2)
  })

  it('词表缓存就位 → 与 getDueReviewWords 同口径，查不到释义的卡不计入徽标', async () => {
    seedDueCards({
      known: { wordName: 'known', dictId: 'cet4', nextReview: Date.now() - 1000 },
      unknown: { wordName: 'unknown', dictId: 'chef', nextReview: Date.now() - 2000 },
      emptytrans: { wordName: 'emptytrans', dictId: 'cet4', nextReview: Date.now() - 500 },
    })
    // 模拟「词表已在别处构建完成」：徽标走同一覆盖判断，被过滤的卡永远无法作答、
    // SM-2 永不推进，计入只会让徽标残留虚数（点进去却无词可复习）
    dictMapState.syncMap = new Map([
      ['known', { name: 'known', trans: ['[n] 已知'] }],
      ['emptytrans', { name: 'emptytrans', trans: [] }],
    ])
    const { getDueReviewCount } = await import('./reviewCards.js')
    expect(getDueReviewCount()).toBe(1)
  })
})
