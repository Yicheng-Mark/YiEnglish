// @vitest-environment jsdom
// 收藏词本测试：未迁移/已迁移双路径 CRUD、重复添加合并（保留 addTime）、
// 损坏数据兜底、词书视图分章（字段白名单）、服务端同步镜像。
// 模块内有 _cache 单例，用 vi.resetModules + 每用例动态 import 取干净实例。
import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  addWordToBook: vi.fn(),
  removeWordFromBook: vi.fn(),
  fetchWordBook: vi.fn(),
  idbPut: vi.fn(),
  idbDelete: vi.fn(),
  idbClear: vi.fn(),
  idbBulkPut: vi.fn(),
}))

vi.mock('../lib/api-wordbooks', () => ({
  addWordToBook: mocks.addWordToBook,
  removeWordFromBook: mocks.removeWordFromBook,
  fetchWordBook: mocks.fetchWordBook,
}))
vi.mock('./idb.js', () => ({
  idbPut: mocks.idbPut,
  idbDelete: mocks.idbDelete,
  idbClear: mocks.idbClear,
  idbBulkPut: mocks.idbBulkPut,
}))

const KEY = 'lingoforge_favorite_words'
const MIGRATED_KEY = KEY + '_migrated'

async function loadModule() {
  vi.resetModules()
  return import('./favoriteWords.js')
}

function seed(words) {
  localStorage.setItem(KEY, JSON.stringify({ words }))
}

beforeEach(() => {
  localStorage.clear()
  Object.values(mocks).forEach((fn) => fn.mockReset())
  mocks.addWordToBook.mockResolvedValue()
  mocks.removeWordFromBook.mockResolvedValue()
  mocks.fetchWordBook.mockResolvedValue({ words: [] })
  mocks.idbPut.mockResolvedValue()
  mocks.idbDelete.mockResolvedValue()
  mocks.idbClear.mockResolvedValue()
  mocks.idbBulkPut.mockResolvedValue()
})

describe('未迁移路径（纯 localStorage）', () => {
  it('add → 写入 localStorage 且异步同步服务端', async () => {
    const m = await loadModule()
    m.addToFavoriteWords({ name: 'apple', trans: ['[n] 苹果'] })
    const saved = JSON.parse(localStorage.getItem(KEY))
    expect(saved.words).toHaveLength(1)
    expect(saved.words[0]).toMatchObject({ name: 'apple' })
    expect(saved.words[0].addTime).toBeGreaterThan(0)
    expect(mocks.addWordToBook).toHaveBeenCalledWith('favorite', {
      name: 'apple',
      trans: ['[n] 苹果'],
    })
  })

  it('remove → 过滤 + 服务端同步', async () => {
    seed([{ name: 'apple' }, { name: 'bee' }])
    const m = await loadModule()
    m.removeFromFavoriteWords('apple')
    const saved = JSON.parse(localStorage.getItem(KEY))
    expect(saved.words).toEqual([{ name: 'bee' }])
    expect(mocks.removeWordFromBook).toHaveBeenCalledWith('favorite', 'apple')
    expect(mocks.idbDelete).not.toHaveBeenCalled()
  })

  it('localStorage 损坏 → get 返回空词本不抛错', async () => {
    localStorage.setItem(KEY, '{broken json')
    const m = await loadModule()
    expect(m.getFavoriteWords()).toEqual({ words: [] })
  })
})

