// 词库数据下发路由测试：认证闸、体验裁剪、路径白名单、缓存头。
// mock 策略与 admin.test.js 相同（require.cache 注入 fake authMiddleware），
// 数据文件用仓库 public/dictionaries 的真实产物（zhongkao.json 133KB / word-index*.json）。

import { describe, it, expect, beforeEach, vi } from 'vitest'
const express = require('express')
const supertest = require('supertest')
const fs = require('fs')
const path = require('path')

const DICT_DIR = path.resolve(__dirname, '../../public/dictionaries')

// 测试可控的身份：null=匿名（middleware 直接 401），否则设置 userId/isGuest
let currentIdentity = null
const fakeAuthMiddleware = (req, res, next) => {
  if (!currentIdentity) return res.status(401).json({ error: '请先登录' })
  req.userId = currentIdentity.userId
  req.isGuest = currentIdentity.isGuest
  next()
}

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
injectCache('../middleware/auth', fakeAuthMiddleware)

const contentRouter = require('./content')

function makeApp() {
  const app = express()
  app.use('/api/dictionaries', contentRouter)
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ error: err.message || '服务器错误' })
  })
  return app
}

beforeEach(() => {
  currentIdentity = null
})

describe('GET /api/dictionaries/:file', () => {
  it('匿名 → 401（词库数据不再静态直出）', async () => {
    const res = await supertest(makeApp()).get('/api/dictionaries/zhongkao.json')
    expect(res.status).toBe(401)
  })

  it('路径穿越/非法文件名 → 404', async () => {
    currentIdentity = { userId: 5, isGuest: false }
    const app = makeApp()
    for (const bad of [
      '..%2F..%2Fconfig.js',
      'word-index.json%00',
      '.env',
      'foo..json',
      'a/b.json',
    ]) {
      const res = await supertest(app).get(`/api/dictionaries/${bad}`)
      expect([404]).toContain(res.status)
    }
  })

  it('不存在的文件 → 404', async () => {
    currentIdentity = { userId: 5, isGuest: false }
    const res = await supertest(makeApp()).get('/api/dictionaries/nosuchdict.json')
    expect(res.status).toBe(404)
  })

  it('正式账号 → 全量文件字节级一致 + private,no-cache', async () => {
    currentIdentity = { userId: 5, isGuest: false }
    const res = await supertest(makeApp()).get('/api/dictionaries/zhongkao.json')
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe('private, no-cache')
    const onDisk = fs.readFileSync(path.join(DICT_DIR, 'zhongkao.json'))
    expect(res.text).toBe(onDisk.toString())
  })

  it('体验用户 → 词典裁剪为前 5 章', async () => {
    currentIdentity = { userId: 5, isGuest: true }
    const res = await supertest(makeApp()).get('/api/dictionaries/zhongkao.json')
    expect(res.status).toBe(200)
    expect(res.body.chapters).toHaveLength(5)
    const full = JSON.parse(fs.readFileSync(path.join(DICT_DIR, 'zhongkao.json'), 'utf8'))
    // 前 5 章内容与全量文件逐章一致（顺序与字段不重排）
    expect(res.body.chapters).toEqual(full.chapters.slice(0, 5))
  })

  it('体验用户 → 合并索引换发体验版（不含全量独有词条）', async () => {
    currentIdentity = { userId: 5, isGuest: true }
    const res = await supertest(makeApp()).get('/api/dictionaries/word-index.json')
    expect(res.status).toBe(200)
    const trial = JSON.parse(fs.readFileSync(path.join(DICT_DIR, 'word-index-trial.json'), 'utf8'))
    expect(Object.keys(res.body).length).toBe(Object.keys(trial).length)
    const full = JSON.parse(fs.readFileSync(path.join(DICT_DIR, 'word-index.json'), 'utf8'))
    expect(Object.keys(res.body).length).toBeLessThan(Object.keys(full).length)
  })

  it('正式账号 → 合并索引为全量版', async () => {
    currentIdentity = { userId: 5, isGuest: false }
    const res = await supertest(makeApp()).get('/api/dictionaries/word-index.json')
    expect(res.status).toBe(200)
    const full = JSON.parse(fs.readFileSync(path.join(DICT_DIR, 'word-index.json'), 'utf8'))
    expect(Object.keys(res.body).length).toBe(Object.keys(full).length)
  })

  it('缓存协商：If-None-Match 命中 → 304', async () => {
    currentIdentity = { userId: 5, isGuest: false }
    const app = makeApp()
    const first = await supertest(app).get('/api/dictionaries/zhongkao.json')
    expect(first.status).toBe(200)
    const etag = first.headers.etag
    expect(etag).toBeTruthy()
    const second = await supertest(app)
      .get('/api/dictionaries/zhongkao.json')
      .set('If-None-Match', etag)
    expect(second.status).toBe(304)
  })
})
