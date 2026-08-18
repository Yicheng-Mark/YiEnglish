import { useCallback, useEffect, useRef, useState } from 'react'
import { playMediaSafe } from '../../../utils/playMediaSafe.js'

export function useCorpusPlayer({ videoRef, subtitles, videoEl }) {
  const [activeId, setActiveId] = useState(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [rate, setRateState] = useState(1)
  // 单句循环次数：0=关闭, -1=无限, 正数=总播放次数
  const [loopCount, setLoopCountState] = useState(0)

  // 单句结束自动暂停
  const [pauseAfterCue, setPauseAfterCue] = useState(false)
  // 间隔（秒），用于听写/跟读自动重播时的等待时间
  const [intervalGap, setIntervalGapState] = useState(0)
  // 隐藏字幕面板：右侧字幕列表 / 下方当前句卡片 独立控制
  const [hideSubtitleRight, setHideSubtitleRight] = useState(false)
  const [hideSubtitleBottom, setHideSubtitleBottom] = useState(false)

  const loopCountRef = useRef(0)
  const loopsRemainingRef = useRef(0)
  const pauseAfterCueRef = useRef(false)
  const activeIdRef = useRef(null)
  const subtitlesRef = useRef(subtitles)
  // 已触发过 pauseAfterCue 的 cueId（防抖：同一句不重复触发）
  const lastPausedCueRef = useRef(null)
  // 间隔相关：当前生效值、待执行的定时器、已触发过的 cueId（防抖）
  const intervalGapRef = useRef(0)
  const intervalTimerRef = useRef(null)
  const lastIntervalCueRef = useRef(null)
  const hideSubtitleRightRef = useRef(false)
  const hideSubtitleBottomRef = useRef(false)

  useEffect(() => {
    loopCountRef.current = loopCount
  }, [loopCount])
  useEffect(() => {
    pauseAfterCueRef.current = pauseAfterCue
  }, [pauseAfterCue])
  useEffect(() => {
    intervalGapRef.current = intervalGap
  }, [intervalGap])
  useEffect(() => {
    subtitlesRef.current = subtitles
  }, [subtitles])
  useEffect(() => {
    hideSubtitleRightRef.current = hideSubtitleRight
  }, [hideSubtitleRight])
  useEffect(() => {
    hideSubtitleBottomRef.current = hideSubtitleBottom
  }, [hideSubtitleBottom])

  // 退出全屏时解锁横屏
  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) screen.orientation?.unlock?.()
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  const clearIntervalTimer = useCallback(() => {
    if (intervalTimerRef.current) {
      clearTimeout(intervalTimerRef.current)
      intervalTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return

    const onTime = () => {
      const t = v.currentTime
      setCurrentTime(t)

      const cues = subtitlesRef.current
      let next = null
      for (const c of cues) {
        if (t >= c.start && t < c.end) {
          next = c
          break
        }
      }
      const nextId = next?.id ?? null
      if (nextId !== activeIdRef.current) {
        // 如果离开了上一个句子，先检查是否需要对上一句执行 pauseAfterCue / intervalGap / loop
        const prevId = activeIdRef.current
        const prevCue = prevId != null ? cues.find((c) => c.id === prevId) : null
        if (prevCue) {
          // pauseAfterCue
          if (pauseAfterCueRef.current) {
            // 已对该句暂停过且视频仍在暂停 → 阻止跳转
            if (v.paused && lastPausedCueRef.current === prevCue.id) {
              return
            }
            // 首次到达该句末尾 → 暂停
            if (lastPausedCueRef.current !== prevCue.id) {
              lastPausedCueRef.current = prevCue.id
              v.pause()
              activeIdRef.current = prevId
              setActiveId(prevId)
              loopsRemainingRef.current = loopCountRef.current > 0 ? loopCountRef.current - 1 : 0
              return
            }
            // 用户已恢复播放（v.paused === false）→ 放行，进入正常切换
          }

          // intervalGap
          if (intervalGapRef.current > 0 && lastIntervalCueRef.current !== prevCue.id) {
            lastIntervalCueRef.current = prevCue.id
            const gap = intervalGapRef.current
            v.pause()
            activeIdRef.current = nextId
            setActiveId(nextId)
            intervalTimerRef.current = setTimeout(() => {
              intervalTimerRef.current = null
              const vid = videoRef.current
              if (!vid) return
              const cues2 = subtitlesRef.current
              const idx = cues2.findIndex((c) => c.id === prevCue.id)
              if (idx >= 0 && idx < cues2.length - 1) {
                vid.currentTime = cues2[idx + 1].start
                activeIdRef.current = cues2[idx + 1].id
                setActiveId(cues2[idx + 1].id)
                playMediaSafe(vid)
              }
              // 否则为最后一句：保持暂停
            }, gap * 1000)
            return
          }

          // loopCount
          if (loopCountRef.current !== 0) {
            const remaining = loopsRemainingRef.current
            if (loopCountRef.current === -1 || remaining > 0) {
              if (remaining > 0) {
                loopsRemainingRef.current = remaining - 1
              }
              v.currentTime = prevCue.start
              // 保持 activeId 为 prevCue，不更新
              return
            }
          }
        }

        // 正常切换
        activeIdRef.current = nextId
        setActiveId(nextId)
        // 切到新句时清掉 pauseAfterCue 防抖标记
        lastPausedCueRef.current = null
        // 切到新句时清掉 intervalGap 防抖标记
        lastIntervalCueRef.current = null
        // 切到新句时重置循环计数
        loopsRemainingRef.current = loopCountRef.current > 0 ? loopCountRef.current - 1 : 0
      }

      // ---- 后备逻辑（timeupdate 恰好在句子末尾前触发时） ----
      // 优先级：pauseAfterCue > intervalGap > 单句循环
      if (pauseAfterCueRef.current && activeIdRef.current != null) {
        const cur = cues.find((c) => c.id === activeIdRef.current)
        if (cur && t >= cur.end - 0.05 && lastPausedCueRef.current !== cur.id) {
          lastPausedCueRef.current = cur.id
          v.pause()
          return
        }
      } else if (intervalGapRef.current > 0 && activeIdRef.current != null) {
        const cur = cues.find((c) => c.id === activeIdRef.current)
        if (cur && t >= cur.end - 0.05 && lastIntervalCueRef.current !== cur.id) {
          lastIntervalCueRef.current = cur.id
          const gap = intervalGapRef.current
          v.pause()
          intervalTimerRef.current = setTimeout(() => {
            intervalTimerRef.current = null
            const vid = videoRef.current
            if (!vid) return
            const cues2 = subtitlesRef.current
            const idx = cues2.findIndex((c) => c.id === cur.id)
            if (idx >= 0 && idx < cues2.length - 1) {
              vid.currentTime = cues2[idx + 1].start
              activeIdRef.current = cues2[idx + 1].id
              setActiveId(cues2[idx + 1].id)
              playMediaSafe(vid)
            }
            // 否则为最后一句：保持暂停
          }, gap * 1000)
          return
        }
      } else if (loopCountRef.current !== 0 && activeIdRef.current != null) {
        const cur = cues.find((c) => c.id === activeIdRef.current)
        if (cur && t >= cur.end - 0.02) {
          const remaining = loopsRemainingRef.current
          if (loopCountRef.current === -1 || remaining > 0) {
            if (remaining > 0) {
              loopsRemainingRef.current = remaining - 1
            }
            v.currentTime = cur.start
          }
        }
      }
    }
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onMeta = () => setDuration(v.duration || 0)
    const onRate = () => setRateState(v.playbackRate)

    v.addEventListener('timeupdate', onTime)
    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)
    v.addEventListener('loadedmetadata', onMeta)
    v.addEventListener('ratechange', onRate)

    return () => {
      v.removeEventListener('timeupdate', onTime)
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
      v.removeEventListener('loadedmetadata', onMeta)
      v.removeEventListener('ratechange', onRate)
      if (intervalTimerRef.current) {
        clearTimeout(intervalTimerRef.current)
        intervalTimerRef.current = null
      }
    }
  }, [videoRef, videoEl])

  const play = useCallback(() => {
    playMediaSafe(videoRef.current)
  }, [videoRef])

  const pause = useCallback(() => {
    videoRef.current?.pause()
  }, [videoRef])

  const toggle = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      // 用户主动恢复：取消等待中的间隔
      clearIntervalTimer()
      playMediaSafe(v)
    } else v.pause()
  }, [videoRef, clearIntervalTimer])

  const seek = useCallback(
    (t) => {
      const v = videoRef.current
      if (!v) return
      clearIntervalTimer()
      v.currentTime = Math.max(0, Math.min(t, v.duration || t))
      lastPausedCueRef.current = null
      lastIntervalCueRef.current = null
    },
    [videoRef, clearIntervalTimer]
  )

  const setRate = useCallback(
    (r) => {
      const v = videoRef.current
      if (!v) return
      v.playbackRate = r
      setRateState(r)
    },
    [videoRef]
  )

  // 设置单句循环次数：0=关闭, -1=无限, 正数=总播放次数
  const setLoopCount = useCallback((count) => {
    const next = count === 0 ? 0 : count === -1 ? -1 : Math.max(1, Math.floor(count))
    setLoopCountState(next)
    if (next !== 0) {
      setPauseAfterCue(false)
      loopsRemainingRef.current = next > 0 ? next - 1 : 0
    }
  }, [])

  // 互斥：开启单句循环时关闭 pauseAfterCue
  const toggleLoop = useCallback(() => {
    setLoopCountState((prev) => {
      const next = prev === 0 ? -1 : 0
      if (next !== 0) {
        setPauseAfterCue(false)
        loopsRemainingRef.current = next > 0 ? next - 1 : 0
      }
      return next
    })
  }, [])

  // 互斥：pauseAfterCue 与单句循环
  const togglePauseAfterCue = useCallback(() => {
    setPauseAfterCue((prev) => {
      const next = !prev
      if (next) {
        setLoopCountState(0)
      }
      return next
    })
  }, [])

  const setIntervalGap = useCallback(
    (sec) => {
      const next = Math.max(0, sec)
      // 关闭时如果正处于间隔等待，立即取消并恢复播放
      if (next === 0 && intervalTimerRef.current) {
        clearTimeout(intervalTimerRef.current)
        intervalTimerRef.current = null
        const v = videoRef.current
        if (v?.paused) playMediaSafe(v)
      }
      setIntervalGapState(next)
    },
    [videoRef]
  )

  const toggleHideSubtitleRight = useCallback(() => {
    setHideSubtitleRight((v) => !v)
  }, [])
  const toggleHideSubtitleBottom = useCallback(() => {
    setHideSubtitleBottom((v) => !v)
  }, [])
  // 总开关：任一可见 → 全部隐藏；两个都已隐藏 → 全部显示
  const toggleAllSubtitles = useCallback(() => {
    const allHidden = hideSubtitleRightRef.current && hideSubtitleBottomRef.current
    const next = !allHidden
    setHideSubtitleRight(next)
    setHideSubtitleBottom(next)
  }, [])

  const requestFullscreen = useCallback(async () => {
    const v = videoRef.current
    if (!v) return
    // iOS Safari（含 iPadOS：UA 不带 iPad 但 platform=MacIntel 且可触控）不支持任意元素的
    // Fullscreen API，只支持 <video> 自身的 webkitEnterFullscreen()。
    // 不走这条分支的话，iPhone 上全屏按钮点了完全没反应。
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    if (isIOS && typeof v.webkitEnterFullscreen === 'function') {
      v.webkitEnterFullscreen()
      return
    }
    const target = v.parentElement
    if (!target) return
    if (document.fullscreenElement) {
      await document.exitFullscreen?.()
    } else {
      // requestFullscreen() 的 resolve 值是 undefined，不能用作短路条件，
      // 否则标准浏览器成功进入全屏后仍会再调 webkit 分支；按特性检测二选一
      if (typeof target.requestFullscreen === 'function') {
        await target.requestFullscreen()
      } else if (typeof target.webkitRequestFullscreen === 'function') {
        await target.webkitRequestFullscreen()
      }
      screen.orientation?.lock?.('landscape').catch(() => {})
    }
  }, [videoRef])

  const jumpToCue = useCallback(
    (id) => {
      const cue = subtitlesRef.current.find((c) => c.id === id)
      const v = videoRef.current
      if (!cue || !v) return
      clearIntervalTimer()
      v.currentTime = cue.start
      activeIdRef.current = id
      setActiveId(id)
      lastPausedCueRef.current = null
      lastIntervalCueRef.current = null
      if (v.paused) playMediaSafe(v)
    },
    [videoRef, clearIntervalTimer]
  )

  const prevCue = useCallback(() => {
    const cues = subtitlesRef.current
    const idx = cues.findIndex((c) => c.id === activeIdRef.current)
    if (idx > 0) jumpToCue(cues[idx - 1].id)
    else if (idx === -1 && cues.length) jumpToCue(cues[0].id)
  }, [jumpToCue])

  const nextCue = useCallback(() => {
    const cues = subtitlesRef.current
    const idx = cues.findIndex((c) => c.id === activeIdRef.current)
    if (idx >= 0 && idx < cues.length - 1) jumpToCue(cues[idx + 1].id)
    else if (idx === -1 && cues.length) jumpToCue(cues[0].id)
  }, [jumpToCue])

  // 句子进度：(当前是第几句, 总句数)；activeId 不在字幕里（如切视频后的残留态）时不算第几句
  const activeIdx = activeId == null ? -1 : subtitles.findIndex((c) => c.id === activeId)
  const cueIndex = activeIdx >= 0 ? activeIdx + 1 : 0
  const cueTotal = subtitles?.length ?? 0

  return {
    activeId,
    currentTime,
    duration,
    isPlaying,
    rate,
    loopCount,
    pauseAfterCue,
    intervalGap,
    hideSubtitleRight,
    hideSubtitleBottom,
    cueIndex,
    cueTotal,
    play,
    pause,
    toggle,
    seek,
    setRate,
    setLoopCount,
    toggleLoop,
    togglePauseAfterCue,
    setIntervalGap,
    toggleHideSubtitleRight,
    toggleHideSubtitleBottom,
    toggleAllSubtitles,
    requestFullscreen,
    jumpToCue,
    prevCue,
    nextCue,
  }
}
