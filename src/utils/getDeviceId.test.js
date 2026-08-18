// @vitest-environment jsdom
// getDeviceId 测试：正常持久化 + localStorage 不可用时会话内稳定。
// 回归：隐私模式（localStorage 抛异常）下曾每次调用生成新随机 id，
// 同一次访问会被服务端当成多台设备。
import { describe, it, expect, beforeEach, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
})

describe('getDeviceId', () => {
  it('正常流程：首次生成并持久化，后续读取同一值', async () => {
    const { getDeviceId } = await import('./getDeviceId.js')
    const first = getDeviceId()
    expect(first).toBeTruthy()
    expect(localStorage.getItem('lf_device_id')).toBe(first)
    expect(getDeviceId()).toBe(first)
  })

  it('localStorage 不可用：会话内多次调用返回同一回退值（回归）', async () => {
    const { getDeviceId } = await import('./getDeviceId.js')
    const getter = Object.getOwnPropertyDescriptor(window, 'localStorage')
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('SecurityError')
      },
      configurable: true,
    })

    try {
      const a = getDeviceId()
      const b = getDeviceId()
      const c = getDeviceId()
      expect(a).toBe(b)
      expect(b).toBe(c)
      expect(a).toMatch(/^d_/)
    } finally {
      if (getter) Object.defineProperty(window, 'localStorage', getter)
    }
  })
})
