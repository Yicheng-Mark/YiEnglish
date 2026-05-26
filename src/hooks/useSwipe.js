import { useEffect, useRef } from 'react'

/**
 * @param {Object} opts
 * @param {import('react').RefObject<HTMLElement>} opts.ref
 * @param {() => void} [opts.onSwipeLeft]
 * @param {() => void} [opts.onSwipeRight]
 * @param {number} [opts.threshold=50]
 */
export function useSwipe({ ref, onSwipeLeft, onSwipeRight, threshold = 50 }) {
  const touch = useRef({ startX: 0, startY: 0 })
  const leftRef = useRef(onSwipeLeft)
  const rightRef = useRef(onSwipeRight)
  leftRef.current = onSwipeLeft
  rightRef.current = onSwipeRight

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const onStart = (e) => {
      const t = e.touches[0]
      touch.current = { startX: t.clientX, startY: t.clientY }
    }

    const onEnd = (e) => {
      const t = e.changedTouches[0]
      const dx = t.clientX - touch.current.startX
      const dy = t.clientY - touch.current.startY
      if (Math.abs(dx) > threshold && Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) rightRef.current?.()
        else leftRef.current?.()
      }
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchend', onEnd)
    }
  }, [ref, threshold])
}
