// @vitest-environment jsdom
// unlockAudio 生命周期测试：复用 suspended 实例、重建前关闭旧实例。
// 回归：suspended 时直接 new 覆盖引用且不 close 旧的，
// 浏览器并发 AudioContext 硬上限（约 6 个）被耗尽后所有音效静音。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

function makeFakeAudioContext() {
  const created = []
  class FakeCtx {
    constructor() {
      this.state = 'suspended'
      created.push(this)
    }
    async resume() {
      if (this.resumeShouldFail) return // 模拟 resume 无法恢复
      this.state = 'running'
    }
    async close() {
      this.state = 'closed'
    }
  }
  return { FakeCtx, created }
}

let restoreCtor
beforeEach(() => {
  vi.resetModules()
  restoreCtor = null
})

afterEach(() => {
  if (restoreCtor) restoreCtor()
})

async function loadModule(FakeCtx) {
  const hadOwn = Object.prototype.hasOwnProperty.call(window, 'AudioContext')
  const prev = window.AudioContext
  window.AudioContext = FakeCtx
  restoreCtor = () => {
    if (hadOwn) window.AudioContext = prev
    else delete window.AudioContext
  }
  return import('./audioContext.js')
}

describe('unlockAudio', () => {
  it('重复解锁复用同一实例，不重复创建', async () => {
    const { FakeCtx, created } = makeFakeAudioContext()
    const { unlockAudio } = await loadModule(FakeCtx)

    const ctx1 = await unlockAudio()
    const ctx2 = await unlockAudio()
    expect(ctx2).toBe(ctx1)
    expect(created).toHaveLength(1)
  })

  it('suspended 实例原地 resume，不新建', async () => {
    const { FakeCtx, created } = makeFakeAudioContext()
    const { unlockAudio, getAudioContext } = await loadModule(FakeCtx)
    await unlockAudio()

    getAudioContext().state = 'suspended' // 模拟被浏览器挂起
    const ctx = await unlockAudio()
    expect(ctx).toBe(getAudioContext())
    expect(created).toHaveLength(1) // 没有新建
    expect(ctx.state).toBe('running')
  })

  it('resume 无法恢复必须重建时，先关闭旧实例再新建（回归：泄漏）', async () => {
    const { FakeCtx, created } = makeFakeAudioContext()
    const { unlockAudio, getAudioContext } = await loadModule(FakeCtx)

    const old = await unlockAudio()
    old.state = 'suspended'
    old.resumeShouldFail = true

    const ctx = await unlockAudio()
    expect(created).toHaveLength(2) // 重建了
    expect(old.state).toBe('closed') // 旧的被关闭，不再泄漏
    expect(ctx).toBe(getAudioContext())
    expect(ctx.state).toBe('running')
  })
})
