import { Link, Outlet, useLocation } from 'react-router-dom'
import StarryBackground from './StarryBackground'
import BottomNav from './BottomNav'
import Toolbar from './Toolbar'

function Layout() {
  const location = useLocation()
  const isHome = location.pathname === '/' || location.pathname === '/word'
  const isTyping = location.pathname.startsWith('/typing/')
  const isListeningPlayer = /^\/listening\/.+/.test(location.pathname)
  const isProfile = location.pathname === '/profile'
  const isAIChat = location.pathname === '/ai-assistant'
  const showBottomNav = !isTyping && !isListeningPlayer && !isAIChat
  const showTopNav = !isListeningPlayer && !isProfile && !isAIChat

  return (
    <div className="min-h-screen bg-background dark:bg-background-dark transition-colors duration-500 relative">
      <StarryBackground />
      {showTopNav && (
        <nav className="h-12 md:h-16 shrink-0 glass-card border-b border-gray-200/80 dark:border-white/[0.06] flex items-center justify-between px-4 md:px-6 sticky top-0 z-50 nav-glow transition-shadow duration-500">
          <Link to="/word" className="text-xl font-bold text-primary dark:text-primary-dark flex items-center gap-2 transition-all duration-300 hover:opacity-90 dark:hover:drop-shadow-[0_0_8px_rgba(129,140,248,0.4)]">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
            LingoForge
          </Link>
          <div className="flex items-center gap-2 md:gap-3">
            {!isHome && (
              <Link
                to="/word"
                className="text-sm text-content-tertiary dark:text-gray-400 hover:text-primary dark:hover:text-primary-dark transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.05]"
              >
                返回首页
              </Link>
            )}
            <Toolbar />
          </div>
        </nav>
      )}
      <div className={`relative ${showBottomNav ? 'pb-24' : ''}`}>
        <Outlet />
      </div>
      {showBottomNav && <BottomNav />}
    </div>
  )
}

export default Layout
