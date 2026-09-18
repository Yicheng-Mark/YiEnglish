// @vitest-environment jsdom
// 错题本服务端同步的合批 / 失败重试 / 删除跳过逻辑测试。
//
// 回归背景：flush 失败后增量虽被还回队列，但没有人重新武装定时器，
// 增量会一直滞留到用户下次打错同一词或页面隐藏，服务端 wrong_count 永久滞后。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const { addWordToBook, removeWordFromBook, clearWordBook, fetchWordBook } = vi.hoisted(() => ({
  addWordToBook: vi.fn(),
  removeWordFromBook: vi.fn(),
  clearWordBook: vi.fn(),
  fetchWordBook: vi.fn(),
}))

vi.mock('../lib/api-wordbooks', () => ({
  addWordToBook,
  removeWordFromBook,
  clearWordBook,
  fetchWordBook,
}))
vi.mock('./idb.js', () => ({
  idbPut: vi.fn().mockResolvedValue(),
  idbDelete: vi.fn().mockResolvedValue(),
  idbClear: vi.fn().mockResolvedValue(),
  idbBulkPut: vi.fn().mockResolvedValue(),
}))

// errorBook 是模块级单例（_cache / pendingSyncDeltas / syncTimer），
// 逐用例重载模块拿干净状态；注意旧实例挂在 document/window 上的兜底监听不会消失，
// 因此每个用例结束时必须让 pending 增量清零，避免旧监听在后续用例里补发请求。
let warnSpy
beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  vi.resetModules()
  addWordToBook.mockReset()
  removeWordFromBook.mockReset().mockResolvedValue({ success: true })
  clearWordBook.mockReset().mockResolvedValue({ success: true })
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  warnSpy.mockRestore()
  vi.clearAllTimers()
  vi.useRealTimers()
})

const WORD = { word: 'apple', trans: ['[n] 苹果'], notation: 'ˈæpl', dictName: 'CET4' }
const KEY = 'typingword_wrong'

describe('errorBook 服务端同步', () => {
  it('同步失败后定时重试，成功后停止（回归：修复前失败后不再有任何重试）', async () => {
    const { addToErrorBook } = await import('./errorBook')
    addWordToBook
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValue({ success: true })

    addToErrorBook(WORD)
    await vi.advanceTimersByTimeAsync(2000) // 首次 flush → 失败
    expect(addWordToBook).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(10 * 1000) // 重试间隔（SYNC_RETRY_MS）→ 第二次成功
    expect(addWordToBook).toHaveBeenCalledTimes(2)
    expect(addWordToBook.mock.calls[1][1]).toMatchObject({ name: 'apple', delta: 1 })

    await vi.advanceTimersByTimeAsync(60 * 1000) // 成功后不再重试
    expect(addWordToBook).toHaveBeenCalledTimes(2)
  })

  it('连续失败达到重试上限后停发；再次打错该词会重新触发同步', async () => {
    const { addToErrorBook } = await import('./errorBook')
    addWordToBook.mockRejectedValue(new Error('server down'))

    addToErrorBook(WORD)
    await vi.advanceTimersByTimeAsync(2000) // 第 1 次（首刷）
    await vi.advanceTimersByTimeAsync(10 * 1000) // 重试 1
    await vi.advanceTimersByTimeAsync(10 * 1000) // 重试 2
    await vi.advanceTimersByTimeAsync(10 * 1000) // 重试 3（达到 SYNC_RETRY_MAX）
    expect(addWordToBook).toHaveBeenCalledTimes(4)

    await vi.advanceTimersByTimeAsync(60 * 1000) // 超上限，停发
    expect(addWordToBook).toHaveBeenCalledTimes(4)

    // 收尾：让同步成功，清空 pending，避免本用例的模块实例残留增量
    addWordToBook.mockResolvedValue({ success: true })
    addToErrorBook({ ...WORD, trans: ['[n] 苹果'] })
    await vi.advanceTimersByTimeAsync(2000)
    expect(addWordToBook).toHaveBeenCalledTimes(5)
  })

  it('同一词 2s 内多次打错只发一次请求，delta 为累计增量', async () => {
    const { addToErrorBook } = await import('./errorBook')
    addWordToBook.mockResolvedValue({ success: true })

    addToErrorBook(WORD)
    addToErrorBook(WORD)
    addToErrorBook(WORD)
    await vi.advanceTimersByTimeAsync(2000)

    expect(addWordToBook).toHaveBeenCalledTimes(1)
    expect(addWordToBook.mock.calls[0][1]).toMatchObject({ name: 'apple', delta: 3 })
  })

  it('flush 前词已被删除则跳过服务端写入，避免把删掉的词同步回去', async () => {
    const { addToErrorBook, removeFromErrorBook } = await import('./errorBook')
    addWordToBook.mockResolvedValue({ success: true })

    addToErrorBook(WORD)
    removeFromErrorBook('apple')
    await vi.advanceTimersByTimeAsync(5000)

    expect(addWordToBook).not.toHaveBeenCalled()
  })

  it('页面隐藏兜底 flush 走 keepalive 请求（卸载阶段普通 fetch 会被终止）', async () => {
    const { addToErrorBook } = await import('./errorBook')
    addWordToBook.mockResolvedValue({ success: true })

    addToErrorBook(WORD)
    // 不等 2s debounce，直接触发页面隐藏兜底
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(addWordToBook).toHaveBeenCalledTimes(1)
    expect(addWordToBook.mock.calls[0][2]).toEqual({ keepalive: true })
  })

  it('add 在途时本地删词：remove 排队等待 add 完成后再发，服务端最终无此词（A5 回归）', async () => {
    let resolveAdd
    addWordToBook.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAdd = resolve
      })
    )
    const { addToErrorBook, removeFromErrorBook } = await import('./errorBook')

    addToErrorBook(WORD)
    await vi.advanceTimersByTimeAsync(2000) // flush → add 请求在途
    expect(addWordToBook).toHaveBeenCalledTimes(1)

    removeFromErrorBook('apple') // remove 入队，等待在途 add 完成后再发
    expect(removeWordFromBook).not.toHaveBeenCalled()

    resolveAdd({ success: true })
    await vi.advanceTimersByTimeAsync(0)
    expect(removeWordFromBook).toHaveBeenCalledTimes(1)
    expect(removeWordFromBook).toHaveBeenCalledWith('error', 'apple')
  })
})

