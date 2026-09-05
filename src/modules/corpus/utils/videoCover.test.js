// videoCover 纯函数测试：阿里云 OSS 视频截帧 URL 生成与封面优先级解析。
// 仅 OSS 来源（域名提示词匹配）才追加 x-oss-process 截帧参数；显式 coverUrl 永远优先。
import { describe, it, expect } from 'vitest'
import { getOssVideoCover, resolveVideoCover } from './videoCover.js'

describe('getOssVideoCover', () => {
  it('入参非法（空值/非字符串）→ null', () => {
    expect(getOssVideoCover(null)).toBeNull()
    expect(getOssVideoCover(undefined)).toBeNull()
    expect(getOssVideoCover('')).toBeNull()
    expect(getOssVideoCover(123)).toBeNull()
  })

  it.each([
    ['https://www.youtube.com/watch?v=abc', 'youtube'],
    ['https://v.qq.com/x/cover/xyz.html', '腾讯视频'],
    ['https://example.com/media/video/a.mp4', '普通站点'],
  ])('非 OSS 来源（%s）→ null', (url) => {
    expect(getOssVideoCover(url)).toBeNull()
  })

  it.each([
    ['https://bucket.oss-cn-hangzhou.aliyuncs.com/a.mp4', 'aliyuncs.com 域名'],
    ['https://oss-eu-west-1.example.com/a.mp4', 'oss- 前缀域名'],
    ['https://videos.lingoforge.fun/a.mp4', '自定义域名'],
  ])('OSS 来源（%s，%s）→ 追加截帧参数', (url) => {
    const out = getOssVideoCover(url)
    expect(out).toBe(`${url}?x-oss-process=video/snapshot,t_3000,f_jpg,w_800,h_0,m_fast`)
  })

  it('URL 已带查询串 → 用 & 拼接', () => {
    const out = getOssVideoCover('https://bucket.oss-cn-hangzhou.aliyuncs.com/a.mp4?x=1')
    expect(out).toBe(
      'https://bucket.oss-cn-hangzhou.aliyuncs.com/a.mp4?x=1&x-oss-process=video/snapshot,t_3000,f_jpg,w_800,h_0,m_fast'
    )
  })

  it('options 可自定义截帧时间与宽度', () => {
    const out = getOssVideoCover('https://bucket.oss.aliyuncs.com/a.mp4', {
      timeMs: 500,
      width: 320,
    })
    expect(out).toContain('t_500')
    expect(out).toContain('w_320')
  })
})

describe('resolveVideoCover 封面优先级', () => {
  const ossUrl = 'https://bucket.oss.aliyuncs.com/a.mp4'

  it('video 为空 → null', () => {
    expect(resolveVideoCover(null)).toBeNull()
    expect(resolveVideoCover(undefined)).toBeNull()
  })

  it('显式 coverUrl 优先，即便 videoUrl 是 OSS 来源也不截帧', () => {
    const video = { videoUrl: ossUrl, coverUrl: 'https://cdn.example.com/poster.jpg' }
    expect(resolveVideoCover(video)).toBe('https://cdn.example.com/poster.jpg')
  })

  it('无 coverUrl 且 videoUrl 来自 OSS → 自动截帧', () => {
    expect(resolveVideoCover({ videoUrl: ossUrl })).toBe(
      `${ossUrl}?x-oss-process=video/snapshot,t_3000,f_jpg,w_800,h_0,m_fast`
    )
  })

  it('无 coverUrl 且非 OSS → null（调用方决定占位样式）', () => {
    expect(resolveVideoCover({ videoUrl: 'https://example.com/a.mp4' })).toBeNull()
  })

  it('options 透传给截帧参数', () => {
    const out = resolveVideoCover({ videoUrl: ossUrl }, { timeMs: 1000, width: 640 })
    expect(out).toContain('t_1000')
    expect(out).toContain('w_640')
  })
})
