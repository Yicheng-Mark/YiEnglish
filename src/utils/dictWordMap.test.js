// dictWordMap 共享构建器测试：并发去重、成功缓存、全量失败不缓存（可重试）、
// 合并索引路径与旧全量路径的优先级等价。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const dictJson = (words) => JSON.stringify({ chapters: [{ id: 0, words }] })

const okResponse = (body) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(body)) })

const notFound = () => Promise.resolve({ ok: false })

const mockFetch = vi.fn()

// 让索引请求直接 404：现有用例全部经由旧全量 fallback 路径驱动（语义与切换前一致）
beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
  mockFetch.mockImplementation((url) =>
    String(url).includes('word-index.json') ? notFound() : Promise.resolve({ ok: false })
  )
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
        : String(url).includes('word-index.json')
          ? notFound()
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
        : String(url).includes('word-index.json')
          ? notFound()
          : Promise.resolve({ ok: false })
    )
    map = await buildDictWordMap()
    expect(map.get('dog')).toMatchObject({ name: 'dog' })
  })

  it('并发调用共享同一次加载', async () => {
    const { buildDictWordMap } = await import('./dictWordMap.js')

    // 索引请求立即 404（走 fallback），第一个词典 fetch 挂起等待放行，其余词典立即 404
    let firstResolve
    let first = true
    mockFetch.mockImplementation((url) => {
      if (String(url).includes('word-index.json')) return notFound()
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
    // 索引请求先落地（404 → fallback）之后，词典的首个 fetch 才会挂起：
    // 用一个宏任务把微任务链冲到位，再放行挂起的请求
    await new Promise((r) => setTimeout(r, 0))
    firstResolve(okResponse(dictJson([{ name: 'cat', trans: ['[n] 猫'] }])))

    const [m1, m2] = await Promise.all([p1, p2])
    expect(m1).toBe(m2)
    expect(m1.get('cat')).toBeTruthy()
  })

  it('索引可用时单请求建表：first-wins 收录范围与词条字段来自首个含词词典', async () => {
    const { buildDictWordMap, buildDictWordMapFromDicts } = await import('./dictWordMap.js')
    const { buildWordIndexData } = await import('../../scripts/gen-word-index.mjs')

    // 4 部小词典覆盖关键场景：
    // apple ∈ junior + cet4 → junior 胜出；orange 仅 cet4；kernel 仅 postgraduateCore；
    // deploy ∈ postgraduateCore + programmer → postgraduateCore 先于 programmer 胜出
    const fixture = {
      junior: [{ name: 'apple', usphone: 'ˈæpl', ukphone: 'ˈæpl', trans: ['[n] 苹果'] }],
      cet4: [
        { name: 'apple', usphone: 'wrong', ukphone: 'wrong', trans: ['[n] 四级苹果'] },
        { name: 'orange', usphone: 'ˈɒrɪndʒ', ukphone: 'ˈɒrɪndʒ', trans: ['[n] 橙子'] },
      ],
      postgraduateCore: [
        { name: 'kernel', usphone: 'ˈkɜːnl', ukphone: 'ˈkɜːnl', trans: ['[n] 内核'] },
        { name: 'deploy', usphone: 'dɪˈplɔɪ', ukphone: 'dɪˈplɔɪ', trans: ['[v] 部署'] },
      ],
      programmer: [
        { name: 'deploy', usphone: 'de-ploy', ukphone: 'de-ploy', trans: ['[v] 程序员部署'] },
      ],
    }

    const dictsById = {}
    for (const [id, words] of Object.entries(fixture)) {
      dictsById[id] = JSON.parse(dictJson(words))
    }
    const { index } = buildWordIndexData(dictsById)

    // 先用全量词典响应做旧路径对拍基准（fixture 之外的词典 id 均按 404 处理）
    mockFetch.mockImplementation((url) => {
      const u = String(url)
      if (u.includes('word-index.json')) return notFound()
      for (const id of Object.keys(fixture)) {
        if (u.includes(`/${id}.json`)) return okResponse(JSON.stringify(dictsById[id]))
      }
      return Promise.resolve({ ok: false })
    })

    const expected = await buildDictWordMapFromDicts()
    expect(expected.get('apple').usphone).toBe('ˈæpl')
    expect(expected.get('kernel')).toBeTruthy()
    expect(expected.get('deploy').usphone).toBe('dɪˈplɔɪ')

    // 切到索引路径：word-index.json 200，词典请求不应发生
    const dictRequests = []
    mockFetch.mockClear()
    mockFetch.mockImplementation((url) => {
      const u = String(url)
      if (u.includes('word-index.json')) return okResponse(JSON.stringify(index))
      dictRequests.push(u)
      return Promise.resolve({ ok: false })
    })

    const map = await buildDictWordMap()
    expect(map.size).toBe(expected.size)
    for (const [key, word] of expected) {
      expect(map.get(key)).toEqual(word) // 逐词等价（收录范围 + 字段 + first-wins 胜出方）
    }
    expect(dictRequests).toHaveLength(0) // 单请求，不再全量拉词典
  })

  it('索引损坏（非对象结构）→ 回退旧全量路径', async () => {
    const { buildDictWordMap } = await import('./dictWordMap.js')
    mockFetch.mockImplementation((url) =>
      String(url).includes('word-index.json')
        ? okResponse(JSON.stringify(['not', 'an', 'object']))
        : String(url).includes('/cet4.json')
          ? okResponse(dictJson([{ name: 'fallback', trans: ['[n] 兜底'] }]))
          : Promise.resolve({ ok: false })
    )

    const map = await buildDictWordMap()
    expect(map.get('fallback')).toMatchObject({ name: 'fallback' })
  })
})