describe('resetErrorBookCache（登出断开内存态）', () => {
  it('登出后清空待上云增量队列：到达原 debounce 时刻也不把旧账号数据发出去', async () => {
    const { addToErrorBook, resetErrorBookCache } = await import('./errorBook')
    addWordToBook.mockResolvedValue({ success: true })

    addToErrorBook(WORD)
    resetErrorBookCache()

    await vi.advanceTimersByTimeAsync(2000) // 原 flush 时刻
    await vi.advanceTimersByTimeAsync(60 * 1000)
    expect(addWordToBook).not.toHaveBeenCalled()
  })

  it('登出后在途请求的迟到失败不再把增量还回队列重试（epoch 守卫）', async () => {
    const { addToErrorBook, resetErrorBookCache } = await import('./errorBook')
    addWordToBook.mockRejectedValueOnce(new Error('network down'))

    addToErrorBook(WORD)
    await vi.advanceTimersByTimeAsync(2000) // 首刷失败 → 增量还回队列并武装重试
    expect(addWordToBook).toHaveBeenCalledTimes(1)

    resetErrorBookCache() // 登出：清空队列并递增 epoch
    await vi.advanceTimersByTimeAsync(60 * 1000) // 旧会话的重试被丢弃
    expect(addWordToBook).toHaveBeenCalledTimes(1)
  })
})

describe('落盘守卫（回归：登出断开后 pagehide 把 {"words":null} 写进 storage，下次启动错题本被清空）', () => {
  it('reset 后触发 pagehide 不再落盘，存量错题保留', async () => {
    const { addToErrorBook, resetErrorBookCache } = await import('./errorBook')
    addToErrorBook({ ...WORD, word: 'guardreset' })
    await vi.advanceTimersByTimeAsync(2000) // 完成一次正常落盘
    expect(JSON.parse(localStorage.getItem(KEY)).words).toHaveLength(1)

    resetErrorBookCache() // 登出断开内存态
    window.dispatchEvent(new Event('pagehide')) // 修复前这里写 {"words":null}

    const saved = JSON.parse(localStorage.getItem(KEY))
    expect(saved.words).toHaveLength(1)
    expect(saved.words[0]).toMatchObject({ name: 'guardreset' })
  })

  it('落盘完成后无新变更，pagehide 兜底跳过重复全量写', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    const { addToErrorBook } = await import('./errorBook')
    addToErrorBook({ ...WORD, word: 'guardnoop' })
    await vi.advanceTimersByTimeAsync(2000)
    setItemSpy.mockClear()

    window.dispatchEvent(new Event('pagehide'))

    // 只看本用例词的写：更早用例的模块实例监听仍在，与本用例无关
    const writes = setItemSpy.mock.calls.filter(
      (c) => c[0] === KEY && String(c[1]).includes('guardnoop')
    )
    expect(writes).toHaveLength(0)
    setItemSpy.mockRestore()
  })
})
