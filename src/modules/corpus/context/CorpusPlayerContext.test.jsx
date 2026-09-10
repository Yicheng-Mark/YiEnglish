// @vitest-environment jsdom
// CorpusPlayerContext 拆分回归：currentTime（timeupdate ~4Hz 高频）必须被隔离在
// time context，不得引起 useCorpusContext / player 消费者重渲染；
// 播放状态（play/pause）等 player 字段变化仍要正常传导。
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import React from 'react'

vi.mock('../../../utils/loadDictionary.js', () => ({
  loadDictionary: vi.fn().mockResolvedValue({ chapters: [] }),
}))

import { CorpusPlayerProvider, useCorpusContext, useCorpusTime } from './CorpusPlayerContext.jsx'

const VIDEO = { id: 'v1', title: 't', subtitleUrl: 'http://localhost/subs.json' }

// 计数器探针：分别统计 stable/player 消费者与 time 消费者的渲染次数
let stableRenders
let timeRenders

function StableProbe() {
  const ctx = useCorpusContext()
  stableRenders++
  return <div data-testid="stable">{ctx.player.isPlaying ? 'playing' : 'paused'}</div>
}

function TimeProbe() {
  const t = useCorpusTime()
  timeRenders++
  return <div data-testid="time">{t.toFixed(1)}</div>
}

function Harness() {
  const { videoCallbackRef } = useCorpusContext()
  return (
    <>
      <video ref={videoCallbackRef} />
      <StableProbe />
      <TimeProbe />
    </>
  )
}

beforeEach(() => {
  stableRenders = 0
  timeRenders = 0
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }))
})

describe('currentTime 隔离（高频重渲染回归）', () => {
  it('timeupdate 只重渲染 time 消费者，player/stable 消费者不受影响', async () => {
    const { container } = render(
      <CorpusPlayerProvider video={VIDEO}>
        <Harness />
      </CorpusPlayerProvider>
    )
    const video = container.querySelector('video')
    expect(video).toBeTruthy()
    // 等字幕 fetch 与词典空加载落地，渲染计数进入稳态
    await act(async () => {
      await Promise.resolve()
    })
    const stableBase = stableRenders
    const timeBase = timeRenders

    // 模拟两次 timeupdate tick（播放期间 ~4Hz）
    await act(async () => {
      video.currentTime = 3
      video.dispatchEvent(new Event('timeupdate'))
    })
    await act(async () => {
      video.currentTime = 6
      video.dispatchEvent(new Event('timeupdate'))
    })

    // time 消费者跟随更新
    expect(timeRenders).toBeGreaterThan(timeBase)
    expect(document.querySelector('[data-testid="time"]').textContent).toBe('6.0')
    // stable/player 消费者渲染次数不变（回归点：旧实现 player 身份每 tick 重建）
    expect(stableRenders).toBe(stableBase)
  })

  it('播放状态变化仍传导给 player 消费者（拆分不丢状态）', async () => {
    const { container } = render(
      <CorpusPlayerProvider video={VIDEO}>
        <Harness />
      </CorpusPlayerProvider>
    )
    const video = container.querySelector('video')
    await act(async () => {
      await Promise.resolve()
    })
    expect(document.querySelector('[data-testid="stable"]').textContent).toBe('paused')

    await act(async () => {
      video.dispatchEvent(new Event('play'))
    })
    expect(document.querySelector('[data-testid="stable"]').textContent).toBe('playing')

    await act(async () => {
      video.dispatchEvent(new Event('pause'))
    })
    expect(document.querySelector('[data-testid="stable"]').textContent).toBe('paused')
  })
})
