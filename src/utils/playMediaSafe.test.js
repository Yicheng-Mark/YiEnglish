// playMediaSafe 测试：iOS WebKit 偶尔让 HTMLMediaElement.play() 返回 undefined 而非
// Promise，直接 .catch() 会抛错并冒泡到错误边界导致整页崩溃。这里锁定四个分支：
// play() 正常 Promise / 返回 undefined / 返回 null 等非 Promise / play() 自身同步 throw，
// 全部静默处理，绝不向上抛。
import { describe, it, expect, vi } from 'vitest'
import { playMediaSafe } from './playMediaSafe.js'

describe('playMediaSafe', () => {
  it('media 为空 → 直接返回，不触碰 play', () => {
    const play = vi.fn()
    expect(() => playMediaSafe(null)).not.toThrow()
    expect(() => playMediaSafe(undefined)).not.toThrow()
    expect(play).not.toHaveBeenCalled()
  })

  it('play() 返回正常 Promise → 不抛错', async () => {
    const play = vi.fn(() => Promise.resolve())
    expect(() => playMediaSafe({ play })).not.toThrow()
    await Promise.resolve()
    expect(play).toHaveBeenCalledTimes(1)
  })

  it('play() 返回 rejected Promise（如自动播放被拦截）→ 挂上 catch 静默吞掉', async () => {
    const play = vi.fn(() => Promise.reject(new Error('NotAllowedError')))
    expect(() => playMediaSafe({ play })).not.toThrow()
    // rejection 已被消费，等一拍确认没有未处理 rejection 冒出
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  it('play() 返回 undefined（iOS WebKit bug）→ 访问 .catch 前被挡住，不抛错', () => {
    const play = vi.fn(() => undefined)
    expect(() => playMediaSafe({ play })).not.toThrow()
  })

  it('play() 返回 null → 不抛错', () => {
    const play = vi.fn(() => null)
    expect(() => playMediaSafe({ play })).not.toThrow()
  })

  it('play() 返回无 catch 方法的对象（非 Promise）→ 不抛错', () => {
    const play = vi.fn(() => ({ then: 'not a promise' }))
    expect(() => playMediaSafe({ play })).not.toThrow()
  })

  it('play() 自身同步 throw → 被吞掉，不向 React 副作用冒泡', () => {
    const play = vi.fn(() => {
      throw new Error('play is not a function-ish state')
    })
    expect(() => playMediaSafe({ play })).not.toThrow()
  })
})
