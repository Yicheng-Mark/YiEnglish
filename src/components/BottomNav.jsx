import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BookOpen, Keyboard, Target } from 'lucide-react'
import { getReadingStoreActions } from '../modules/reading/hooks/useReadingStore'

const items = [
  {
    to: '/word',
    label: '单词',
    icon: <Keyboard className="w-5 h-5" />,
  },
  {
    to: '/reading',
    label: '阅读',
    icon: <BookOpen className="w-5 h-5" />,
  },
  {
    to: '/listening',
    label: '语料',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" strokeWidth={2} />
        <line x1="8" y1="21" x2="16" y2="21" strokeWidth={2} />
        <line x1="12" y1="17" x2="12" y2="21" strokeWidth={2} />
      </svg>
    ),
  },
  {
    to: '/training',
    label: '训练',
    icon: <Target className="w-5 h-5" />,
  },
  {
    to: '/profile',
    label: '我的',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
]

function getModuleFromPath(pathname) {
  if (pathname === '/word' || pathname.startsWith('/word/') || pathname.startsWith('/dict/') || pathname.startsWith('/typing/')) {
    return 'typing'
  }
  if (pathname === '/reading' || pathname.startsWith('/reading/') || pathname === '/read' || pathname.startsWith('/read/')) {
    return 'reading'
  }
  if (pathname === '/listening' || pathname.startsWith('/listening/')) {
    return 'listening'
  }
  if (pathname === '/training' || pathname.startsWith('/training/')) {
    return 'training'
  }
  if (pathname.startsWith('/reading/grammar')) {
    return 'reading'
  }
  return null
}

export default function BottomNav() {
  const location = useLocation()
  const storeActions = getReadingStoreActions()

  useEffect(() => {
    const module = getModuleFromPath(location.pathname)
    if (!module) return

    const tick = () => {
      if (document.visibilityState === 'hidden') return
      if (module === 'typing') storeActions.addTypingSeconds(1)
      else if (module === 'reading') storeActions.addReadingSeconds(1)
      else if (module === 'listening') storeActions.addListeningSeconds(1)
    }

    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  const isActive = (path) => {
    if (location.pathname === path) return true
    if (path !== '/' && location.pathname.startsWith(path + '/')) return true
    return false
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-card border-t border-gray-200/80 dark:border-white/[0.06] backdrop-blur-md">
      <div className="max-w-4xl mx-auto flex justify-around items-center h-14">
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => window.scrollTo({ top: 0, behavior: 'instant' })}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
              isActive(item.to)
                ? 'text-primary dark:text-primary-dark'
                : 'text-content-tertiary dark:text-gray-400 hover:text-content-secondary dark:hover:text-gray-300'
            }`}
          >
            {item.icon}
            <span className="text-xs font-medium">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  )
}
