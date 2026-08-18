// @vitest-environment jsdom
// favoriteDicts 测试：切换/同步基础行为 + 落盘失败（配额满/隐私模式）不崩溃。
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { toggleFavoriteDict } = vi.hoisted(() => ({ toggleFavoriteDict: vi.fn() }))
vi.mock('../lib/api-favorites', () => ({
  fetchFavoriteDicts: vi.fn().mockResolvedValue({ dicts: [] }),
  toggleFavoriteDict,
}))

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
  toggleFavoriteDict.mockReset().mockResolvedValue({ success: true })
})

describe('favoriteDicts', () => {
  it('toggle 切换收藏并落盘', async () => {
    const mod = await import('./favoriteDicts.js')
    expect(mod.isFavorite('cet4')).toBe(false)
    mod.toggleFavorite('cet4')
    expect(mod.isFavorite('cet4')).toBe(true)
    expect(JSON.parse(localStorage.getItem('lf_favorite_dicts'))).toEqual(['cet4'])

    mod.toggleFavorite('cet4')
    expect(mod.isFavorite('cet4')).toBe(false)
    expect(toggleFavoriteDict).toHaveBeenCalledTimes(2)
  })

  it('localStorage 写入抛异常时不崩溃，内存态保持一致（回归：persist 无容错）', async () => {
    const mod = await import('./favoriteDicts.js')
    const orig = localStorage.setItem.bind(localStorage)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    localStorage.setItem = vi.fn(() => {
      throw new Error('QuotaExceededError')
    })

    try {
      expect(() => mod.toggleFavorite('cet4')).not.toThrow()
      expect(mod.isFavorite('cet4')).toBe(true) // 内存态仍正确
    } finally {
      localStorage.setItem = orig
      warnSpy.mockRestore()
    }
  })
})
