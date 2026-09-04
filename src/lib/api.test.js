import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * api.js 测试
 *
 * 关键被测逻辑（src/lib/api.js）：
 * - apiFetch：封装 fetch；401 且 data.code === 'TOKEN_EXPIRED' 时触发 silentRefresh，
 *   refresh 成功 → 重试一次原请求（透明刷新）；失败 → 抛错。
 * - silentRefresh：模块级 isRefreshing + refreshSubscribers 队列做并发去重，
 *   多个并发请求只触发一次真正的 refresh，其余挂起等待同一结果。
 *
 * 隔离策略：api.js 用模块级 let isRefreshing，测试间必须重置。
 * 用 vi.resetModules() + 动态 import('./api') 每个用例拿到全新模块实例。
 *
 * 环境为 node（vitest.config.js 默认），无 window/fetch，全部 stub。
 */

// 构造一个最小可用的 fetch Response 形状。api.js 只读 res.status / res.ok / res.json()。
function makeResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

// 401 + TOKEN_EXPIRED 的标准响应
function tokenExpiredResponse() {
  return makeResponse({ code: 'TOKEN_EXPIRED', error: 'token expired' }, 401)
}

// refresh 成功 / 失败的响应
function refreshOkResponse() {
  return makeResponse({ ok: true }, 200)
}
function refreshFailResponse() {
  return makeResponse({ ok: false }, 401)
}

let fetchMock
let toastMock
let dispatchEventSpy

