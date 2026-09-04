import { Link, Outlet, useLocation } from 'react-router-dom'
import StarryBackground from './StarryBackground'
import BottomNav from './BottomNav'
import TrialBanner from './TrialBanner'
import { useAuth } from '../contexts/AuthContext'

function Layout() {
  const { user } = useAuth()
  const location = useLocation()
  const isTyping = location.pathname.startsWith('/typing/')
  const isListeningPlayer = /^\/listening\/.+/.test(location.pathname)
  const isProfile = location.pathname === '/profile'
  // AI 助手下线（DeepSeek key 无额度）：/ai-assistant 路由已注释，全屏沉浸特判一并停用，
  // 避免手动访问该路径时双导航被藏导致整页空白；恢复时连同 App.jsx 各标记处一起还原
  // const isAIChat = location.pathname === '/ai-assistant'
  const showBottomNav =
    !isTyping && !isListeningPlayer && !location.pathname.startsWith('/review/quiz/')
  const showTopNav = !isListeningPlayer && !isProfile

  return (
    <div
      className={`${isListeningPlayer ? 'h-dvh overflow-hidden' : 'min-h-screen'} bg-background dark:bg-background-dark transition-colors duration-500 relative`}
    >
      <StarryBackground />
      {user?.isTrial && <TrialBanner />}
      {showTopNav && (
        <nav className="h-12 md:h-16 shrink-0 glass-card border-b border-gray-200/80 dark:border-white/[0.06] flex items-center justify-between px-4 md:px-6 sticky top-0 z-50 nav-glow transition-shadow duration-500">
          <Link
            to="/word"
            className="text-xl font-bold italic gradient-text flex items-center gap-2 transition-all duration-300 hover:opacity-90 dark:hover:drop-shadow-[0_0_8px_rgba(129,140,248,0.4)]"
          >
            Yi English
          </Link>
        </nav>
      )}
      <div
        className={`relative ${showBottomNav ? 'pb-24' : ''} ${isListeningPlayer ? 'h-full' : ''}`}
      >
        <Outlet />
      </div>
      {showBottomNav && <BottomNav />}
    </div>
  )
}

export default Layout
