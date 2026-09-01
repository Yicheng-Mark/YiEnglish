// 前端错误上报路由测试：控制字符净化（防 pm2 日志注入）、类型白名单、
// 空消息静默 204、永不 500。logger 注入 fake 以断言输出内容。

import { describe, it, expect, beforeEach, vi } from 'vitest'
const express = require('express')
const supertest = require('supertest')

const fakeLogger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() }

function injectCache(modulePath, exports) {
  const resolved = require.resolve(modulePath)
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports,
    paths: [],
    children: [],
  }
}
injectCache('../utils/logger', fakeLogger)

const clientErrorRouter = require('./clientError')

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/client-error', clientErrorRouter)
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/client-error', () => {
  it('合法上报 → 204 且 logger.warn 输出结构化字段', async () => {
    const res = await supertest(makeApp())
      .post('/api/client-error')
      .send({ type: 'error', message: 'boom at line 1', href: 'https://x.dev/word', ua: 'Mozilla' })
    expect(res.status).toBe(204)
    expect(fakeLogger.warn).toHaveBeenCalledTimes(1)
    const [fields, tag] = fakeLogger.warn.mock.calls[0]
    expect(tag).toBe('[client-error]')
    expect(fields).toMatchObject({
      type: 'error',
      message: 'boom at line 1',
      href: 'https://x.dev/word',
      ua: 'Mozilla',
    })
  })

  it('未知 type → 归为 unknown', async () => {
    await supertest(makeApp())
      .post('/api/client-error')
      .send({ type: 'evil', message: 'x'.repeat(10) })
    const [fields] = fakeLogger.warn.mock.calls[0]
    expect(fields.type).toBe('unknown')
  })

  it('message 剥离 C0 控制字符与换行（防日志注入），tab/\\v 折叠为空格', async () => {
    await supertest(makeApp())
      .post('/api/client-error')
      .send({ type: 'error', message: 'a\nb\u0000c\td\u000be' })
    const [fields] = fakeLogger.warn.mock.calls[0]
    // \n 与 \u0000 直接丢弃，\t 与 \u000b 折叠为空格
    expect(fields.message).toBe('abc d e')
  })

  it('stack 保留换行（keepNewline）并截断到 1500', async () => {
    await supertest(makeApp())
      .post('/api/client-error')
      .send({
        type: 'error',
        message: 'boom',
        stack: 'Error: boom\n  at f\n  at g' + 'x'.repeat(2000),
      })
    const [fields] = fakeLogger.warn.mock.calls[0]
    expect(fields.stack).toContain('Error: boom\n')
    expect(fields.stack.length).toBeLessThanOrEqual(1500)
  })

  it('message 超长截断到 500', async () => {
    await supertest(makeApp())
      .post('/api/client-error')
      .send({ type: 'error', message: 'y'.repeat(800) })
    const [fields] = fakeLogger.warn.mock.calls[0]
    expect(fields.message.length).toBe(500)
  })

  it('message 缺失/为空/非字符串 → 204 且不写日志', async () => {
    const r1 = await supertest(makeApp()).post('/api/client-error').send({ type: 'error' })
    const r2 = await supertest(makeApp())
      .post('/api/client-error')
      .send({ type: 'error', message: '   ' })
    const r3 = await supertest(makeApp())
      .post('/api/client-error')
      .send({ type: 'error', message: 12345 })
    expect([r1.status, r2.status, r3.status]).toEqual([204, 204, 204])
    expect(fakeLogger.warn).not.toHaveBeenCalled()
  })

  it('非 JSON body（express json 解析失败）→ 不由本路由兜底为 500 也无碍', async () => {
    const res = await supertest(makeApp())
      .post('/api/client-error')
      .set('Content-Type', 'application/json')
      .send('not-json{')
    // express.json() 抛 400 由上层默认错误处理，clientError 自身 catch 兜底策略只覆盖 handler 内异常
    expect([204, 400]).toContain(res.status)
  })
})
