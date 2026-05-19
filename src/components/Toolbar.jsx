import { Link, useLocation } from 'react-router-dom'
import { ChartColumn, Lightbulb } from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import { useUserConfig } from '../hooks/useUserConfig'

export default function Toolbar() {
  const { theme, setTheme } = useUserConfig()
  const location = useLocation()
  const isStats = location.pathname === '/stats'
  const isLearningMethods = location.pathname.startsWith('/learning-methods')

  return (
    <div className="flex items-center gap-1 md:gap-2">
      <Link
        to="/learning-methods"
        aria-label="学习方法"
        title="学习方法"
        className={`p-1 md:p-2 rounded-button transition-colors flex flex-col items-center gap-1 ${
          isLearningMethods
            ? 'text-primary dark:text-primary-dark bg-primary/5 dark:bg-white/[0.05]'
            : 'text-content-secondary dark:text-gray-400 hover:bg-primary/5 dark:hover:bg-white/[0.05]'
        }`}
      >
        <Lightbulb className="w-5 h-5 md:w-[18px] md:h-[18px]" />
        <span className="text-[11px] hidden sm:inline leading-none">学习方法</span>
      </Link>
      <Link
        to="/stats"
        aria-label="学习数据"
        title="学习数据"
        className={`p-1 md:p-2 rounded-button transition-colors flex flex-col items-center gap-1 ${
          isStats
            ? 'text-primary dark:text-primary-dark bg-primary/5 dark:bg-white/[0.05]'
            : 'text-content-secondary dark:text-gray-400 hover:bg-primary/5 dark:hover:bg-white/[0.05]'
        }`}
      >
        <ChartColumn className="w-5 h-5 md:w-[18px] md:h-[18px]" />
        <span className="text-[11px] hidden sm:inline leading-none">学习数据</span>
      </Link>
      <ThemeToggle theme={theme} setTheme={setTheme} />
    </div>
  )
}
