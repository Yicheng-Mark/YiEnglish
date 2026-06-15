/**
 * 视频播放失败处理：弹 toast 提示用户 + 上报到 /api/client-error 便于服务端 pm2 logs 追查。
 *
 * MediaError.code 含义：
 *   1 = MEDIA_ERR_ABORTED      用户中止（通常可忽略）
 *   2 = MEDIA_ERR_NETWORK      网络错误
 *   3 = MEDIA_ERR_DECODE       解码失败（如老 iPhone 遇到 AV1）
 *   4 = MEDIA_ERR_SRC_NOT_SUPPORTED  格式/编码不支持（如 iOS 严格遵循 attachment、或 AV1）
 *
 * 上报走 reportClientError（已内置去重 + sendBeacon），toast 单独节流避免连点刷屏。
 */
import { toast } from 'sonner'
import { reportClientError } from '../../../utils/reportError.js'

let lastToastAt = 0

export function handleVideoPlaybackError(videoUrl, event) {
  const mediaError = event?.target?.error || {}
  const code = mediaError.code ?? '?'

  reportClientError('video-playback', {
    message: `播放失败 code=${code} url=${videoUrl || ''}`,
  })

  // 同一会话 3 秒内最多弹一次 toast
  const now = Date.now()
  if (now - lastToastAt > 3000) {
    lastToastAt = now
    toast.error('视频无法播放，请检查网络或更换设备')
  }
}
