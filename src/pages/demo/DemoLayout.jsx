import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { BookOpen, Keyboard } from 'lucide-react'
import StarryBackground from '../../components/StarryBackground'
import TrialBanner from '../../components/TrialBanner'
import PageLoading from '../../components/PageLoading'
import { useAuth } from '../../contexts/AuthContext'

const demoNavItems = [
  { to: '/demo/home', label: '单词', icon: <Keyboard className="w-5 h-5" /> },
  { to: '/demo/reading', label: '阅读', icon: <BookOpen className="w-5 h-5" /> },
  {
    to: '/demo/corpus',
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
    to: '/demo/profile',
    label: '我的',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
    ),
  },
]

export default function DemoLayout() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  // 未登录用户重定向到体验码输入页
  useEffect(() => {
    if (!loading && !user) {
      navigate('/demo', { replace: true })
    }
  }, [user, loading, navigate])

  const isActive = (path) => {
    if (location.pathname === path) return true
    if (path !== '/' && location.pathname.startsWith(path + '/')) return true
    return false
  }

  if (loading) return <PageLoading />
  if (!user) return null

  return (
    <div className="min-h-screen bg-background dark:bg-background-dark transition-colors duration-500 relative">
      <StarryBackground />
      {user?.isTrial && <TrialBanner />}

      {/* 顶部导航 */}
      <nav className="h-12 md:h-16 shrink-0 glass-card border-b border-gray-200/80 dark:border-white/[0.06] flex items-center justify-between px-4 md:px-6 sticky top-0 z-50 nav-glow transition-shadow duration-500">
        <Link
          to="/demo/home"
          className="text-xl font-bold italic text-primary dark:text-primary-dark flex items-center gap-2 transition-all duration-300 hover:opacity-90 dark:hover:drop-shadow-[0_0_8px_rgba(129,140,248,0.4)]"
        >
          Yi English
        </Link>
        <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded-full font-medium">
          体验版
        </span>
      </nav>

      {/* 内容区 */}
      <div className="relative pb-24">
        <Outlet />
      </div>

      {/* 底部导航 */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 glass-card border-t border-gray-200/80 dark:border-white/[0.06] backdrop-blur-md">
        <div className="max-w-4xl mx-auto flex justify-around items-center h-14">
          {demoNavItems.map((item) => (
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
    </div>
  )
}
