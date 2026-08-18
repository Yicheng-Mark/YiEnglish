// review 路由测试：supertest + require.cache 注入 mock（server/ 是 CommonJS，见 auth.test.js 头注）。
//
// 覆盖点：
// - POST /add 的 wordName/dictId 校验（word_name VARCHAR(255)、dict_id VARCHAR(50)）
// - POST /upsert 的输入规整：缺 wordName/超长跳过、数值夹取、无效时间戳回退
//   （回归：修复前 NaN/超长直接进 SQL 触发驱动层 500，整批失败）
import { describe, it, expect, beforeEach, vi } from 'vitest'
const express = require('express')
const supertest = require('supertest')

const USER_ID = 1

const mockExecute = vi.fn()
const mockQuery = vi.fn()
const fakePool = { execute: mockExecute, query: mockQuery }
const fakeAuthMiddleware = (req, res, next) => {
  req.userId = USER_ID
  next()
}

function injectFakeModule(relPath, exports) {
  const resolved = require.resolve(relPath)
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports,
    paths: [],
    children: [],
  }
}

injectFakeModule('../db', fakePool)
injectFakeModule('../middleware/auth', fakeAuthMiddleware)

const reviewRouter = require('./review')

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/review', reviewRouter)
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ error: err.message || '服务器错误' })
  })
  return app
}

beforeEach(() => {
  mockExecute.mockReset().mockResolvedValue([[], []])
  mockQuery.mockReset().mockResolvedValue([[], []])
})

describe('POST /api/review/add', () => {
  function addCall() {
    return mockExecute.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT IGNORE INTO user_review_cards')
    )
  }

  it('wordName 非字符串或超长 → 400（回归：修复前脏输入触发驱动层 500）', async () => {
    const bad = await supertest(makeApp())
      .post('/api/review/add')
      .send({ wordName: { inject: 1 } })
    expect(bad.status).toBe(400)

    const long = await supertest(makeApp())
      .post('/api/review/add')
      .send({ wordName: 'x'.repeat(256) })
    expect(long.status).toBe(400)
  })

  it('合法请求 → trim 后入库，超长 dictId 截断到 50', async () => {
    const res = await supertest(makeApp())
      .post('/api/review/add')
      .send({ wordName: '  apple ', dictId: 'd'.repeat(80) })
    expect(res.status).toBe(200)
    expect(addCall()[1]).toEqual([USER_ID, 'apple', 'd'.repeat(50)])
  })
})

describe('POST /api/review/upsert', () => {
  function upsertRows() {
    const call = mockQuery.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO user_review_cards')
    )
    return call ? call[1][0] : null
  }

  it('缺 wordName/超长条目跳过，脏数值夹取、无效时间戳回退（回归：修复前直接 500）', async () => {
    const res = await supertest(makeApp())
      .post('/api/review/upsert')
      .send({
        cards: [
          {
            wordName: 'apple',
            dictId: 'cet4',
            nextReview: 1750000000000,
            interval: 3,
            easeFactor: 2.5,
            repetitions: 2,
            lastReviewAt: 1749000000000,
            lastQuality: 5,
          },
          {
            wordName: 'bad',
            // 各字段均为脏值
            nextReview: 'not-a-number',
            interval: 'x',
            easeFactor: {},
            repetitions: -5,
            lastReviewAt: 'garbage',
            lastQuality: 999,
          },
          { dictId: 'cet4' }, // 缺 wordName → 跳过
          { wordName: 'y'.repeat(300), dictId: 'cet4' }, // 超长 → 跳过
        ],
      })
    expect(res.status).toBe(200)

    const rows = upsertRows()
    expect(rows).toHaveLength(2)
    // 行布局：[userId, wordName(1), dictId(2), nextReview(3), interval(4), easeFactor(5), repetitions(6), lastReviewAt(7), lastQuality(8)]
    expect(rows[0][1]).toBe('apple')
    expect(rows[0][3]).toBeInstanceOf(Date)
    expect(rows[0][3].getTime()).toBe(1750000000000)
    expect(rows[0][7].getTime()).toBe(1749000000000)

    // 脏值回退默认并夹到列宽
    expect(rows[1][3]).toBeInstanceOf(Date) // nextReview 无效 → 默认明天
    expect(rows[1][4]).toBe(1) // interval 非数字 → 1
    expect(rows[1][5]).toBe(2.5) // easeFactor 非数字 → 2.5
    expect(rows[1][6]).toBe(0) // repetitions 负数 → 0
    expect(rows[1][7]).toBeNull() // lastReviewAt 无效 → null
    expect(rows[1][8]).toBe(255) // lastQuality 999 → TINYINT 上限
  })

  it('cards 非数组/为空 → 400；超过 2000 张 → 400', async () => {
    const bad = await supertest(makeApp()).post('/api/review/upsert').send({ cards: 'nope' })
    expect(bad.status).toBe(400)

    const empty = await supertest(makeApp()).post('/api/review/upsert').send({ cards: [] })
    expect(empty.status).toBe(400)

    const tooMany = await supertest(makeApp())
      .post('/api/review/upsert')
      .send({ cards: Array.from({ length: 2001 }, (_, i) => ({ wordName: `w${i}` })) })
    expect(tooMany.status).toBe(400)
    expect(tooMany.body.error).toBe('单次最多同步 2000 张卡片')
  })

  it('全部条目非法 → 跳过 INSERT 仍返回 200', async () => {
    const res = await supertest(makeApp())
      .post('/api/review/upsert')
      .send({ cards: [{ nope: 1 }] })
    expect(res.status).toBe(200)
    expect(upsertRows()).toBeNull()
  })
})

describe('GET /api/review', () => {
  it('返回规整后的卡片映射', async () => {
    mockExecute.mockResolvedValue([
      [
        {
          word_name: 'apple',
          dict_id: 'cet4',
          next_review: '2026-06-21 00:00:00',
          interval_days: 3,
          ease_factor: 2.5,
          repetitions: 2,
          last_review_at: null,
          last_quality: 5,
        },
      ],
      [],
    ])
    const res = await supertest(makeApp()).get('/api/review')
    expect(res.status).toBe(200)
    expect(res.body.cards.apple).toMatchObject({
      wordName: 'apple',
      dictId: 'cet4',
      interval: 3,
      easeFactor: 2.5,
      repetitions: 2,
      lastReviewAt: null,
      lastQuality: 5,
    })
  })
})
