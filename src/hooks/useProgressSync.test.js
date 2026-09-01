// @vitest-environment jsdom
// useProgressSync（Typing.jsx 抽离的进度刷新副作用与收藏逻辑）测试：
// 完成时/卸载时 flush、收藏状态随当前词同步、toggle 双路径、事件 stopPropagation。
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  isInFavoriteWords: vi.fn().mockReturnValue(false),
  addToFavoriteWords: vi.fn(),
  removeFromFavoriteWords: vi.fn(),
}))
vi.mock('../utils/favoriteWords.js', () => ({
  isInFavoriteWords: mocks.isInFavoriteWords,
  addToFavoriteWords: mocks.addToFavoriteWords,
  removeFromFavoriteWords: mocks.removeFromFavoriteWords,
}))

import useProgressSync from './useProgressSync.js'

function renderSync(overrides = {}) {
  const props = {
    flushServerProgress: vi.fn(),
    isFinished: false,
    currentWord: null,
    ...overrides,
  }
  const result = renderHook(
    ({ flushServerProgress, isFinished, currentWord }) =>
      useProgressSync({ flushServerProgress, isFinished, currentWord }),
    { initialProps: props }
  )
  return { ...result, props }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.isInFavoriteWords.mockReturnValue(false)
})

describe('进度刷新副作用', () => {
  it('isFinished → flush', () => {
    const { result, props, rerender } = renderSync()
    rerender({ ...props, isFinished: true })
    expect(props.flushServerProgress).toHaveBeenCalledTimes(1)
  })

  it('isFinished=false → 不 flush', () => {
    const h = renderSync()
    act(() => {})
    expect(h.props.flushServerProgress).not.toHaveBeenCalled()
  })

  it('卸载 → flush', () => {
    const h = renderSync()
    h.unmount()
    expect(h.props.flushServerProgress).toHaveBeenCalledTimes(1)
  })
})

describe('收藏状态同步', () => {
  it('currentWord 切换 → 状态跟随 isInFavoriteWords', () => {
    mocks.isInFavoriteWords.mockReturnValueOnce(true)
    const { result, rerender, props } = renderSync({ currentWord: { name: 'apple' } })
    expect(result.current.isCurrentWordFavorited).toBe(true)

    mocks.isInFavoriteWords.mockReturnValue(false)
    rerender({ ...props, currentWord: { name: 'bee' } })
    expect(result.current.isCurrentWordFavorited).toBe(false)
  })

  it('currentWord 为空 → false', () => {
    const { result } = renderSync({ currentWord: null })
    expect(result.current.isCurrentWordFavorited).toBe(false)
  })
})

describe('handleToggleFavorite', () => {
  it('未收藏 → add + 置 true', () => {
    mocks.isInFavoriteWords.mockReturnValue(false)
    const { result } = renderSync({ currentWord: { name: 'apple', trans: ['x'] } })
    const e = { stopPropagation: vi.fn() }
    act(() => result.current.handleToggleFavorite(e))
    expect(e.stopPropagation).toHaveBeenCalled()
    expect(mocks.addToFavoriteWords).toHaveBeenCalledWith({ name: 'apple', trans: ['x'] })
    expect(mocks.removeFromFavoriteWords).not.toHaveBeenCalled()
    expect(result.current.isCurrentWordFavorited).toBe(true)
  })

  it('已收藏 → remove + 置 false', () => {
    mocks.isInFavoriteWords.mockReturnValueOnce(true).mockReturnValue(true)
    const { result } = renderSync({ currentWord: { name: 'apple' } })
    expect(result.current.isCurrentWordFavorited).toBe(true)
    act(() => result.current.handleToggleFavorite({ stopPropagation: vi.fn() }))
    expect(mocks.removeFromFavoriteWords).toHaveBeenCalledWith('apple')
    expect(result.current.isCurrentWordFavorited).toBe(false)
  })

  it('无当前词 → no-op', () => {
    const { result } = renderSync({ currentWord: null })
    act(() => result.current.handleToggleFavorite({ stopPropagation: vi.fn() }))
    expect(mocks.addToFavoriteWords).not.toHaveBeenCalled()
    expect(mocks.removeFromFavoriteWords).not.toHaveBeenCalled()
  })
})
