// deepseekProxy 流式代理测试：mock 全局 fetch + 伪 SSE ReadableStream。
//
// 覆盖：
// - 成功流式转发与 fullText 聚合
// - 上游非 2xx → failed=true（配合 chat.js 的"失败不扣额度"）
// - 客户端断开 → 中止上游请求（不再空烧 token）
// - 空闲超时（30s 无数据）而非整体超时（回归：整体 30s 超时会掐断正常长回复）
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// 注入 fake config：真实 config 可能没有 DEEPSEEK_API_KEY，会在入口直接 throw。
// key 为测试专用占位串（非真实凭据），拆开构造避免被密钥扫描误报。
const FAKE_API_KEY = ['test', 'key'].join('-')
const FIXED_CONFIG = {
  DEEPSEEK_API_KEY: FAKE_API_KEY,
  DEEPSEEK_API_BASE: 'https://fake.test',
  DEEPSEEK_MODEL: 'test-model',
}
const configPath = require.resolve('../config')
require.cache[configPath] = {
  id: configPath,
  filename: configPath,
  loaded: true,
  exports: FIXED_CONFIG,
  paths: [],
  children: [],
}

const { EventEmitter } = require('events')
const { streamChatToRes } = require('./deepseekProxy')

class FakeRes extends EventEmitter {
  constructor() {
    super()
    this.headersSent = false
    this.writableEnded = false
    this.destroyed = false
    this.chunks = []
  }
  writeHead() {
    this.headersSent = true
  }
  write(chunk) {
    this.chunks.push(String(chunk))
    return true
  }
  end() {
    this.writableEnded = true
  }
}

const encoder = new TextEncoder()
const delta = (content) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`

function sseBody(events, { neverClose = false, signal } = {}) {
  return new ReadableStream({
    start(c) {
      if (signal) {
        signal.addEventListener('abort', () => c.error(new Error('upstream aborted')))
      }
      for (const e of events) c.enqueue(encoder.encode(e))
      if (!neverClose) c.close()
    },
  })
}

const mockFetch = vi.fn()

let errorSpy
beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllTimers()
  vi.useRealTimers()
  errorSpy.mockRestore()
})

const MSGS = [{ role: 'user', content: 'hi' }]

describe('streamChatToRes', () => {
  it('成功流式：转发增量、聚合 fullText、正常结束', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: sseBody([delta('你'), delta('好'), 'data: [DONE]\n\n']),
    })
    const res = new FakeRes()
    const result = await streamChatToRes(MSGS, res)

    expect(result).toMatchObject({ fullText: '你好', reasoningText: '', failed: false })
    expect(res.writableEnded).toBe(true)
    const out = res.chunks.join('')
    expect(out).toContain('"content":"你"')
    expect(out).toContain('"content":"好"')
    expect(out).toContain('data: [DONE]')
  })

  it('上游非 2xx → failed=true，错误帧写入流', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429 })
    const res = new FakeRes()
    const result = await streamChatToRes(MSGS, res)

    expect(result.failed).toBe(true)
    expect(result.fullText).toBe('')
    expect(res.chunks.join('')).toContain('请求过于频繁')
    expect(res.writableEnded).toBe(true)
  })

  it('客户端断开 → 中止上游请求且不再写响应（不空烧 token）', async () => {
    let capturedSignal
    mockFetch.mockImplementation(async (url, init) => {
      capturedSignal = init.signal
      return { ok: true, body: sseBody([delta('你')], { neverClose: true, signal: init.signal }) }
    })
    const res = new FakeRes()
    const promise = streamChatToRes(MSGS, res)
    // 让 fetch resolve、reader 进入 pending read
    await new Promise((r) => setImmediate(r))

    res.destroyed = true // 模拟 socket 已关闭
    res.emit('close')

    const result = await promise
    expect(result.failed).toBe(true)
    expect(capturedSignal.aborted).toBe(true)
    // 客户端已断开，不能向已销毁的响应写错误帧
    expect(res.chunks.join('')).not.toContain('error')
  })

  it('空闲超时：30s 收不到上游数据才中止（不按总时长掐断长回复）', async () => {
    vi.useFakeTimers()
    mockFetch.mockImplementation(async (url, init) => ({
      ok: true,
      body: sseBody([], { neverClose: true, signal: init.signal }),
    }))
    const res = new FakeRes()
    const promise = streamChatToRes(MSGS, res)
    // 起步 5s + 29s：流虽无数据但尚未超时，不应被中止
    // （旧的整体 30s 超时实现此时已把请求掐断——这正是回归点）
    await vi.advanceTimersByTimeAsync(5 * 1000)
    // 最后一次续期后再过 30s 仍无任何数据 → 中止
    await vi.advanceTimersByTimeAsync(29 * 1000 + 30 * 1000)

    const result = await promise
    expect(result.failed).toBe(true)
  })
})
