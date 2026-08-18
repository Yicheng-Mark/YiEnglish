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
})