describe('已迁移路径（内存缓存 + IDB 镜像）', () => {
  beforeEach(() => {
    localStorage.setItem(MIGRATED_KEY, '1')
  })

  it('add 新词 → unshift 到队首 + idbPut 镜像', async () => {
    seed([{ name: 'bee' }])
    const m = await loadModule()
    m.addToFavoriteWords({ name: 'apple' })
    const saved = JSON.parse(localStorage.getItem(KEY))
    expect(saved.words.map((w) => w.name)).toEqual(['apple', 'bee'])
    expect(mocks.idbPut).toHaveBeenCalledWith(
      'favoriteWords',
      expect.objectContaining({ name: 'apple' })
    )
  })

  it('add 已存在词 → 合并字段且保留原 addTime（回归：不得重置收藏时间）', async () => {
    const originalAddTime = 1000
    seed([{ name: 'apple', addTime: originalAddTime, trans: ['旧释义'] }])
    const m = await loadModule()
    m.addToFavoriteWords({ name: 'apple', trans: ['[n] 新释义'] })
    const saved = JSON.parse(localStorage.getItem(KEY))
    expect(saved.words).toHaveLength(1)
    expect(saved.words[0].addTime).toBe(originalAddTime)
    expect(saved.words[0].trans).toEqual(['[n] 新释义'])
  })

  it('remove → 缓存过滤 + idbDelete 镜像', async () => {
    seed([{ name: 'apple' }, { name: 'bee' }])
    const m = await loadModule()
    m.removeFromFavoriteWords('bee')
    const saved = JSON.parse(localStorage.getItem(KEY))
    expect(saved.words.map((w) => w.name)).toEqual(['apple'])
    expect(mocks.idbDelete).toHaveBeenCalledWith('favoriteWords', 'bee')
  })

  it('isIn / count 基于缓存判定', async () => {
    seed([{ name: 'apple' }])
    const m = await loadModule()
    expect(m.isInFavoriteWords('apple')).toBe(true)
    expect(m.isInFavoriteWords('bee')).toBe(false)
    expect(m.getFavoriteWordsCount()).toBe(1)
  })
})

describe('loadFavoriteWordsAsDictionary', () => {
  it('空词本 → 无章节', async () => {
    const m = await loadModule()
    const dict = m.loadFavoriteWordsAsDictionary()
    expect(dict.name).toBe('收藏词本')
    expect(dict.chapters).toEqual([])
  })

  it('按 25 词分章，字段白名单输出', async () => {
    const words = Array.from({ length: 30 }, (_, i) => ({
      name: 'w' + i,
      trans: ['t' + i],
      notation: 'n' + i,
      usphone: 'u' + i,
      ukphone: 'k' + i,
      us: 'us' + i,
      uk: 'uk' + i,
      addTime: i, // 应被剥离
      extra: 'x', // 应被剥离
    }))
    seed(words)
    const m = await loadModule()
    const dict = m.loadFavoriteWordsAsDictionary()
    expect(dict.chapters).toHaveLength(2)
    expect(dict.chapters[0].words).toHaveLength(25)
    expect(dict.chapters[1].words).toHaveLength(5)
    expect(dict.chapters[0].id).toBe(0)
    expect(dict.chapters[1].name).toBe('第 2 章')
    expect(dict.chapters[0].words[0]).toEqual({
      name: 'w0',
      trans: ['t0'],
      notation: 'n0',
      usphone: 'u0',
      ukphone: 'k0',
      us: 'us0',
      uk: 'uk0',
    })
  })
})

describe('syncFavoriteWordsFromServer', () => {
  it('服务端数据覆盖本地 + 清空重建 IDB', async () => {
    localStorage.setItem(MIGRATED_KEY, '1')
    seed([{ name: 'stale' }])
    mocks.fetchWordBook.mockResolvedValue({ words: [{ name: 'fresh' }] })
    const m = await loadModule()
    await m.syncFavoriteWordsFromServer()
    const saved = JSON.parse(localStorage.getItem(KEY))
    expect(saved.words).toEqual([{ name: 'fresh' }])
    expect(mocks.idbClear).toHaveBeenCalledWith('favoriteWords')
    expect(mocks.idbBulkPut).toHaveBeenCalledWith('favoriteWords', [{ name: 'fresh' }])
    // 同步后缓存即新数据
    expect(m.isInFavoriteWords('fresh')).toBe(true)
    expect(m.isInFavoriteWords('stale')).toBe(false)
  })

  it('服务端失败 → 静默告警不抛错', async () => {
    mocks.fetchWordBook.mockRejectedValue(new Error('network'))
    const m = await loadModule()
    await expect(m.syncFavoriteWordsFromServer()).resolves.toBeUndefined()
  })
})
