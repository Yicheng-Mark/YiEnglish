// @vitest-environment jsdom
// 阅读生词本测试：与 corpusWordBook 同构（本地 CRUD、合并去重、分章视图、
// enrich 补全、IDB/服务端同步镜像），storage key 与词本类型不同。
// 模块内有 _cache 单例，用 vi.resetModules + 每用例动态 import 取干净实例。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  addWordToBook: vi.fn().mockResolvedValue(),
  removeWordFromBook: vi.fn().mockResolvedValue(),
  fetchWordBook: vi.fn().mockResolvedValue({ words: [] }),
  replaceWordBook: vi.fn().mockResolvedValue(),
  idbPut: vi.fn().mockResolvedValue(),
  idbDelete: vi.fn().mockResolvedValue(),
  idbClear: vi.fn().mockResolvedValue(),
  idbBulkPut: vi.fn().mockResolvedValue(),
  buildDictWordMap: vi.fn().mockResolvedValue(new Map()),
}))

vi.mock('../lib/api-wordbooks', () => ({
  addWordToBook: mocks.addWordToBook,
  removeWordFromBook: mocks.removeWordFromBook,
  fetchWordBook: mocks.fetchWordBook,
  replaceWordBook: mocks.replaceWordBook,
}))
vi.mock('./idb.js', () => ({
  idbPut: mocks.idbPut,
  idbDelete: mocks.idbDelete,
  idbClear: mocks.idbClear,
  idbBulkPut: mocks.idbBulkPut,
}))
vi.mock('./dictWordMap.js', () => ({
  buildDictWordMap: mocks.buildDictWordMap,
}))

const KEY = 'lingoforge_reading_words'
const MIGRATED_KEY = KEY + '_migrated'

async function loadModule() {
  vi.resetModules()
  return import('./readingWordBook.js')
}

function seed(words) {
  localStorage.setItem(KEY, JSON.stringify({ words }))
}

// 落盘是 2s debounce：推进虚拟时钟让待写批次立刻 flush。
// async 版会同时放空微任务队列（服务端写队列是 .then 链，同步 advance 看不到）
async function flushPersist() {
  await vi.advanceTimersByTimeAsync(2000)
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  Object.values(mocks).forEach((fn) => fn.mockClear())
  mocks.addWordToBook.mockResolvedValue()
  mocks.removeWordFromBook.mockResolvedValue()
  mocks.fetchWordBook.mockResolvedValue({ words: [] })
  mocks.replaceWordBook.mockResolvedValue()
  mocks.buildDictWordMap.mockResolvedValue(new Map())
})

afterEach(() => {
  vi.useRealTimers()
})

describe('本地 CRUD（非 migrated）', () => {
  it('添加新词 → 2s 防抖后本地入库，服务端即时上报（bookType=reading）', async () => {
    const m = await loadModule()
    m.addToReadingWordBook({ name: 'apple', trans: ['[n] 苹果'] })

    // 内存缓存即时反映（唯一数据源），localStorage 走 2s 防抖
    expect(m.isInReadingWordBook('apple')).toBe(true)
    expect(m.getReadingWordBookCount()).toBe(1)
    expect(localStorage.getItem(KEY)).toBeNull()
    await flushPersist()

    const saved = JSON.parse(localStorage.getItem(KEY))
    expect(saved.words).toHaveLength(1)
    expect(saved.words[0]).toMatchObject({ name: 'apple', trans: ['[n] 苹果'] })
    expect(mocks.addWordToBook).toHaveBeenCalledWith('reading', {
      name: 'apple',
      trans: ['[n] 苹果'],
    })
  })

  it('重复添加同名词 → 合并而非重复', async () => {
    const m = await loadModule()
    m.addToReadingWordBook({ name: 'apple', trans: ['[n] 苹果'] })
    m.addToReadingWordBook({ name: 'apple', ukphone: 'ˈæpl' })
    await flushPersist()

    const saved = JSON.parse(localStorage.getItem(KEY))
    expect(saved.words).toHaveLength(1)
    expect(saved.words[0]).toMatchObject({ name: 'apple', trans: ['[n] 苹果'], ukphone: 'ˈæpl' })
  })

  it('删除 → 本地移除并上报', async () => {
    const m = await loadModule()
    m.addToReadingWordBook({ name: 'apple' })
    m.removeFromReadingWordBook('apple')
    await flushPersist()

    expect(JSON.parse(localStorage.getItem(KEY)).words).toHaveLength(0)
    expect(mocks.removeWordFromBook).toHaveBeenCalledWith('reading', 'apple')
  })

  it('localStorage 损坏 → 返回空词本不抛错', async () => {
    localStorage.setItem(KEY, '{broken')
    const m = await loadModule()
    expect(m.getReadingWordBook()).toEqual({ words: [] })
    expect(m.getReadingWordBookCount()).toBe(0)
  })
})

