// dictWordMap 共享构建器测试：并发去重、成功缓存、全量失败不缓存（可重试）。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const dictJson = (words) => JSON.stringify({ chapters: [{ id: 0, words }] })

const okResponse = (body) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(body)) })

const mockFetch = vi.fn()

beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('buildDictWordMap（共享构建器）', () => {
  it('加载多本词典合并为小写 key 的 Map，二次调用命中缓存', async () => {
    const { buildDictWordMap } = await import('./dictWordMap.js')
    mockFetch.mockImplementation((url) =>
      String(url).includes('/cet4.json')
        ? okResponse(dictJson([{ name: 'Apple', trans: ['[n] 苹果'] }]))
        : Promise.resolve({ ok: false })
    )

    const map = await buildDictWordMap()
    expect(map.get('apple')).toMatchObject({ name: 'Apple' })

    const callsAfterFirst = mockFetch.mock.calls.length
    const again = await buildDictWordMap()
    expect(again).toBe(map) // 同一实例
    expect(mockFetch.mock.calls.length).toBe(callsAfterFirst) // 未重复请求
  })

  it('全部词典加载失败时不缓存空 Map，下次调用重试（对齐原三处副本的行为缺口）', async () => {
    const { buildDictWordMap } = await import('./dictWordMap.js')

    mockFetch.mockRejectedValue(new Error('offline'))
    let map = await buildDictWordMap()
    expect(map.size).toBe(0)

    // 网络恢复后再次调用应重新加载，而不是拿到缓存的空 Map
    mockFetch.mockImplementation((url) =>
      String(url).includes('/cet4.json')
        ? okResponse(dictJson([{ name: 'dog', trans: ['[n] 狗'] }]))
        : Promise.resolve({ ok: false })
    )
    map = await buildDictWordMap()
    expect(map.get('dog')).toMatchObject({ name: 'dog' })
  })

  it('并发调用共享同一次加载', async () => {
    const { buildDictWordMap } = await import('./dictWordMap.js')

    // 第一个 fetch 挂起等待放行，其余词典立即 404
    let firstResolve
    let first = true
    mockFetch.mockImplementation(() => {
      if (first) {
        first = false
        return new Promise((r) => {
          firstResolve = r
        })
      }
      return Promise.resolve({ ok: false })
    })

    const p1 = buildDictWordMap()
    const p2 = buildDictWordMap() // 应复用 p1 的 in-flight promise
    firstResolve(okResponse(dictJson([{ name: 'cat', trans: ['[n] 猫'] }])))

    const [m1, m2] = await Promise.all([p1, p2])
    expect(m1).toBe(m2)
    expect(m1.get('cat')).toBeTruthy()
  })
})
