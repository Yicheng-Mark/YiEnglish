// @vitest-environment jsdom
// localProgress 的内存优先 + 防抖落盘测试。
//
// 覆盖：未迁移/已迁移双路径、防抖窗口内读立即可见（内存优先）、
// 同窗口多次保存只落盘一次、pagehide 兜底 flush、重置进度三处数据源同步清理、
// 半损坏 JSON 兜底。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('./idb.js', () => ({
  idbPut: vi.fn().mockResolvedValue(),
  idbDelete: vi.fn().mockResolvedValue(),
}))

import { idbPut, idbDelete } from './idb.js'

const KEY = 'lf_progress'

// localProgress 是模块级单例（_cache / persistTimer / pendingIdbKeys），
// 逐用例重载模块拿干净状态；旧实例挂在 window 上的 pagehide 监听不会消失，
// 但注册顺序保证最新实例的 flush 最后执行、写入最终生效。
beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  vi.resetModules()
  idbPut.mockClear()
  idbDelete.mockClear()
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

async function flushDebounce() {
  await vi.advanceTimersByTimeAsync(2000)
}

describe('saveLocalProgress / getLocalProgress（未迁移路径）', () => {
  it('内存优先：防抖窗口内读取立即可见，localStorage 延迟写入', async () => {
    const { saveLocalProgress, getLocalProgress } = await import('./localProgress.js')
    saveLocalProgress('cet4', 0, ['apple'])
    expect(getLocalProgress('cet4')).toEqual({ 0: 1 })
    expect(localStorage.getItem(KEY)).toBe(null)

    await flushDebounce()
    const data = JSON.parse(localStorage.getItem(KEY))
    expect(data['cet4:0']).toEqual(['apple'])
  })

  it('重复保存去重合并，同一防抖窗口只落盘一次', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    const { saveLocalProgress, getLocalProgress } = await import('./localProgress.js')

    saveLocalProgress('cet4', 0, ['apple'])
    saveLocalProgress('cet4', 0, ['apple', 'dog'])
    saveLocalProgress('cet4', 1, ['cat'])

    await flushDebounce()
    // 首次 import 后仅本模块的一次防抖写（其他模块可能也会写 storage，按 key 过滤）
    const writesForKey = setItemSpy.mock.calls.filter((c) => c[0] === KEY)
    expect(writesForKey.length).toBe(1)
    expect(getLocalProgress('cet4')).toEqual({ 0: 2, 1: 1 })
    setItemSpy.mockRestore()
  })

  it('pagehide 兜底 flush：防抖窗口内离开页面不丢进度', async () => {
    const { saveLocalProgress } = await import('./localProgress.js')
    saveLocalProgress('cet4', 0, ['apple'])
    expect(localStorage.getItem(KEY)).toBe(null)

    window.dispatchEvent(new Event('pagehide'))
    expect(JSON.parse(localStorage.getItem(KEY))['cet4:0']).toEqual(['apple'])
  })
})

describe('已迁移路径（IDB 为主存储）', () => {
  it('save 后 IDB 按章节增量 put，且随防抖合批', async () => {
    localStorage.setItem(KEY + '_migrated', '1')
    const { saveLocalProgress, getLocalProgress } = await import('./localProgress.js')

    saveLocalProgress('cet4', 0, ['apple'])
    saveLocalProgress('cet4', 0, ['dog'])
    expect(idbPut).not.toHaveBeenCalled() // 未满防抖窗口

    await flushDebounce()
    expect(idbPut).toHaveBeenCalledTimes(1) // 同章两次保存只 put 一次
    expect(idbPut).toHaveBeenCalledWith('progress', {
      dictChapter: 'cet4:0',
      words: ['apple', 'dog'],
    })
    expect(getLocalProgress('cet4')).toEqual({ 0: 2 })
  })
})

describe('clearLocalProgress（重置进度）', () => {
  it('清除该词库全部章节的内存 + localStorage，不影响其他词库', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ 'cet4:0': ['apple'], 'cet4:1': ['dog'], 'ielts:0': ['zoo'] })
    )
    const { clearLocalProgress, getLocalProgress } = await import('./localProgress.js')

    clearLocalProgress('cet4')

    expect(getLocalProgress('cet4')).toEqual({})
    expect(getLocalProgress('ielts')).toEqual({ 0: 1 })
    const data = JSON.parse(localStorage.getItem(KEY))
    expect(Object.keys(data)).toEqual(['ielts:0'])
  })

  it('迁移模式下同步清理 IDB 对应条目', async () => {
    localStorage.setItem(KEY + '_migrated', '1')
    localStorage.setItem(
      KEY,
      JSON.stringify({ 'cet4:0': ['apple'], 'cet4:1': ['dog'], 'ielts:0': ['zoo'] })
    )
    const { clearLocalProgress } = await import('./localProgress.js')

    clearLocalProgress('cet4')

    expect(idbDelete).toHaveBeenCalledTimes(2)
    expect(idbDelete).toHaveBeenCalledWith('progress', 'cet4:0')
    expect(idbDelete).toHaveBeenCalledWith('progress', 'cet4:1')
  })
})

describe('损坏数据兜底', () => {
  it('半损坏 JSON：读取返回空对象不抛错', async () => {
    localStorage.setItem(KEY, '{broken')
    const { getLocalProgress, saveLocalProgress } = await import('./localProgress.js')

    expect(() => getLocalProgress('cet4')).not.toThrow()
    expect(getLocalProgress('cet4')).toEqual({})

    // 保存后以空缓存为基点继续工作
    saveLocalProgress('cet4', 0, ['apple'])
    await flushDebounce()
    expect(JSON.parse(localStorage.getItem(KEY))).toEqual({ 'cet4:0': ['apple'] })
  })
})

describe('resetLocalProgressCache（登出断开内存态）', () => {
  it('清空内存缓存并取消待落盘定时器，但不删除 localStorage 数据', async () => {
    localStorage.setItem(KEY, JSON.stringify({ 'cet4:0': ['apple'] }))
    const { saveLocalProgress, getLocalProgress, resetLocalProgressCache } =
      await import('./localProgress.js')

    saveLocalProgress('cet4', 0, ['dog']) // 进入防抖窗口：内存有未落盘变更
    expect(getLocalProgress('cet4')).toEqual({ 0: 2 })

    resetLocalProgressCache()

    // localStorage 数据保持不动，防抖定时器被取消：旧会话内存态不再落盘
    expect(JSON.parse(localStorage.getItem(KEY))['cet4:0']).toEqual(['apple'])
    await flushDebounce()
    expect(JSON.parse(localStorage.getItem(KEY))['cet4:0']).toEqual(['apple'])
    // 内存缓存已断开：下次读取重新从 localStorage bootstrap
    expect(getLocalProgress('cet4')).toEqual({ 0: 1 })
  })
})