describe('loadReadingWordBookAsDictionary · 分章视图', () => {
  it('空词本 → 无章节；26 个词 → 2 章', async () => {
    const m = await loadModule()
    expect(m.loadReadingWordBookAsDictionary().chapters).toEqual([])

    // 内存缓存是唯一数据源：seed 后需重新取干净模块（bootstrap 自 localStorage）
    seed(Array.from({ length: 26 }, (_, i) => ({ name: `w${i}`, trans: ['x'] })))
    const m2 = await loadModule()
    const dict = m2.loadReadingWordBookAsDictionary()
    expect(dict.name).toBe('阅读词本')
    expect(dict.chapters).toHaveLength(2)
    expect(dict.chapters[0].words).toHaveLength(25)
    expect(dict.chapters[1].words).toHaveLength(1)
  })
})

describe('enrichReadingWordBook · 词典补全', () => {
  it('缺音标/释义的词被补全 → 落盘并整本同步服务端', async () => {
    seed([{ name: 'apple' }])
    mocks.buildDictWordMap.mockResolvedValue(
      new Map([['apple', { usphone: 'ˈæpl', trans: ['[n] 苹果'], notation: 'n.' }]])
    )
    const m = await loadModule()
    await m.enrichReadingWordBook()

    const saved = JSON.parse(localStorage.getItem(KEY)).words
    expect(saved[0]).toMatchObject({ name: 'apple', usphone: 'ˈæpl', trans: ['[n] 苹果'] })
    expect(mocks.replaceWordBook).toHaveBeenCalledWith('reading', saved)
  })

  it('词典查不到 → 不写盘不同步', async () => {
    seed([{ name: 'apple' }])
    const m = await loadModule()
    await m.enrichReadingWordBook()

    expect(mocks.replaceWordBook).not.toHaveBeenCalled()
  })

  it('migrated 模式补全 → 镜像写入 IDB', async () => {
    localStorage.setItem(MIGRATED_KEY, '1')
    seed([{ name: 'apple' }])
    mocks.buildDictWordMap.mockResolvedValue(
      new Map([['apple', { usphone: 'u', trans: ['[n] 苹果'] }]])
    )
    const m = await loadModule()
    await m.enrichReadingWordBook()

    expect(mocks.idbBulkPut).toHaveBeenCalledWith(
      'readingWords',
      expect.arrayContaining([expect.objectContaining({ name: 'apple', usphone: 'u' })])
    )
  })
})

describe('migrated 模式', () => {
  it('添加合批镜像写 IDB、删除即时镜像', async () => {
    localStorage.setItem(MIGRATED_KEY, '1')
    const m = await loadModule()
    m.addToReadingWordBook({ name: 'apple' })
    await flushPersist()
    expect(mocks.idbBulkPut).toHaveBeenCalledWith('readingWords', [
      expect.objectContaining({ name: 'apple' }),
    ])

    m.removeFromReadingWordBook('apple')
    expect(mocks.idbDelete).toHaveBeenCalledWith('readingWords', 'apple')
  })

  it('syncReadingWordBookFromServer → 服务端数据覆盖本地并重建 IDB', async () => {
    localStorage.setItem(MIGRATED_KEY, '1')
    const serverWords = [{ name: 'dog', trans: ['[n] 狗'] }]
    mocks.fetchWordBook.mockResolvedValue({ words: serverWords })

    const m = await loadModule()
    await m.syncReadingWordBookFromServer()

    expect(mocks.idbClear).toHaveBeenCalledWith('readingWords')
    expect(mocks.idbBulkPut).toHaveBeenCalledWith('readingWords', serverWords)
    expect(JSON.parse(localStorage.getItem(KEY)).words).toEqual(serverWords)
  })
})
