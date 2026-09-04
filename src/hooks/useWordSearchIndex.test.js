// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import useWordSearchIndex from './useWordSearchIndex.js'

const META = [{ id: 'priority' }]
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

function renderSearch(query, loadDictionary) {
  const dependencies = {
    dictionaryMeta: META,
    priorityIds: PRIORITY_IDS,
    loadDictionary,
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
})
