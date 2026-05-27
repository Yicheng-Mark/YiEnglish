import { useState, useEffect } from 'react'

function detectCorpusLayout() {
  const ua = navigator.userAgent.toLowerCase()
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)
  const isIPadOS = ua.includes('mac') && navigator.maxTouchPoints >= 1
  const shortSide = Math.min(window.innerWidth, window.innerHeight)
  const isSmallShortSide = shortSide < 1024
  const isCoarsePointer = typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: coarse)').matches
    : false
  const isMobileDevice = isMobileUA || isIPadOS || (isTouchDevice && (isSmallShortSide || isCoarsePointer))

  if (!isMobileDevice) return 'desktop'

  // screen.width/height 不随旋转变化，用于区分手机/平板
  const screenShortSide = Math.min(screen.width, screen.height)
  if (screenShortSide < 768) return 'mobile'

  // 平板：横屏→桌面端布局，竖屏→移动端布局
  return window.innerWidth > window.innerHeight ? 'desktop' : 'mobile'
}

export default function useCorpusLayout() {
  const [layout, setLayout] = useState(() => detectCorpusLayout())

  useEffect(() => {
    const check = () => setLayout(detectCorpusLayout())
    window.addEventListener('resize', check)
    // iOS Safari 的 orientationchange 在 viewport 更新前触发，需延迟
    const onOrientationChange = () => setTimeout(check, 150)
    window.addEventListener('orientationchange', onOrientationChange)
    return () => {
      window.removeEventListener('resize', check)
      window.removeEventListener('orientationchange', onOrientationChange)
    }
  }, [])

  return layout === 'mobile'
}
