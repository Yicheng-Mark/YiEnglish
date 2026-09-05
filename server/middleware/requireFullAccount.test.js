// requireFullAccount 单元测试：AI 助手为正式账号功能，体验用户（isGuest=true）直接 403。
// 覆盖：体验用户 → 403 + code=TRIAL_FORBIDDEN（前端 lib/ai-settings.js 依据此 code 识别）；
//       正式用户（isGuest=false）与未盖章请求（undefined）→ 放行 next()。
// 中间件无外部依赖，直接挂 express app 直测。

import { describe, it, expect } from 'vitest'
const express = require('express')
const supertest = require('supertest')
const requireFullAccount = require('./requireFullAccount')

function makeApp(isGuest) {
  const app = express()
  // 模拟 auth 中间件盖章后的请求
  app.get(
    '/ai',
    (req, _res, next) => {
      req.isGuest = isGuest
      next()
    },
    requireFullAccount,
    (req, res) => res.json({ ok: true, isGuest: req.isGuest })
  )
  return app
}

describe('体验用户（isGuest=true）', () => {
  it('→ 403 且 code=TRIAL_FORBIDDEN，不进入后续处理', async () => {
    const res = await supertest(makeApp(true)).get('/ai')
    expect(res.status).toBe(403)
    expect(res.body.code).toBe('TRIAL_FORBIDDEN')
    expect(res.body.error).toMatch(/正式账号/)
  })
})

describe('正式用户 / 未盖章请求 → 放行 next()', () => {
  it('isGuest=false → 200 并到达业务路由', async () => {
    const res = await supertest(makeApp(false)).get('/ai')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true, isGuest: false })
  })

  it('isGuest 未定义（老 token / 内部调用）→ 放行', async () => {
    const res = await supertest(makeApp(undefined)).get('/ai')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true, isGuest: undefined })
  })
})
