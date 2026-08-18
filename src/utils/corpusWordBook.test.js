// @vitest-environment jsdom
// 语料生词本测试：本地 CRUD、重复添加合并、损坏数据兜底、词书视图分章、
// enrich 词典补全与 IDB/服务端同步镜像。
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

const KEY = 'lingoforge_corpus_words'
const MIGRATED_KEY = KEY + '_migrated'

async function loadModule() {
  vi.resetModules()
  return import('./corpusWordBook.js')
}

function seed(words) {
  localStorage.setItem(KEY, JSON.stringify({ words }))
}

beforeEach(() => {
  localStorage.clear()
  Object.values(mocks).forEach((fn) => fn.mockClear())
  // 保留 mockResolvedValue 行为（mockClear 不清实现）
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
  it('添加新词 → 本地入库并上报服务端', async () => {
    const m = await loadModule()
    m.addToCorpusWordBook({ name: 'apple', trans: ['[n] 苹果'] })

    const saved = JSON.parse(localStorage.getItem(KEY))
    expect(saved.words).toHaveLength(1)
    expect(saved.words[0]).toMatchObject({ name: 'apple', trans: ['[n] 苹果'] })
    expect(typeof saved.words[0].addTime).toBe('number')
    expect(mocks.addWordToBook).toHaveBeenCalledWith('corpus', {
      name: 'apple',
      trans: ['[n] 苹果'],
    })

    expect(m.isInCorpusWordBook('apple')).toBe(true)
    expect(m.getCorpusWordBookCount()).toBe(1)
  })

  it('重复添加同名词 → 合并而非重复，保留首次 addTime', async () => {
    const m = await loadModule()
    m.addToCorpusWordBook({ name: 'apple', trans: ['[n] 苹果'] })
    m.addToCorpusWordBook({ name: 'apple', usphone: 'ˈæpl' })

    const saved = JSON.parse(localStorage.getItem(KEY))
    expect(saved.words).toHaveLength(1)
    expect(saved.words[0]).toMatchObject({ name: 'apple', trans: ['[n] 苹果'], usphone: 'ˈæpl' })
  })

  it('删除 → 本地移除并上报', async () => {
    const m = await loadModule()
    m.addToCorpusWordBook({ name: 'apple' })
    m.removeFromCorpusWordBook('apple')

    expect(JSON.parse(localStorage.getItem(KEY)).words).toHaveLength(0)
    expect(m.isInCorpusWordBook('apple')).toBe(false)
    expect(mocks.removeWordFromBook).toHaveBeenCalledWith('corpus', 'apple')
  })

  it('localStorage 损坏 → 返回空词本不抛错', async () => {
    localStorage.setItem(KEY, '{broken')
    const m = await loadModule()
    expect(m.getCorpusWordBook()).toEqual({ words: [] })
    expect(m.getCorpusWordBookCount()).toBe(0)
  })
})

describe('loadCorpusWordBookAsDictionary · 分章视图', () => {
  it('空词本 → 无章节', async () => {
    const m = await loadModule()
    const dict = m.loadCorpusWordBookAsDictionary()
    expect(dict.name).toBe('语料词本')
    expect(dict.chapters).toEqual([])
  })

  it('26 个词 → 2 章（25 + 1），字段透传', async () => {
    const words = Array.from({ length: 26 }, (_, i) => ({
      name: `word${i}`,
      trans: [`[n] 释义${i}`],
      notation: 'n',
      usphone: 'u',
      ukphone: 'k',
      us: 'us',
      uk: 'uk',
    }))
    seed(words)
    const m = await loadModule()
    const dict = m.loadCorpusWordBookAsDictionary()

    expect(dict.chapters).toHaveLength(2)
    expect(dict.chapters[0]).toMatchObject({ id: 0, name: '第 1 章' })
    expect(dict.chapters[0].words).toHaveLength(25)
    expect(dict.chapters[1]).toMatchObject({ id: 1, name: '第 2 章' })
    expect(dict.chapters[1].words).toHaveLength(1)
    expect(dict.chapters[0].words[0]).toMatchObject({ name: 'word0', trans: ['[n] 释义0'] })
  })
})

describe('enrichCorpusWordBook · 词典补全', () => {
  it('缺音标/释义的词被词典补全 → 落盘并整本同步服务端', async () => {
    seed([{ name: 'apple' }, { name: 'full', usphone: 'u', trans: ['[n] 全'] }])
    mocks.buildDictWordMap.mockResolvedValue(
      new Map([
        [
          'apple',
          {
            usphone: 'ˈæpl',
            ukphone: 'ˈæpl',
            us: 'us-audio',
            uk: 'uk-audio',
            trans: ['[n] 苹果'],
            notation: 'n.',
          },
        ],
      ])
    )
    const m = await loadModule()
    await m.enrichCorpusWordBook()

    const saved = JSON.parse(localStorage.getItem(KEY)).words
    expect(saved.find((w) => w.name === 'apple')).toMatchObject({
      usphone: 'ˈæpl',
      trans: ['[n] 苹果'],
    })
    // 已完整的词保持原样
    expect(saved.find((w) => w.name === 'full').usphone).toBe('u')
    expect(mocks.replaceWordBook).toHaveBeenCalledWith('corpus', saved)
  })

  it('词典查不到 → 不写盘不同步', async () => {
    seed([{ name: 'apple' }])
    const m = await loadModule()
    await m.enrichCorpusWordBook()

    expect(JSON.parse(localStorage.getItem(KEY)).words).toEqual([{ name: 'apple' }])
    expect(mocks.replaceWordBook).not.toHaveBeenCalled()
  })

  it('migrated 模式补全 → 镜像写入 IDB', async () => {
    localStorage.setItem(MIGRATED_KEY, '1')
    seed([{ name: 'apple' }])
    mocks.buildDictWordMap.mockResolvedValue(
      new Map([['apple', { usphone: 'u', trans: ['[n] 苹果'] }]])
    )
    const m = await loadModule()
    await m.enrichCorpusWordBook()

    expect(mocks.idbBulkPut).toHaveBeenCalledWith(
      'corpusWords',
      expect.arrayContaining([expect.objectContaining({ name: 'apple', usphone: 'u' })])
    )
  })
})

describe('migrated 模式', () => {
  it('添加/删除镜像写 IDB', async () => {
    localStorage.setItem(MIGRATED_KEY, '1')
    const m = await loadModule()
    m.addToCorpusWordBook({ name: 'apple' })
    expect(mocks.idbPut).toHaveBeenCalledWith(
      'corpusWords',
      expect.objectContaining({ name: 'apple' })
    )

    m.removeFromCorpusWordBook('apple')
    expect(mocks.idbDelete).toHaveBeenCalledWith('corpusWords', 'apple')
  })

  it('syncCorpusWordBookFromServer → 服务端数据覆盖本地并重建 IDB', async () => {
    localStorage.setItem(MIGRATED_KEY, '1')
    const serverWords = [{ name: 'dog', trans: ['[n] 狗'] }]
    mocks.fetchWordBook.mockResolvedValue({ words: serverWords })

    const m = await loadModule()
    await m.syncCorpusWordBookFromServer()

    expect(mocks.idbClear).toHaveBeenCalledWith('corpusWords')
    expect(mocks.idbBulkPut).toHaveBeenCalledWith('corpusWords', serverWords)
    expect(JSON.parse(localStorage.getItem(KEY)).words).toEqual(serverWords)
  })
})
