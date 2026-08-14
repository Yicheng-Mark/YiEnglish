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

  if (theme === 'gray') return null

  if (theme === 'warm') {
    return (
      <div className="fixed inset-0 w-full h-full pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[#D9A87C]/20 rounded-full blur-[80px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#C28E5C]/8 rounded-full blur-[60px]" />
        <div className="absolute top-[40%] left-[60%] w-[30%] h-[30%] bg-[#E8B98A]/15 rounded-full blur-[40px]" />
      </div>
    )
  }
  return (
    <div className="fixed inset-0 w-full h-full pointer-events-none z-0 overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/5 rounded-full blur-[80px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-accent/5 rounded-full blur-[60px]" />
      <div className="absolute top-[40%] left-[60%] w-[30%] h-[30%] bg-accent/5 rounded-full blur-[40px]" />
    </div>
  )
}

export default StarryBackground
