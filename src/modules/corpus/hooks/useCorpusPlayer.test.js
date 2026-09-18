// @vitest-environment jsdom
// useCorpusPlayer 的 intervalGap 切期清理回归测试。
//
// 钉住的 bug：句末间隔（intervalGap）等待中的定时器闭包持有旧期 cue.id，
// 而每期字幕 id 都从 1 开始——切期后放任旧定时器到期，会在新字幕里 findIndex
// 命中旧 id，把新视频从中间某句突然开播。修复：subtitles 变化时清掉待执行
// 定时器与防抖标记。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCorpusPlayer } from './useCorpusPlayer.js'

// 期 A：3 句，秒数区间与期 B 完全错开
const EPISODE_A = [
  { id: 1, start: 0, end: 5, text: 'a1' },
  { id: 2, start: 5, end: 10, text: 'a2' },
  { id: 3, start: 10, end: 15, text: 'a3' },
]
// 期 B：id 同样从 1 开始（bug 触发条件），start 取特殊值便于断言「没被跳过去」
const EPISODE_B = [
  { id: 1, start: 0, end: 5, text: 'b1' },
  { id: 2, start: 42, end: 47, text: 'b2' },
  { id: 3, start: 47, end: 52, text: 'b3' },
]

function makeFakeVideo() {
  const listeners = new Map()
  const v = {
    currentTime: 0,
    duration: 60,
    paused: false,
    playbackRate: 1,
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type).add(fn)
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn)
    },
    emit(type) {
      for (const fn of listeners.get(type) ?? []) fn()
    },
    play: vi.fn(() => Promise.resolve()),
  }
  v.pause = vi.fn(() => {
    v.paused = true
  })
  return v
}

let video
let videoRef

beforeEach(() => {
  vi.useFakeTimers()
  video = makeFakeVideo()
  videoRef = { current: video }
})

afterEach(() => {
  vi.useRealTimers()
})

// 驱动到「句 1 播完、intervalGap=2s 等待中」状态：返回 player 供断言
async function arriveAtIntervalWait(subtitles) {
  const rendered = renderHook(
    ({ subs }) => useCorpusPlayer({ videoRef, subtitles: subs, videoEl: null }),
    { initialProps: { subs: subtitles } }
  )
  const { player } = rendered.result.current
  act(() => {
    player.setIntervalGap(2)
  })

  // 进入句 1
  video.currentTime = 1
  act(() => {
    video.emit('timeupdate')
  })
  expect(rendered.result.current.player.activeId).toBe(1)

  // 句 1 末尾（后备逻辑分支）：暂停 + 排定 2s 后跳句 2 的定时器
  video.currentTime = 4.97
  act(() => {
    video.emit('timeupdate')
  })
  expect(video.pause).toHaveBeenCalled()
  return rendered
}

describe('useCorpusPlayer — intervalGap 切期清理', () => {
  it('同期内：间隔到点正常跳下一句（机制本身工作）', async () => {
    await arriveAtIntervalWait(EPISODE_A)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    expect(video.currentTime).toBe(5) // 句 2 起点
    expect(video.play).toHaveBeenCalled()
  })

  it('切期后：旧期的间隔定时器被清理，不把新视频从中间某句开播（回归）', async () => {
    const rendered = await arriveAtIntervalWait(EPISODE_A)

    // 切期：subtitles 换成期 B（新数组引用）
    rendered.rerender({ subs: EPISODE_B })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    // 旧定时器持有句 id=1 的闭包：未清理会在期 B 里命中 id=1 → 跳到 start=42
    expect(video.currentTime).not.toBe(42)
    expect(video.currentTime).toBe(4.97) // 停在切期时的位置
    expect(video.play).not.toHaveBeenCalled()
    // 切期同时复位活跃句：期 B 从头开始时 activeId 不残留期 A 的句号
    expect(rendered.result.current.player.activeId).toBeNull()
  })

  it('切期后恢复播放：新期正常推进，activeId 按新字幕计算', async () => {
    const rendered = await arriveAtIntervalWait(EPISODE_A)
    rendered.rerender({ subs: EPISODE_B })

    video.paused = false
    video.currentTime = 1
    act(() => {
      video.emit('timeupdate')
    })
    expect(rendered.result.current.player.activeId).toBe(1) // 期 B 的句 1

    video.currentTime = 43
    act(() => {
      video.emit('timeupdate')
    })
    expect(rendered.result.current.player.activeId).toBe(2) // 期 B 的句 2（start=42）
  })
})
