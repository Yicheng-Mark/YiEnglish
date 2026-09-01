// createRateLimiter（内存版 API 限流中间件）单元测试。
// 用 vi.useFakeTimers 控制 Date.now 与定时器，覆盖：计数超限、窗口过期重置、
// 不同 key（IP / x-forwarded-for）相互独立、redis driver 显式拒绝。

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
const { createRateLimiter } = require('./apiRateLimit')

function makeReq(ip, xff) {
  const req = { headers: {} }
  if (ip !== undefined) req.ip = ip
  if (xff !== undefined) req.headers['x-forwarded-for'] = xff
  return req
}

function makeRes() {
  const res = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

function call(limiter, req) {
  const res = makeRes()
  const next = vi.fn()
  limiter(req, res, next)
  return { res, next }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('createRateLimiter · memory driver', () => {
  it('窗口内第 max 次仍放行，第 max+1 次 429', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3, message: '太频繁了' })
    for (let i = 0; i < 3; i++) {
      const { next } = call(limiter, makeReq('1.1.1.1'))
      expect(next).toHaveBeenCalledTimes(1)
    }
    const { res, next } = call(limiter, makeReq('1.1.1.1'))
    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(429)
    expect(res.json).toHaveBeenCalledWith({ error: '太频繁了' })
  })

  it('窗口过期后计数重置，再次放行', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2 })
    call(limiter, makeReq('1.1.1.1'))
    call(limiter, makeReq('1.1.1.1'))
    expect(call(limiter, makeReq('1.1.1.1')).next).not.toHaveBeenCalled()

    vi.advanceTimersByTime(60_001)
    const { next } = call(limiter, makeReq('1.1.1.1'))
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('不同 IP 计数相互独立', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 })
    expect(call(limiter, makeReq('1.1.1.1')).next).toHaveBeenCalledTimes(1)
    expect(call(limiter, makeReq('2.2.2.2')).next).toHaveBeenCalledTimes(1)
    expect(call(limiter, makeReq('1.1.1.1')).next).not.toHaveBeenCalled()
  })

  it('无 req.ip 时回退 x-forwarded-for 首段作为 key', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 })
    expect(call(limiter, makeReq(undefined, '9.9.9.9, 10.0.0.1')).next).toHaveBeenCalledTimes(1)
    // 同 XFF 首段 → 已超限
    expect(call(limiter, makeReq(undefined, '9.9.9.9, 8.8.8.8')).next).not.toHaveBeenCalled()
    // 不同 XFF 首段 → 独立计数
    expect(call(limiter, makeReq(undefined, '7.7.7.7')).next).toHaveBeenCalledTimes(1)
  })

  it('ip 与 xff 均缺失时用 127.0.0.1 兜底 key', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 })
    expect(call(limiter, makeReq(undefined, undefined)).next).toHaveBeenCalledTimes(1)
    expect(call(limiter, makeReq(undefined, undefined)).next).not.toHaveBeenCalled()
  })

  it('redis driver 未实现，显式抛错（防止多实例下误用假性限流）', () => {
    expect(() => createRateLimiter({ windowMs: 1000, max: 1, driver: 'redis' })).toThrow(/redis/i)
  })
})
