import { useEffect, useRef, useCallback, useLayoutEffect, useState } from 'react'
import { X, Volume2, Check, BookOpen } from 'lucide-react'

function playWordTTS(word) {
  if (!word) return
  const trimmed = String(word).trim()
  if (!trimmed) return

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
      fallbackSpeak(trimmed)
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
      fallbackSpeak(trimmed)
    }, 3000)

    const result = audio.play()
    if (result && typeof result.catch === 'function') {
      result.catch(() => {
        cleanup()
        fallbackSpeak(trimmed)
      })
    }
  } catch {
    fallbackSpeak(trimmed)
  }
}

function fallbackSpeak(text) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return

  const doSpeak = () => {
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
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.onvoiceschanged = null
      doSpeak()
    }
    setTimeout(() => {
      window.speechSynthesis.onvoiceschanged = null
      doSpeak()
    }, 1000)
  }
}

function parseTrans(trans) {
  if (!trans) return []
  // 字符串格式："[n,v] 锻炼" 或 "[n] 锻炼; [v] 练习"
  if (typeof trans === 'string') {
    const items = trans.split(';').map(s => s.trim()).filter(Boolean)
    return items.map((t) => {
      const match = t.match(/^\s*\[([^\]]+)\]\s*(.*)$/)
      if (match) return { pos: match[1].trim(), meaning: match[2].trim() }
      return { pos: '', meaning: t }
    })
  }
  if (!Array.isArray(trans)) return []
  return trans.map((t) => {
    const match = t.match(/^\s*\[([^\]]+)\]\s*(.*)$/)
    if (match) {
      return { pos: match[1].trim(), meaning: match[2].trim() }
    }
    return { pos: '', meaning: t.trim() }
  })
}

export default function WordPopup({
  wordData,
  rect,
  isSaved,
  onSave,
  onRemove,
  onClose,
  wordBookLabel = '阅读词本',
}) {
  const popupRef = useRef(null)
  const [computedTop, setComputedTop] = useState(null)
  // 捕获挂载时的 scrollY，用于把视口坐标转换为文档坐标，使弹窗跟随滚动
  const scrollYAtMount = useRef(window.scrollY).current

  const handleClickOutside = useCallback(
    (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        onClose()
      }
    },
    [onClose]
  )

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [handleClickOutside])

  if (!wordData || !rect) return null

  const usphone = wordData.usphone || wordData.us
  const ukphone = wordData.ukphone || wordData.uk
  const { name, trans } = wordData
  const parsed = parseTrans(trans)

  const popupWidth = Math.min(360, window.innerWidth - 32)
  const gap = 12
  const padding = 16
  const bottomNavHeight = 64 // 底部固定导航栏高度 h-14=56，留一点余量

  let left = rect.left + rect.width / 2 - popupWidth / 2
  left = Math.max(padding, Math.min(left, window.innerWidth - popupWidth - padding))

  // 优先显示在单词下方；下方空间不足时再放到上方
  const estimatedHeight = 170 + Math.max(1, parsed.length) * 28
  const overflowsBelow = rect.bottom + estimatedHeight + gap > window.innerHeight - padding - bottomNavHeight
  let initialTop = overflowsBelow
    ? rect.top - estimatedHeight - gap
    : rect.bottom + gap
  // 转换为文档坐标，让弹窗在滚动时跟随单词
  initialTop += scrollYAtMount

  useLayoutEffect(() => {
    const el = popupRef.current
    if (!el) return
    const h = el.offsetHeight
    const overflows = rect.bottom + h + gap > window.innerHeight - padding - bottomNavHeight
    let t = overflows ? rect.top - h - gap : rect.bottom + gap
    t += scrollYAtMount
    setComputedTop(t)
  }, [rect, scrollYAtMount])

  return (
    <div
      ref={popupRef}
      className="absolute z-[100] reading-word-popup bg-white dark:bg-[#1a1a24] rounded-2xl shadow-xl border border-gray-100 dark:border-white/[0.06] overflow-hidden"
      style={{ left, top: computedTop ?? initialTop, width: popupWidth }}
    >
      {/* Header */}
      <div className="flex items-start justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <h3 className="text-xl font-bold text-content dark:text-gray-100">{name}</h3>
          <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-white/[0.06] text-xs text-content-tertiary dark:text-gray-500 font-medium">
            单词
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-white/[0.06] text-content-tertiary dark:text-gray-500 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Dictionary info */}
      <div className="px-5 pb-4">
        <p className="text-xs font-medium text-content-tertiary dark:text-gray-500 mb-2.5">词典信息</p>

        {/* Phonetic */}
        <div className="flex items-center gap-4 mb-3">
          {usphone && (
            <button
              onClick={() => playWordTTS(name)}
              className="flex items-center gap-1.5 text-sm text-content-secondary dark:text-gray-300 hover:text-primary dark:hover:text-primary transition-colors"
            >
              <span className="text-xs text-content-tertiary dark:text-gray-500">美</span>
              <span className="font-mono">/{usphone}/</span>
              <Volume2 className="w-3.5 h-3.5" />
            </button>
          )}
          {ukphone && (
            <button
              onClick={() => playWordTTS(name)}
              className="flex items-center gap-1.5 text-sm text-content-secondary dark:text-gray-300 hover:text-primary dark:hover:text-primary transition-colors"
            >
              <span className="text-xs text-content-tertiary dark:text-gray-500">英</span>
              <span className="font-mono">/{ukphone}/</span>
            </button>
          )}
        </div>

        {/* Definitions */}
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {parsed.map((item, idx) => (
            <div key={idx} className="flex gap-2 text-sm">
              {item.pos && (
                <span className="shrink-0 px-1.5 py-0.5 rounded bg-gray-50 dark:bg-white/[0.04] text-content-tertiary dark:text-gray-500 text-xs font-medium mt-0.5">
                  {item.pos}
                </span>
              )}
              <span className="text-content-secondary dark:text-gray-300 leading-relaxed">
                {item.meaning}
              </span>
            </div>
          ))}
          {parsed.length === 0 && (
            <p className="text-sm text-content-tertiary dark:text-gray-500">暂无释义</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 py-4 border-t border-gray-100 dark:border-white/[0.06] flex items-center gap-3">
        <button
          onClick={isSaved ? onRemove : onSave}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 active:scale-[0.97] ${
            isSaved
              ? 'bg-gray-100 dark:bg-white/[0.06] text-content-secondary dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/[0.1]'
              : 'bg-content dark:bg-white text-white dark:text-gray-900 hover:opacity-90'
          }`}
        >
          {isSaved ? (
            <>
              <Check className="w-4 h-4" />
              <span>已加入{wordBookLabel}</span>
            </>
          ) : (
            <>
              <BookOpen className="w-4 h-4" />
              <span>加入{wordBookLabel}</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
