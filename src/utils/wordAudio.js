// 单词发音：有道音频优先，失败（被墙/离线/超时 3s）降级浏览器 speechSynthesis。
// 从 WordPopup 抽出共享：QuizCard 听力题同样需要该降级链。
// 返回 stop() 供调用方在切题/卸载时停止播放；不关心时可忽略返回值。

function fallbackSpeak(text, isStopped) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return

  const doSpeak = () => {
    if (isStopped()) return
    try {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'en-US'
      utterance.rate = 0.9

      const voices = window.speechSynthesis.getVoices()
      const enVoice = voices.find((v) => v.lang.startsWith('en'))
      if (enVoice) utterance.voice = enVoice

      utterance.onerror = () => {}
      window.speechSynthesis.speak(utterance)
    } catch {
      // 静默失败
    }
  }

  const voices = window.speechSynthesis.getVoices()
  if (voices.length > 0) {
    doSpeak()
  } else {
    // voiceschanged 与 1s 兜底只能触发一次 doSpeak，否则语音会被重启两遍
    let settled = false
    const settle = () => {
      if (settled) return
      settled = true
      clearTimeout(fallbackTimer)
      window.speechSynthesis.onvoiceschanged = null
      doSpeak()
    }
    window.speechSynthesis.onvoiceschanged = settle
    const fallbackTimer = setTimeout(settle, 1000)
  }
}

export function playWordTTS(word) {
  if (!word) return () => {}
  const trimmed = String(word).trim()
  if (!trimmed) return () => {}

  let stopped = false
  const isStopped = () => stopped

  try {
    const audio = new Audio(
      `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(trimmed)}&type=2`
    )

    let timeoutId = null
    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      audio.onplay = null
      audio.onerror = null
      audio.onstalled = null
      audio.onabort = null
      audio.oncanplaythrough = null
    }

    const onFail = () => {
      cleanup()
      if (!isStopped()) fallbackSpeak(trimmed, isStopped)
    }

    audio.onerror = onFail
    audio.onstalled = onFail
    audio.onabort = onFail

    audio.onplay = cleanup
    audio.oncanplaythrough = cleanup

    timeoutId = setTimeout(() => {
      cleanup()
      audio.pause()
      audio.src = ''
      if (!isStopped()) fallbackSpeak(trimmed, isStopped)
    }, 3000)

    const result = audio.play()
    if (result && typeof result.catch === 'function') {
      result.catch(() => {
        cleanup()
        if (!isStopped()) fallbackSpeak(trimmed, isStopped)
      })
    }

    return () => {
      stopped = true
      cleanup()
      audio.pause()
      audio.src = ''
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  } catch {
    fallbackSpeak(trimmed, isStopped)
    return () => {
      stopped = true
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }
}
