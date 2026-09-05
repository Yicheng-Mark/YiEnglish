// lazyRetry 测试：React.lazy 动态 import 失败时自动刷新一次页面（发版后旧 html 引用
// 失效 chunk 的场景）；window.__chunkReloaded 守卫防止刷新循环（第二次直接抛出原错误
// 交给 ErrorBoundary）；成功路径不触发 reload。
// vitest 全局为 node 环境，手动 stub window/window.location。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { lazyRetry } from './lazyRetry.js'

// React.lazy(ctor) 开发版返回 { $$typeof, _payload: { _status, _result: ctor } }，
// 直接取出被包裹的 factory 触发加载逻辑（无需真正渲染 Suspense）。
function getFactory(LazyComponent) {
  return LazyComponent._payload._result
}

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  vi.stubGlobal('window', { location: { reload: vi.fn() } })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('成功路径', () => {
  it('dynamicImport 成功 → 正常拿到模块，不触发 reload', async () => {
    const Comp = lazyRetry(() => Promise.resolve({ default: () => null }))
    const mod = await getFactory(Comp)()
    expect(typeof mod.default).toBe('function')
    expect(window.location.reload).not.toHaveBeenCalled()
    expect(window.__chunkReloaded).toBeUndefined()
  })
})

describe('首次失败 → 刷新一次', () => {
  it('reload 恰好一次、__chunkReloaded 被置位，且本次加载永不 resolve（阻止 ErrorBoundary 误触发）', async () => {
    const err = new Error('Loading chunk 5 failed')
    const Comp = lazyRetry(() => Promise.reject(err))
    const promise = getFactory(Comp)()

    await flushMicrotasks()
    expect(window.location.reload).toHaveBeenCalledTimes(1)
    expect(window.__chunkReloaded).toBe(true)

    // reload 后返回永不 resolve 的 Promise，避免刷新完成前抛错
    let settled = false
    promise.then(
      () => {
        settled = true
      },
      () => {
        settled = true
      }
    )
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(settled).toBe(false)
  })
})

describe('__chunkReloaded 守卫（防死循环）', () => {
  it('刷新后再次失败 → 直接 reject 原错误，不再 reload', async () => {
    window.__chunkReloaded = true
    const err = new Error('Loading chunk 7 failed')
    const Comp = lazyRetry(() => Promise.reject(err))

    await expect(getFactory(Comp)()).rejects.toThrow('Loading chunk 7 failed')
    expect(window.location.reload).not.toHaveBeenCalled()
  })

  it('reload 本身抛错（极端环境）→ 兜底抛出原错误而非卡死', async () => {
    window.location.reload = vi.fn(() => {
      throw new Error('reload blocked')
    })
    const Comp = lazyRetry(() => Promise.reject(new Error('chunk 404')))

    await expect(getFactory(Comp)()).rejects.toThrow('chunk 404')
  })
})
