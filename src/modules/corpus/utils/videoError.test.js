// handleVideoPlaybackError 测试：视频播放失败 → reportClientError 上报（便于服务端
// pm2 logs 追查）+ toast 提示，且同一会话 3 秒内 toast 最多弹一次（防连点刷屏）。
// sonner 与 reportError 均 mock；用 fake timers 控制 Date.now 驱动节流窗口。
// 被测模块有节流时间戳模块级状态（lastToastAt）→ 每个用例 resetModules 后动态 import。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  reportClientError: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }))
vi.mock('../../../utils/reportError.js', () => ({ reportClientError: mocks.reportClientError }))

const load = async () => {
  vi.resetModules()
  return await import('./videoError.js')
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('上报', () => {
  it('mediaError.code 与 videoUrl 进入 message，type=video-playback', async () => {
    const { handleVideoPlaybackError } = await load()
    handleVideoPlaybackError('https://x.test/v.mp4', { target: { error: { code: 4 } } })
    expect(mocks.reportClientError).toHaveBeenCalledTimes(1)
    expect(mocks.reportClientError).toHaveBeenCalledWith('video-playback', {
      message: '播放失败 code=4 url=https://x.test/v.mp4',
    })
  })

  it('event 缺失 / 无 error 对象 → code 用 "?" 兜底，且不抛错', async () => {
    const { handleVideoPlaybackError } = await load()
    expect(() => handleVideoPlaybackError('', null)).not.toThrow()
    expect(() => handleVideoPlaybackError('u', { target: null })).not.toThrow()
    expect(mocks.reportClientError).toHaveBeenNthCalledWith(1, 'video-playback', {
      message: '播放失败 code=? url=',
    })
    expect(mocks.reportClientError).toHaveBeenNthCalledWith(2, 'video-playback', {
      message: '播放失败 code=? url=u',
    })
  })
})

describe('toast 3 秒节流', () => {
  it('同一会话 3 秒内连播失败只弹一次 toast，超过 3 秒后可再弹', async () => {
    const { handleVideoPlaybackError } = await load()
    handleVideoPlaybackError('a.mp4', { target: { error: { code: 2 } } })
    handleVideoPlaybackError('b.mp4', { target: { error: { code: 2 } } })
    handleVideoPlaybackError('c.mp4', { target: { error: { code: 3 } } })
    expect(mocks.toastError).toHaveBeenCalledTimes(1)
    expect(mocks.toastError).toHaveBeenCalledWith('视频无法播放，请检查网络或更换设备')

    // 上报不受节流影响：每次失败都记录
    expect(mocks.reportClientError).toHaveBeenCalledTimes(3)

    // 越过节流窗口（> 3000ms）→ 再次弹窗
    vi.advanceTimersByTime(3001)
    handleVideoPlaybackError('d.mp4', { target: { error: { code: 4 } } })
    expect(mocks.toastError).toHaveBeenCalledTimes(2)
  })

  it('恰好 3000ms 时仍在节流窗口内（> 3000 才放行）', async () => {
    const { handleVideoPlaybackError } = await load()
    handleVideoPlaybackError('a.mp4', { target: { error: { code: 1 } } })
    vi.advanceTimersByTime(3000)
    handleVideoPlaybackError('b.mp4', { target: { error: { code: 1 } } })
    expect(mocks.toastError).toHaveBeenCalledTimes(1)
  })
})
