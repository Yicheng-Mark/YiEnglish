import { useEffect, useState } from 'react'

function StarryBackground() {
  const [theme, setTheme] = useState(() => {
    if (typeof document === 'undefined') return 'light'
    return document.documentElement.getAttribute('data-theme') || 'light'
  })

  useEffect(() => {
    const read = () => setTheme(document.documentElement.getAttribute('data-theme') || 'light')
    read()
    const observer = new MutationObserver(read)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [])

  // 暗夜：aurora 氛围光 —— 紫/靛/蓝三个静态柔光斑（CSS 见 index.css 的 .aurora-* 段）。
  // 不加 filter: blur 与动画：大模糊层 + 动态背景会让 backdrop-filter 玻璃逐帧重采样，导致卡顿。
  // 第三光斑用蓝不用青：大面积低透明度的青会被感知为绿光，观感不适
  if (theme === 'gray') {
    return (
      <div
        className="fixed inset-0 w-full h-full pointer-events-none z-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="aurora-glow aurora-violet" />
        <div className="aurora-glow aurora-indigo" />
        <div className="aurora-glow aurora-blue" />
      </div>
    )
  }

  if (theme === 'warm') {
    return (
      <div className="fixed inset-0 w-full h-full pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-[radial-gradient(circle,rgba(217,168,124,0.22)_0%,transparent_70%)]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[radial-gradient(circle,rgba(194,142,92,0.12)_0%,transparent_70%)]" />
        <div className="absolute top-[40%] left-[60%] w-[30%] h-[30%] rounded-full bg-[radial-gradient(circle,rgba(232,185,138,0.16)_0%,transparent_70%)]" />
      </div>
    )
  }
  // 亮色：不渲染装饰背景层，保持纯色背景
  return null
}

export default StarryBackground
