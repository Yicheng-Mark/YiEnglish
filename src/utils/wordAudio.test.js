// @vitest-environment jsdom
// wordAudio（有道优先 / speechSynthesis 降级）测试。
//
// 重点钉住的回归点：
// - 3s 超时路径里 pause() 会让未出帧的 play() promise 以 AbortError 拒绝，
//   catch 分支晚于超时分支执行——降级必须只发生一次（曾双触发把语音 cancel+restart）
// - stalled/abort 等瞬断降级时必须同时 pause 掉 audio（防网络恢复后叠音）
// - voices 为空时 voiceschanged 与 1s 兜底只 settle 一次（语音不重启两遍）
// - stop() 之后任何路径都不再触发降级
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { playWordTTS } from './wordAudio.js'

// —— Fake Audio：模拟浏览器 Audio 元素在本模块用到的行为子集 ——
// 关键行为：pause() 会拒绝尚未出帧的 play() promise（"interrupted by a call
// to pause()"），这正是超时路径双降级回归的触发器
class FakeAudio {
  constructor(src) {
    this.src = src
    this.paused = false
    this.playCalls = 0
    this.pauseCalls = 0
    this._pending = null
  }
  play() {
    this.playCalls += 1
    return new Promise((resolve, reject) => {
      this._pending = { resolve, reject }
    })
  }
  pause() {
    this.paused = true
    this.pauseCalls += 1
    if (this._pending && !this._pending.settled) {
      this._pending.settled = true
      this._pending.reject(new Error('The play() request was interrupted by a call to pause()'))
    }
  }
  load() {}
}

let createdAudios
let speakMock
let cancelMock
let voices

beforeEach(() => {
  vi.useFakeTimers()
  createdAudios = []
  voices = [{ lang: 'en-US', name: 'Mock Voice' }]
  speakMock = vi.fn()
  cancelMock = vi.fn()
  vi.stubGlobal('Audio', function FakeAudioCtor(src) {
    const a = new FakeAudio(src)
    createdAudios.push(a)
    return a
  })
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      constructor(text) {
        this.text = text
      }
    }
  )
  window.speechSynthesis = {
    getVoices: () => voices,
    speak: speakMock,
    cancel: cancelMock,
    onvoiceschanged: null,
  }
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete window.speechSynthesis
  vi.useRealTimers()
})

describe('playWordTTS', () => {
  it('有道正常播放（onplay）→ 不降级，3s 后也不降级', async () => {
    playWordTTS('apple')
    const audio = createdAudios[0]
    expect(audio.playCalls).toBe(1)

    audio.onplay() // 播放开始：清掉超时监督
    await vi.advanceTimersByTimeAsync(3000)

    expect(speakMock).not.toHaveBeenCalled()
    expect(cancelMock).not.toHaveBeenCalled()
  })

  it('3s 超时 → 降级恰好一次：pause() 触发的 play() 拒绝不重复降级（回归）', async () => {
    playWordTTS('apple')
    const audio = createdAudios[0]

    // 超时分支：pause + 降级；随后 play() promise 拒绝 → catch 分支
    await vi.advanceTimersByTimeAsync(3000)

    expect(audio.pauseCalls).toBeGreaterThanOrEqual(1)
    expect(speakMock).toHaveBeenCalledTimes(1) // 曾是 2 次（cancel+restart）
    expect(speakMock.mock.calls[0][0].text).toBe('apple')
  })

  it('play() 直接拒绝 → 降级一次', async () => {
    playWordTTS('apple')
    const audio = createdAudios[0]
    audio._pending.reject(new Error('NotAllowedError'))
    await vi.advanceTimersByTimeAsync(0)

    expect(speakMock).toHaveBeenCalledTimes(1)
  })

  it('onerror 瞬断降级 → 同时 pause 掉 audio（防网络恢复后叠音）', async () => {
    playWordTTS('apple')
    const audio = createdAudios[0]
    audio.onerror()

    expect(audio.paused).toBe(true)
    expect(speakMock).toHaveBeenCalledTimes(1)
  })

  it('stop() 后：超时到点不再降级，audio 被暂停', async () => {
    const stop = playWordTTS('apple')
    const audio = createdAudios[0]
    stop()
    await vi.advanceTimersByTimeAsync(3000)

    expect(audio.paused).toBe(true)
    expect(speakMock).not.toHaveBeenCalled()
  })

  it('voices 为空：voiceschanged 与 1s 兜底只 settle 一次，语音不播两遍', async () => {
    voices = []
    playWordTTS('apple')
    const audio = createdAudios[0]
    audio.onerror() // 触发降级 → 注册 voiceschanged + 1s 兜底

    expect(speakMock).not.toHaveBeenCalled() // voices 未就位，等事件
    const handler = window.speechSynthesis.onvoiceschanged
    expect(typeof handler).toBe('function')

    voices = [{ lang: 'en-US', name: 'Mock Voice' }]
    handler() // voiceschanged 先到
    await vi.advanceTimersByTimeAsync(1000) // 1s 兜底后到，不应再触发

    expect(speakMock).toHaveBeenCalledTimes(1)
    expect(window.speechSynthesis.onvoiceschanged).toBeNull()
  })

  it('stop() 会 cancel 正在进行的 speechSynthesis', () => {
    const stop = playWordTTS('apple')
    stop()
    expect(cancelMock).toHaveBeenCalled()
  })

  it('空词 → 返回无操作 stop，不创建 Audio', () => {
    const stop = playWordTTS('   ')
    expect(createdAudios).toHaveLength(0)
    expect(typeof stop).toBe('function')
    stop() // 可安全重复调用
  })
})
