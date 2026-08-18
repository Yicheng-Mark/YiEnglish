// style 路由测试：POST 可选字段校验与 PATCH 标准一致（回归：POST 曾是绕过口）。
import { describe, it, expect, beforeEach, vi } from 'vitest'
const express = require('express')
const supertest = require('supertest')

const USER_ID = 1

const mockExecute = vi.fn()
const fakePool = { execute: mockExecute }
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
injectFakeModule('../middleware/requireFullAccount', (req, res, next) => next())

const styleRouter = require('./style')

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/style', styleRouter)
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ error: err.message || '服务器错误' })
  })
  return app
}

beforeEach(() => {
  mockExecute.mockReset()
  mockExecute.mockImplementation(async (sql, params) => {
    if (String(sql).includes('style_modes')) {
      // 只把 teacher 视为有效风格，模拟 WHERE style_key = ? 的行为
      return params[0] === 'teacher'
        ? [[{ style_key: 'teacher', name: '教师', avatar: 'a.png' }], []]
        : [[], []]
    }
    return [[], []]
  })
})

function upsertCall() {
  return mockExecute.mock.calls.find(([sql]) =>
    String(sql).includes('INSERT INTO user_style_settings')
  )
}

describe('POST /api/style · 可选字段校验与 PATCH 同标', () => {
  it('customName 超过 12 字符 → 400', async () => {
    const res = await supertest(makeApp())
      .post('/api/style')
      .send({ styleKey: 'teacher', customName: 'a'.repeat(13) })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('名称不能超过12个字符')
    expect(upsertCall()).toBeUndefined()
  })

  it('customName 非字符串 → 400', async () => {
    const res = await supertest(makeApp())
      .post('/api/style')
      .send({ styleKey: 'teacher', customName: 123 })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('名称不能为空')
  })

  it('合法 customName 去除首尾空白后入库', async () => {
    const res = await supertest(makeApp())
      .post('/api/style')
      .send({ styleKey: 'teacher', customName: '  小明  ' })
    expect(res.status).toBe(200)
    expect(upsertCall()[1]).toEqual([USER_ID, 'teacher', '小明', null])
  })

  it('gender 不在白名单 → 400（回归：POST 曾不校验）', async () => {
    const res = await supertest(makeApp())
      .post('/api/style')
      .send({ styleKey: 'teacher', gender: 'attack"\'; DROP TABLE' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('性别值无效')
    expect(upsertCall()).toBeUndefined()
  })

  it('合法 gender 入库；两个可选字段都不传时保持 null', async () => {
    const ok = await supertest(makeApp())
      .post('/api/style')
      .send({ styleKey: 'teacher', gender: 'male' })
    expect(ok.status).toBe(200)
    expect(upsertCall()[1]).toEqual([USER_ID, 'teacher', null, 'male'])

    mockExecute.mockClear()
    const bare = await supertest(makeApp()).post('/api/style').send({ styleKey: 'teacher' })
    expect(bare.status).toBe(200)
    expect(upsertCall()[1]).toEqual([USER_ID, 'teacher', null, null])
  })

  it('styleKey 不存在 → 400', async () => {
    const res = await supertest(makeApp()).post('/api/style').send({ styleKey: 'nope' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('无效的风格')
  })
})
