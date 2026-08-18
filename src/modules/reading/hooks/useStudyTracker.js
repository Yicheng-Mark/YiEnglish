import { useEffect, useRef } from 'react'
import { useReadingStore } from './useReadingStore'

const FLUSH_INTERVAL_MS = 30 * 1000
const MAX_SESSION_MS = 30 * 60 * 1000

/**
 * 页面级学习时长追踪（visibility 感知，后台标签页不计时）。
 * @param {string|null} sessionKey 会话标识，任意非空字符串即可开启计时；
 *   文章页传文章 id，列表/语法页传固定 key。路由互斥的页面各自挂载，不会重复计时。
 */
export default function useStudyTracker(sessionKey) {
  const store = useReadingStore()
  const addReadingSecondsRef = useRef(store.addReadingSeconds)
  addReadingSecondsRef.current = store.addReadingSeconds
  const sessionStart = useRef(null)
  const accumulated = useRef(0)

  useEffect(() => {
    if (!sessionKey) return

    const start = () => {
      if (sessionStart.current == null) sessionStart.current = Date.now()
    }

    const pause = () => {
      if (sessionStart.current == null) return
      const delta = Math.min(Date.now() - sessionStart.current, MAX_SESSION_MS)
      accumulated.current += Math.max(0, delta)
      sessionStart.current = null
    }

    const flush = () => {
      pause()
      const sec = Math.floor(accumulated.current / 1000)
      if (sec > 0) {
        addReadingSecondsRef.current(sec)
        accumulated.current -= sec * 1000
      }
      // 周期性 flush 后必须重启计时，否则只有第一个间隔会被计入
      if (document.visibilityState !== 'hidden') start()
    }

    const handleVisibility = () => {
      if (document.hidden) flush()
      else start()
    }

    if (document.visibilityState !== 'hidden') start()

    const interval = setInterval(flush, FLUSH_INTERVAL_MS)
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('beforeunload', flush)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('beforeunload', flush)
      flush()
    }
  }, [sessionKey])
}