beforeEach(async () => {
  vi.resetModules()

  // 全局 fetch mock：默认返回 404，每个用例按需覆盖实现
  fetchMock = vi.fn(() => Promise.resolve(makeResponse({}, 404)))
  vi.stubGlobal('fetch', fetchMock)

  // window：api.js 在 401 分支里调 window.dispatchEvent(new CustomEvent(...))，
  // 还可能调 toast（TRIAL_EXPIRED）。node 环境没有 window，这里造一个最小桩。
  dispatchEventSpy = vi.fn()
  toastMock = vi.fn()
  const fakeCustomEvent = vi.fn((type, init) => ({ type, ...(init || {}) }))
  vi.stubGlobal('window', {
    dispatchEvent: dispatchEventSpy,
  })
  vi.stubGlobal('CustomEvent', fakeCustomEvent)

  // sonner 的 toast：通过 vi.mock 替换，需在动态 import 之前注册
  vi.doMock('sonner', () => ({ toast: { error: toastMock } }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.doUnmock('sonner')
  vi.restoreAllMocks()
})

describe('apiFetch', () => {
  it('200 成功时直接返回 Response（不触发 refresh）', async () => {
    const { apiFetch } = await import('./api')
    const payload = { hello: 'world' }
    fetchMock.mockResolvedValueOnce(makeResponse(payload, 200))

    const res = await apiFetch('/api/progress/123')
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual(payload)
    // 只调了一次 fetch（原请求），没有 refresh
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/progress/123',
      expect.objectContaining({ credentials: 'include' })
    )
  })

  it('401 TOKEN_EXPIRED → silentRefresh 成功 → 透明重试原请求成功', async () => {
    const { apiFetch } = await import('./api')
    const okBody = { data: [1, 2, 3] }

    // 调用序列：原请求 401 → refresh 200 → 重试 200
    fetchMock
      .mockResolvedValueOnce(tokenExpiredResponse()) // 第 1 次：/api/progress/123 → 401
      .mockResolvedValueOnce(refreshOkResponse()) // 第 2 次：/api/auth/refresh → 200
      .mockResolvedValueOnce(makeResponse(okBody, 200)) // 第 3 次：重试 → 200

    const res = await apiFetch('/api/progress/123')
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual(okBody)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    // 第 2 次调用应是 refresh 端点
    expect(fetchMock.mock.calls[1][0]).toBe('/api/auth/refresh')
    expect(fetchMock.mock.calls[1][1]).toEqual(
      expect.objectContaining({ method: 'POST', credentials: 'include' })
    )
    // 重试请求的 path 仍是原 path
    expect(fetchMock.mock.calls[2][0]).toBe('/api/progress/123')
    // 没有派发 auth:unauthorized（因为刷新成功了）
    expect(dispatchEventSpy).not.toHaveBeenCalled()
  })

  it('refresh 成功但原请求重试仍为 401 → 广播未授权且不再重复刷新', async () => {
    const { apiFetch } = await import('./api')

    fetchMock
      .mockResolvedValueOnce(tokenExpiredResponse())
      .mockResolvedValueOnce(refreshOkResponse())
      .mockResolvedValueOnce(makeResponse({ error: '新会话仍无效' }, 401))

    await expect(apiFetch('/api/progress/123')).rejects.toThrow('新会话仍无效')

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/auth/refresh')).toHaveLength(1)
    expect(dispatchEventSpy).toHaveBeenCalledTimes(1)
    expect(dispatchEventSpy.mock.calls[0][0].type).toBe('auth:unauthorized')
  })

  it('401 TOKEN_EXPIRED 且 refresh 也失败 → 抛错，不无限重试', async () => {
    const { apiFetch } = await import('./api')

    // 原请求 401 → refresh 401（失败）
    fetchMock
      .mockResolvedValueOnce(tokenExpiredResponse())
      .mockResolvedValueOnce(refreshFailResponse())

    await expect(apiFetch('/api/progress/123')).rejects.toThrow('token expired')

    // 原请求 1 + refresh 1 = 2 次。绝不应该有重试（refresh 失败后直接抛错）。
    expect(fetchMock).toHaveBeenCalledTimes(2)
    // 失败路径会派发 auth:unauthorized 事件
    expect(dispatchEventSpy).toHaveBeenCalledTimes(1)
    const event = dispatchEventSpy.mock.calls[0][0]
    expect(event.type).toBe('auth:unauthorized')
  })

  it('并发去重：多个请求同时 401 时只触发一次 refresh，全部重试成功', async () => {
    const { apiFetch } = await import('./api')

    // 控制时序：用可手动 resolve 的 promise 让 refresh 卡住，
    // 确保 3 个请求都在 refresh 进行中（isRefreshing=true）时进入订阅队列。
    let resolveRefresh
    const refreshGate = new Promise((r) => {
      resolveRefresh = r
    })

    // 调用顺序规划（共 2 + 3 = 5 次 fetch 调用）：
    //  1) reqA 原请求 → 401
    //  2) reqB 原请求 → 401
    //  3) reqC 原请求 → 401
    //  此时三个 silentRefresh 调用：第一个真正发 refresh（第 4 次 fetch），后两个挂起订阅
    //  4) /api/auth/refresh → 卡在 refreshGate，手动 resolve(成功响应) 后返回 200
    //  5/6/7) 三个请求各自重试 → 200（注意：refresh 本身是 1 次 fetch，重试是 3 次 fetch）
    fetchMock.mockImplementation((url) => {
      if (url === '/api/auth/refresh') {
        // 真正的 refresh：等 gate 放行后返回成功
        return refreshGate.then(() => refreshOkResponse())
      }
      // 默认：前 3 次返回 401 TOKEN_EXPIRED，之后返回 200
      const callsSoFar = fetchMock.mock.calls.length
      if (callsSoFar <= 3) {
        return Promise.resolve(tokenExpiredResponse())
      }
      return Promise.resolve(makeResponse({ retried: true }, 200))
    })

    // 同时发起三个请求（不等 await）
    const pA = apiFetch('/api/a')
    const pB = apiFetch('/api/b')
    const pC = apiFetch('/api/c')

    // 排空微任务队列：三个原请求都要 await res.json()、await silentRefresh()，
    // 才能全部进入 silentRefresh 的"首个发 refresh / 其余订阅"状态。多排几轮确保充分推进。
    for (let i = 0; i < 10; i++) {
      await Promise.resolve()
    }

    // 此时 refresh 已触发（1 次），三个原请求已完成第一次 fetch 并挂起等 refresh
    const refreshCallsBefore = fetchMock.mock.calls.filter(
      (c) => c[0] === '/api/auth/refresh'
    ).length
    expect(refreshCallsBefore).toBe(1) // 核心：只触发了一次 refresh

    // 放行 refresh
    resolveRefresh()

    const [resA, resB, resC] = await Promise.all([pA, pC, pB])
    expect(resA.status).toBe(200)
    expect(resB.status).toBe(200)
    expect(resC.status).toBe(200)
    expect(await resA.json()).toEqual({ retried: true })

    // refresh 端点从头到尾只被调用 1 次 —— 并发去重的核心断言
    const refreshCallsAfter = fetchMock.mock.calls.filter(
      (c) => c[0] === '/api/auth/refresh'
    ).length
    expect(refreshCallsAfter).toBe(1)

    // 总 fetch 次数：3 次原请求 + 1 次 refresh + 3 次重试 = 7
    expect(fetchMock).toHaveBeenCalledTimes(7)
  })

  it('并发去重：refresh 失败时所有挂起请求一起拒绝，无重试', async () => {
    const { apiFetch } = await import('./api')

    let resolveRefresh
    const refreshGate = new Promise((r) => {
      resolveRefresh = r
    })

    fetchMock.mockImplementation((url) => {
      if (url === '/api/auth/refresh') {
        return refreshGate.then(() => refreshFailResponse()) // refresh 失败
      }
      return Promise.resolve(tokenExpiredResponse()) // 所有原请求都 401
    })

    const pA = apiFetch('/api/a')
    const pB = apiFetch('/api/b')

    await Promise.resolve()
    await Promise.resolve()

    resolveRefresh()

    await expect(pA).rejects.toThrow('token expired')
    await expect(pB).rejects.toThrow('token expired')

    // refresh 只调 1 次；两个请求都失败，无重试
    const refreshCalls = fetchMock.mock.calls.filter((c) => c[0] === '/api/auth/refresh').length
    expect(refreshCalls).toBe(1)
    // 2 次原请求 + 1 次 refresh = 3 次，没有任何重试 fetch
    expect(fetchMock).toHaveBeenCalledTimes(3)
    // 两个失败请求都派发了 auth:unauthorized
    expect(dispatchEventSpy).toHaveBeenCalledTimes(2)
  })

  it('非 401 错误码（如 500）直接返回 Response，不触发 refresh', async () => {
    const { apiFetch } = await import('./api')
    fetchMock.mockResolvedValueOnce(makeResponse({ error: 'server down' }, 500))

    const res = await apiFetch('/api/progress/123')
    expect(res.status).toBe(500)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(dispatchEventSpy).not.toHaveBeenCalled()
  })

  it('401 但 code 不是 TOKEN_EXPIRED → 不刷新，直接抛错并派发事件', async () => {
    const { apiFetch } = await import('./api')
    fetchMock.mockResolvedValueOnce(makeResponse({ code: 'TRIAL_EXPIRED', error: '试用结束' }, 401))

    await expect(apiFetch('/api/x')).rejects.toThrow('试用结束')
    expect(fetchMock).toHaveBeenCalledTimes(1) // 没有 refresh
    expect(dispatchEventSpy).toHaveBeenCalledTimes(1)
    expect(toastMock).toHaveBeenCalledTimes(1) // TRIAL_EXPIRED 会 toast.error
  })

  it('fetch 抛出网络错误时透传（不吞异常、不 refresh）', async () => {
    const { apiFetch } = await import('./api')
    const netErr = new TypeError('Failed to fetch')
    fetchMock.mockRejectedValueOnce(netErr)

    await expect(apiFetch('/api/progress/123')).rejects.toBe(netErr)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    // 网络错误发生在 apiFetch 的第一次 fetch，没机会进入 refresh 分支
    expect(dispatchEventSpy).not.toHaveBeenCalled()
  })

  it('refresh 自身网络异常 → 视为刷新失败，原请求抛错', async () => {
    const { apiFetch } = await import('./api')
    fetchMock
      .mockResolvedValueOnce(tokenExpiredResponse()) // 原请求 401
      .mockRejectedValueOnce(new TypeError('network')) // refresh 网络炸了

    await expect(apiFetch('/api/progress/123')).rejects.toThrow('token expired')
    // 原请求 + refresh 尝试 = 2 次，无重试
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(dispatchEventSpy).toHaveBeenCalledTimes(1)
  })
})
