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
