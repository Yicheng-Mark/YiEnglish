// @vitest-environment jsdom
// chat-engine 的 SSE 流解析与 abort 语义测试。
//
// 覆盖：
// - 流式 token/reasoning 聚合与 [DONE] 终止
// - 上游 error 帧 → onError
// - 401 广播 auth:unauthorized（与 lib/api.js 行为一致）
// - 429 带 isRateLimit/used/limit 标记
// - 用户主动停止（abort）静默结束，不弹错误（回归：修复前停止必现假"请求超时"气泡）
// - 120s 超时 → onError 提示重试（与用户停止区分）
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createChatStream } from './chat-engine'

function dataFrame(obj) {
  return `data: ${JSON.stringify(obj)}\n\n`
}

function sseResponse({ status = 200, chunks = [], text } = {}) {
  const stream = new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(new TextEncoder().encode(c))
      controller.close()
    },
  })
  return {
    ok: status >= 200 && status < 300,
    status,
    body: stream,
    text: async () => text ?? '',
  }
}

// 收集回调事件的辅助
function makeHandlers() {
  const ev = { tokens: [], reasonings: [], done: 0, errors: [] }
  return {
    ev,
    handlers: {
      onToken: (t) => ev.tokens.push(t),
      onReasoning: (t) => ev.reasonings.push(t),
      onDone: () => {
        ev.done++
      },
      onError: (e) => ev.errors.push(e),
    },
  }
}

// 等待回调队列排空（流式解析是异步链）
async function flush(ms = 20) {
  await new Promise((r) => setTimeout(r, ms))
}

// fetch 返回一个"永不完成"的响应体，只有 abort 时以 AbortError 拒绝
function neverEndingFetch() {
  return vi.fn(
    (_url, opts) =>
      new Promise((_resolve, reject) => {
        opts.signal.addEventListener('abort', () => {
          const err = new Error('The operation was aborted')
          err.name = 'AbortError'
          reject(err)
        })
      })
  )
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('createChatStream · SSE 解析', () => {
  it('流式聚合 content/reasoning，[DONE] 后 onDone 且不报错', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sseResponse({
          chunks: [
            dataFrame({ choices: [{ delta: { reasoning_content: '思考中' } }] }),
            dataFrame({ choices: [{ delta: { content: '你' } }] }),
            dataFrame({ choices: [{ delta: { content: '好' } }] }),
            'data: [DONE]\n\n',
          ],
        })
      )
    )
    const { ev, handlers } = makeHandlers()
    createChatStream({ messages: [{ role: 'user', content: 'hi' }], ...handlers })
    await flush()
    expect(ev.tokens.join('')).toBe('你好')
    expect(ev.reasonings.join('')).toBe('思考中')
    expect(ev.done).toBe(1)
    expect(ev.errors).toHaveLength(0)
  })

  it('上游 error 帧 → onError 携带错误信息', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          sseResponse({ chunks: [dataFrame({ error: 'DeepSeek API 错误: 401' })] })
        )
    )
    const { ev, handlers } = makeHandlers()
    createChatStream({ messages: [{ role: 'user', content: 'hi' }], ...handlers })
    await flush()
    expect(ev.errors).toHaveLength(1)
    expect(ev.errors[0].message).toBe('DeepSeek API 错误: 401')
  })

  it('流结束（无 [DONE]）也算完成', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          sseResponse({ chunks: [dataFrame({ choices: [{ delta: { content: 'x' } }] })] })
        )
    )
    const { ev, handlers } = makeHandlers()
    createChatStream({ messages: [{ role: 'user', content: 'hi' }], ...handlers })
    await flush()
    expect(ev.done).toBe(1)
  })
})

describe('createChatStream · 非 2xx 响应', () => {
  it('401 → 广播 auth:unauthorized 并 onError', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          sseResponse({ status: 401, text: JSON.stringify({ error: '请先登录' }) })
        )
    )
    const fired = []
    window.addEventListener('auth:unauthorized', () => fired.push(1))
    const { ev, handlers } = makeHandlers()
    createChatStream({ messages: [{ role: 'user', content: 'hi' }], ...handlers })
    await flush()
    expect(fired).toHaveLength(1)
    expect(ev.errors[0].message).toBe('请先登录')
  })

  it('429 → err 带 isRateLimit/used/limit 标记', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          sseResponse({
            status: 429,
            text: JSON.stringify({ error: '次数已达上限', used: 10, limit: 10 }),
          })
        )
    )
    const { ev, handlers } = makeHandlers()
    createChatStream({ messages: [{ role: 'user', content: 'hi' }], ...handlers })
    await flush()
    expect(ev.errors).toHaveLength(1)
    expect(ev.errors[0].isRateLimit).toBe(true)
    expect(ev.errors[0].used).toBe(10)
    expect(ev.errors[0].limit).toBe(10)
  })
})

describe('createChatStream · abort 语义', () => {
  it('用户主动停止 → 静默结束，不触发 onError（回归：修复前停止必现假"请求超时"气泡）', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', neverEndingFetch())
    const { ev, handlers } = makeHandlers()
    const gen = createChatStream({ messages: [{ role: 'user', content: 'hi' }], ...handlers })

    gen.abort()
    await vi.advanceTimersByTimeAsync(500)

    expect(ev.errors).toHaveLength(0)
    expect(ev.done).toBe(0)
  })

  it('120s 超时 → onError 提示重试', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', neverEndingFetch())
    const { ev, handlers } = makeHandlers()
    createChatStream({ messages: [{ role: 'user', content: 'hi' }], ...handlers })

    await vi.advanceTimersByTimeAsync(120000)

    expect(ev.errors).toHaveLength(1)
    expect(ev.errors[0].message).toBe('请求超时，请检查网络后重试')
  })
})
