/**
 * 轻量客户端错误上报：把前端运行时错误 POST 到 /api/client-error。
 * - 永不抛错（整体 try/catch），上报失败完全静默，绝不影响业务。
 * - 内存去重（同 type+message 只报一次），避免循环错误刷屏。
 * - 优先 navigator.sendBeacon（页面卸载/刷新也可靠，iOS 11.3+），回退 fetch keepalive。
 * 用于 ErrorBoundary / window error / unhandledrejection / 模块加载失败。
 */
const API_BASE = import.meta.env.VITE_API_BASE_URL || ''
const ENDPOINT = `${API_BASE}/api/client-error`
const MAX = 2000
const SEEN_LIMIT = 50
const seen = new Set()

function truncate(value, n) {
  const str = value == null ? '' : String(value)
  return str.length > n ? str.slice(0, n) : str
}

export function reportClientError(type, error, extra = {}) {
  try {
    const err = error || {}
    const message = truncate(err.message || String(error || 'unknown'), MAX)
    const stack = truncate(err.stack || extra.componentStack || '', MAX)

    // 去重：同一条错误只发一次，防止循环报错刷爆服务端日志
    const key = `${type}::${message}`
    if (seen.has(key)) return
    if (seen.size >= SEEN_LIMIT) seen.clear()
    seen.add(key)

    const payload = JSON.stringify({
      type,
      message,
      stack,
      href: typeof location !== 'undefined' ? location.href : '',
      ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      ts: Date.now(),
    })

    // 优先 sendBeacon：即使在 unload/reload 期间也能发出
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([payload], { type: 'application/json' })
      if (navigator.sendBeacon(ENDPOINT, blob)) return
    }

    // 回退 fetch keepalive
    if (typeof fetch === 'function') {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {})
    }
  } catch (_) {
    // 上报本身绝不能抛错
  }
}
