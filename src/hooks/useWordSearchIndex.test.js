// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import useWordSearchIndex from './useWordSearchIndex.js'

const META = [{ id: 'priority', name: '测试词典' }]
const PRIORITY_IDS = ['priority']
const DICTIONARY = {
  id: 'priority',
  name: '测试词典',
  chapters: [
    {
      id: 0,
      words: [{ name: 'apple', trans: ['n. 苹果'] }],
    },
  ],
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

// 索引请求直接失败 → 走旧的逐词典 fallback 路径（与切换前行为一致）
const noWordIndex = () => Promise.reject(new Error('no word-index'))

function renderSearch(query, loadDictionary, extraDependencies = {}) {
  const dependencies = {
    dictionaryMeta: META,
    priorityIds: PRIORITY_IDS,
    loadDictionary,
    loadWordIndex: noWordIndex,
    ...extraDependencies,
  }
  return renderHook(({ currentQuery }) => useWordSearchIndex(currentQuery, dependencies), {
    initialProps: { currentQuery: query },
  })
}

describe('useWordSearchIndex', () => {
  it('构建期间查询变化或清空不会取消索引，重新输入后可立即搜索', async () => {
    const gate = deferred()
    const loadDictionary = vi.fn().mockReturnValue(gate.promise)
    const { result, rerender } = renderSearch('a', loadDictionary)

    await waitFor(() => expect(loadDictionary).toHaveBeenCalledWith('priority'))

    rerender({ currentQuery: 'ap' })
    rerender({ currentQuery: '' })
    expect(result.current.showResults).toBe(false)

    await act(async () => {
      gate.resolve(DICTIONARY)
      await gate.promise
    })
    await waitFor(() => expect(result.current.indexedCount).toBe(1))

    rerender({ currentQuery: 'apple' })
    await waitFor(() => expect(result.current.results[0]?.word).toBe('apple'))
    expect(loadDictionary).toHaveBeenCalledTimes(1)
  })

  it('全部词典加载失败后可重试并恢复', async () => {
    const loadDictionary = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(DICTIONARY)
    const { result } = renderSearch('apple', loadDictionary)

    await waitFor(() => expect(result.current.buildFailed).toBe(true))

    act(() => result.current.retry())

    await waitFor(() => expect(result.current.results[0]?.word).toBe('apple'))
    expect(result.current.buildFailed).toBe(false)
    expect(loadDictionary).toHaveBeenCalledTimes(2)
  })

  it('合并索引可用时单请求建索引：条目结构与章节定位保持跳转能力', async () => {
    const loadDictionary = vi.fn()
    // 与生成脚本同构的索引条目：单词收录在 priority 词典第 0 章第 3 位
    const loadWordIndex = vi.fn().mockResolvedValue({
      apple: {
        name: 'apple',
        usphone: 'ˈæpl',
        ukphone: 'ˈæpl',
        trans: ['n. 苹果'],
        pos: 'noun',
        dictIds: ['priority'],
        locs: [[0, 3]],
      },
    })
    const { result } = renderSearch('apple', loadDictionary, { loadWordIndex })

    await waitFor(() => expect(result.current.results[0]?.word).toBe('apple'))
    // 索引覆盖 meta 全部词典 → indexedCount 置满，不再走逐词典加载
    expect(result.current.indexedCount).toBe(META.length)
    expect(loadDictionary).not.toHaveBeenCalled()
    expect(result.current.buildFailed).toBe(false)
    // 跳转所需字段与旧 buildWordIndex 条目同构
    expect(result.current.results[0]).toMatchObject({
      word: 'apple',
      wordLower: 'apple',
      phonetic: 'ˈæpl',
      definition: 'n. 苹果',
      dictId: 'priority',
      dictName: '测试词典',
      chapterId: 0,
      chapterIndex: 0,
      wordIndex: 3,
    })
  })

  it('合并索引失败后回退逐词典路径并可搜索', async () => {
    const loadDictionary = vi.fn().mockResolvedValue(DICTIONARY)
    const loadWordIndex = vi.fn().mockRejectedValue(new Error('404'))
    const { result } = renderSearch('apple', loadDictionary, { loadWordIndex })

    await waitFor(() => expect(result.current.results[0]?.word).toBe('apple'))
    expect(loadWordIndex).toHaveBeenCalledTimes(1)
    expect(loadDictionary).toHaveBeenCalledWith('priority')
    expect(result.current.indexedCount).toBe(1)
  })
})
