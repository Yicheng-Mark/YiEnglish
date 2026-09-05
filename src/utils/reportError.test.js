// reportClientError 测试：轻量客户端错误上报（POST /api/client-error）。
// 覆盖：内存去重（同 type+message 只报一次）、seen 上限 50 条整体清空（防泄漏+老错误可重报）、
//       sendBeacon 优先、sendBeacon 不可用/返回 false 时 fetch keepalive 回退、
//       超长 message/stack 截断、整体绝不抛错。
// 模块内 seen Set 是模块级状态 → 每个用例 vi.resetModules() 后动态 import 取全新实例。
import { describe, it, expect, afterEach, vi } from 'vitest'

// 与被测模块保持同一套 ENDPOINT 计算逻辑（VITE_API_BASE_URL 未设置时为空串）
const API_BASE = import.meta.env.VITE_API_BASE_URL || ''
const ENDPOINT = `${API_BASE}/api/client-error`
const MAX = 2000

function stubEnv({ sendBeaconImpl, withBeacon = true } = {}) {
  const nav = { userAgent: 'test-ua' }
  if (withBeacon) nav.sendBeacon = vi.fn(sendBeaconImpl ?? (() => true))
  vi.stubGlobal('navigator', nav)
  vi.stubGlobal('location', { href: 'https://app.test/page' })
  vi.stubGlobal('fetch', vi.fn())
}

async function load() {
  vi.resetModules()
  return await import('./reportError.js')
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('sendBeacon 优先', () => {
  it('sendBeacon 可用且返回 true → 走 beacon，fetch 不被调用，payload 字段完整', async () => {
    stubEnv()
    const { reportClientError } = await load()

    reportClientError('runtime', new Error('boom'))

    const nav = navigator
    expect(nav.sendBeacon).toHaveBeenCalledTimes(1)
    expect(nav.sendBeacon.mock.calls[0][0]).toBe(ENDPOINT)
    const blob = nav.sendBeacon.mock.calls[0][1]
    const payload = JSON.parse(await blob.text())
    expect(payload.type).toBe('runtime')
    expect(payload.message).toBe('boom')
    expect(payload.href).toBe('https://app.test/page')
    expect(payload.ua).toBe('test-ua')
    expect(typeof payload.ts).toBe('number')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('error 为字符串 / null → message 取 String(error) 或 "unknown"', async () => {
    stubEnv()
    const { reportClientError } = await load()

    reportClientError('t1', 'plain fail')
    reportClientError('t2', null)

    const [p1, p2] = await Promise.all(
      navigator.sendBeacon.mock.calls.map(async (call) => JSON.parse(await call[1].text()))
    )
    expect(p1.message).toBe('plain fail')
    expect(p2.message).toBe('unknown')
  })
})

describe('去重与 seen 上限', () => {
  it('同 type+message 只报一次；type 不同视为不同错误', async () => {
    stubEnv()
    const { reportClientError } = await load()

    reportClientError('runtime', new Error('dup'))
    reportClientError('runtime', new Error('dup'))
    reportClientError('other', new Error('dup'))

    expect(navigator.sendBeacon).toHaveBeenCalledTimes(2)
  })

  it('SEEN_LIMIT=50：第 51 条新错误触发清空，老错误此后可重新上报（防 Set 无限增长）', async () => {
    stubEnv()
    const { reportClientError } = await load()

    // 前 50 条各自发送并进入 seen
    for (let i = 0; i < 50; i++) reportClientError('t', new Error('m' + i))
    expect(navigator.sendBeacon).toHaveBeenCalledTimes(50)

    // 与第 1 条重复 → 去重拦截
    reportClientError('t', new Error('m0'))
    expect(navigator.sendBeacon).toHaveBeenCalledTimes(50)

    // 第 51 条新错误 → seen.size 达上限 → 整体清空后发出
    reportClientError('t', new Error('m50'))
    expect(navigator.sendBeacon).toHaveBeenCalledTimes(51)

    // m0 已被清出 seen → 可再次上报
    reportClientError('t', new Error('m0'))
    expect(navigator.sendBeacon).toHaveBeenCalledTimes(52)
  })
})

describe('fetch keepalive 回退', () => {
  it('sendBeacon 不可用 → fetch POST + keepalive，body 为 JSON', async () => {
    stubEnv({ withBeacon: false })
    const { reportClientError } = await load()

    reportClientError('runtime', new Error('boom'))

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][0]).toBe(ENDPOINT)
    const init = fetch.mock.calls[0][1]
    expect(init.method).toBe('POST')
    expect(init.keepalive).toBe(true)
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(init.body).message).toBe('boom')
  })

  it('sendBeacon 返回 false（队列满等）→ 回退 fetch', async () => {
    stubEnv({ sendBeaconImpl: () => false })
    const { reportClientError } = await load()

    reportClientError('runtime', new Error('boom'))

    expect(navigator.sendBeacon).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})

describe('截断与健壮性', () => {
  it('message/stack 超过 2000 字符被截断', async () => {
    stubEnv({ sendBeaconImpl: () => false })
    const { reportClientError } = await load()

    const err = new Error('x'.repeat(2500))
    err.stack = 's'.repeat(3000)
    reportClientError('runtime', err)

    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.message).toHaveLength(MAX)
    expect(body.stack).toHaveLength(MAX)
  })

  it('navigator 整体缺失且 fetch 同步抛错 → reportClientError 也不抛（永不影响业务）', async () => {
    vi.stubGlobal('navigator', undefined)
    vi.stubGlobal('location', undefined)
    vi.stubGlobal('fetch', () => {
      throw new Error('fetch unavailable')
    })
    const { reportClientError } = await load()

    expect(() => reportClientError('runtime', new Error('boom'))).not.toThrow()
  })
})
