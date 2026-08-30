// loadDictionary 的加载缓存与并发去重测试。
//
// 覆盖：in-flight 去重（并发调用共享同一次 fetch+parse）、结果缓存命中、
// 失败不缓存可重试、25 词 rechunk 分章、未知 id 兜底、loadChapter 章节定位。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// 30 个词的测试词典：rechunk 后应为 25 + 5 两章
function makeDict(wordCount = 30) {
  const words = Array.from({ length: wordCount }, (_, i) => ({
    name: `word${i}`,
    trans: [`n. 词${i}`],
  }))
  return {
    name: '测试词库',
    description: 'desc',
    chapters: [{ id: 0, name: '原始章', words }],
    totalChapters: 1,
  }
}

let fetchMock

beforeEach(() => {
  vi.useFakeTimers()
  vi.resetModules()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function okResponse(data) {
  return { ok: true, json: async () => data }
}

describe('loadDictionary', () => {
  it('并发调用同一词典共享同一次 fetch（in-flight 去重）', async () => {
    const data = makeDict()
    let resolveFetch
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve
        })
    )
    const { loadDictionary } = await import('./loadDictionary.js')

    const p1 = loadDictionary('cet4')
    const p2 = loadDictionary('cet4')
    resolveFetch(okResponse(data))
    const [r1, r2] = await Promise.all([p1, p2])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(r1).toBe(r2) // 同一份解析结果，不是两次独立 fetch+parse
  })

  it('已加载词典走缓存，不再 fetch', async () => {
    const data = makeDict()
    fetchMock.mockResolvedValue(okResponse(data))
    const { loadDictionary } = await import('./loadDictionary.js')

    const r1 = await loadDictionary('cet4')
    const r2 = await loadDictionary('cet4')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(r2).toBe(r1)
  })

  it('HTTP 非 200 抛错且不缓存，之后可重试成功', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 })
    const { loadDictionary } = await import('./loadDictionary.js')

    await expect(loadDictionary('cet4')).rejects.toThrow('Failed to load dictionary cet4: 500')

    // 重试成功：失败没有被缓存
    fetchMock.mockResolvedValueOnce(okResponse(makeDict()))
    const r = await loadDictionary('cet4')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(r.chapters).toHaveLength(2)
  })

  it('网络错误同样不缓存，可重试', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('network down'))
    const { loadDictionary } = await import('./loadDictionary.js')

    await expect(loadDictionary('cet6')).rejects.toThrow('network down')
    fetchMock.mockResolvedValueOnce(okResponse(makeDict(5)))
    const r = await loadDictionary('cet6')
    expect(r.chapters).toHaveLength(1)
  })

  it('rechunk：30 词 → 25+5 两章，章 id/name 正确', async () => {
    fetchMock.mockResolvedValue(okResponse(makeDict(30)))
    const { loadDictionary } = await import('./loadDictionary.js')

    const r = await loadDictionary('ielts')
    expect(r.chapters).toHaveLength(2)
    expect(r.chapters[0]).toMatchObject({ id: 0, name: '第 1 章' })
    expect(r.chapters[0].words).toHaveLength(25)
    expect(r.chapters[1]).toMatchObject({ id: 1, name: '第 2 章' })
    expect(r.chapters[1].words).toHaveLength(5)
    expect(r.totalChapters).toBe(2)
  })

  it('未知词典 id 返回 null，不抛错', async () => {
    const { loadDictionary } = await import('./loadDictionary.js')
    await expect(loadDictionary('no-such-dict')).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('loadChapter 按 id 定位章节', async () => {
    fetchMock.mockResolvedValue(okResponse(makeDict(30)))
    const { loadChapter } = await import('./loadDictionary.js')

    const ch1 = await loadChapter('cet4', 1)
    expect(ch1.id).toBe(1)
    expect(ch1.words[0].name).toBe('word25')

    // 未找到章节返回 undefined（调用方均以可选链处理）
    await expect(loadChapter('cet4', 99)).resolves.toBeUndefined()
  })
})
