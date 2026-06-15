/**
 * 利用阿里云 OSS 的视频截帧能力自动生成封面 URL。
 * 文档: https://help.aliyun.com/zh/oss/user-guide/video-snapshots
 *
 * 仅对来自 OSS 的视频生效（按域名前缀判断），其他来源返回 null。
 */
// 含自定义域名 videos.lingoforge.fun（浏览器访问入口）；aliyuncs.com/oss- 保留用于直连。
const OSS_HOST_HINTS = ['aliyuncs.com', 'oss-', 'lingoforge.fun']

export function getOssVideoCover(videoUrl, { timeMs = 3000, width = 800 } = {}) {
  if (!videoUrl || typeof videoUrl !== 'string') return null
  const isOss = OSS_HOST_HINTS.some((hint) => videoUrl.includes(hint))
  if (!isOss) return null
  const sep = videoUrl.includes('?') ? '&' : '?'
  const params = `x-oss-process=video/snapshot,t_${timeMs},f_jpg,w_${width},h_0,m_fast`
  return `${videoUrl}${sep}${params}`
}

/**
 * 解析视频对象的封面优先级:
 * 1. 显式指定的 coverUrl
 * 2. 从 OSS 视频自动截帧
 * 3. null（由调用方决定占位样式）
 */
export function resolveVideoCover(video, options) {
  if (!video) return null
  if (video.coverUrl) return video.coverUrl
  return getOssVideoCover(video.videoUrl, options)
}
