// errorHandler 单元测试：挂在临时 express app 上直测中间件本体。
// 覆盖：5xx 隐藏内部错误细节（防 SQL 报错/栈片段泄漏）与 4xx 透传 message、
//       message 缺省兜底、无 status 默认 500、服务端日志仍记录真实错误。
// logger 注入 fake（require.cache 方式，原因见 auth.test.js 头注释）。

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

const errorHandler = require('./errorHandler')

function makeApp(throwingHandler) {
  const app = express()
  app.get('/boom', throwingHandler)
  app.use(errorHandler)
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('5xx：隐藏内部错误信息', () => {
  it('status=500 带敏感 message → 只回通用文案，不回传内部细节', async () => {
    const err = new Error("Unknown column 'password_hash' in users (sql fragment: SELECT ...)")
    err.status = 500
    const res = await supertest(
      makeApp(() => {
        throw err
      })
    ).get('/boom')
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: '服务器内部错误，请稍后再试' })
    expect(res.body.error).not.toMatch(/password_hash/)
  })

  it('status=503 等其他 5xx → 同样只回通用文案', async () => {
    const err = new Error('redis connection refused')
    err.status = 503
    const res = await supertest(
      makeApp(() => {
        throw err
      })
    ).get('/boom')
    expect(res.status).toBe(503)
    expect(res.body).toEqual({ error: '服务器内部错误，请稍后再试' })
  })

  it('无 status 的普通 Error → 默认按 500 处理', async () => {
    const res = await supertest(
      makeApp(() => {
        throw new Error('boom')
      })
    ).get('/boom')
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: '服务器内部错误，请稍后再试' })
    expect(res.body.error).not.toBe('boom')
  })

  it('5xx 也记录服务端日志（含真实 message 与 status），便于 pm2 logs 排查', async () => {
    const err = new Error('internal detail xyz')
    err.status = 500
    await supertest(
      makeApp(() => {
        throw err
      })
    ).get('/boom')
    expect(fakeLogger.error).toHaveBeenCalledTimes(1)
    expect(fakeLogger.error.mock.calls[0][0]).toMatchObject({
      msg: 'internal detail xyz',
      status: 500,
    })
    expect(fakeLogger.error.mock.calls[0][1]).toBe('[Error]')
  })
})

describe('4xx：透传 message', () => {
  it('status=404 带 message → 原样透传给客户端', async () => {
    const err = new Error('语料不存在')
    err.status = 404
    const res = await supertest(
      makeApp(() => {
        throw err
      })
    ).get('/boom')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: '语料不存在' })
  })

  it('status=400 无 message → 兜底「请求处理失败」', async () => {
    const err = { status: 400 }
    const res = await supertest(
      makeApp(() => {
        throw err
      })
    ).get('/boom')
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: '请求处理失败' })
  })

  it('4xx 同样写服务端日志', async () => {
    const err = new Error('bad input')
    err.status = 422
    await supertest(
      makeApp(() => {
        throw err
      })
    ).get('/boom')
    expect(fakeLogger.error).toHaveBeenCalledTimes(1)
    expect(fakeLogger.error.mock.calls[0][0]).toMatchObject({ msg: 'bad input', status: 422 })
  })
})
