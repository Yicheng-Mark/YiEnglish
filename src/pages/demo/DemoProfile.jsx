import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { BookMarked, BookOpen, Headphones, ChevronRight, X } from 'lucide-react'
import { useReadingStore } from '../../modules/reading/hooks/useReadingStore'
import { useUserConfig } from '../../hooks/useUserConfig'
import { useProfileStore } from '../../hooks/useProfileStore'
import { useAuth } from '../../contexts/AuthContext'
import { getErrorBookCount } from '../../utils/errorBook'
import { getReadingWordBookCount } from '../../utils/readingWordBook'
import { getCorpusWordBookCount } from '../../utils/corpusWordBook'

function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-content dark:text-gray-100">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors">
            <X className="w-5 h-5 text-content-tertiary" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

const themeOptions = [
  { key: 'light', label: '明亮', desc: '清新简洁' },
  { key: 'gray', label: '暗夜', desc: '沉稳深邃' },
  { key: 'star', label: '星空', desc: '浩瀚星海' },
  { key: 'warm', label: '暖光', desc: '温暖舒适' },
]

export default function DemoProfile() {
  const navigate = useNavigate()
  const store = useReadingStore()
  const { theme, setTheme } = useUserConfig()
  const profile = useProfileStore()
  const { logout } = useAuth()

  const [themeModal, setThemeModal] = useState(false)
  const [helpModal, setHelpModal] = useState(false)

  const wordCount = useMemo(() => getReadingWordBookCount() + getCorpusWordBookCount() + getErrorBookCount(), [])
  const completedArticles = useMemo(() => store.getCompletedArticleCount(), [])
  const listeningHours = useMemo(() => (store.getTotalListeningSeconds() / 3600).toFixed(1), [])

  const stats = [
    { label: '单词', value: wordCount, unit: '', Icon: BookMarked },
    { label: '阅读', value: completedArticles, unit: '篇', Icon: BookOpen },
    { label: '听力', value: listeningHours, unit: 'h', Icon: Headphones },
  ]

  const settingsItems = [
    { label: '模式切换', emoji: '🎨', action: () => setThemeModal(true) },
    { label: '帮助与反馈', emoji: '💬', action: () => setHelpModal(true) },
  ]

  return (
    <div className="min-h-[calc(100vh-3rem-3.5rem)] md:min-h-[calc(100vh-4rem-3.5rem)] max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8 animate-page-fade-in">

      {/* Profile Header - 只读 */}
      <div className="flex items-center gap-4 mb-6 animate-card-enter">
        <div className="relative w-16 h-16 rounded-full bg-primary/15 text-primary flex items-center justify-center text-2xl font-bold flex-shrink-0 overflow-hidden">
          {profile.avatar ? (
            <img src={profile.avatar} alt="头像" className="w-full h-full object-cover" />
          ) : (
            profile.nickname.charAt(0)
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-content dark:text-gray-100 truncate">{profile.nickname}</h2>
          <p className="text-sm text-content-tertiary dark:text-gray-500 mt-0.5 truncate">
            {profile.signature || '这个人很懒，什么都没写~'}
          </p>
        </div>
      </div>

      {/* Learning Data Card */}
      <div
        className="w-full card mb-4 animate-card-enter"
        style={{ animationDelay: '0.05s' }}
      >
        <button
          onClick={() => navigate('/stats')}
          className="w-full py-6 flex items-center justify-center card-hover"
        >
          <span className="text-lg font-semibold text-content dark:text-gray-100">学习数据</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4 animate-card-enter" style={{ animationDelay: '0.1s' }}>
        {stats.map(({ label, value, unit, Icon }) => (
          <div key={label} className="card p-3 text-center">
            <Icon className="w-4 h-4 text-primary mx-auto mb-1" />
            <div className="text-lg font-bold text-content dark:text-gray-100">{value}{unit}</div>
            <div className="text-xs text-content-tertiary dark:text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      {/* Settings */}
      <div className="animate-card-enter" style={{ animationDelay: '0.25s' }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-semibold text-content dark:text-gray-100">设置</span>
        </div>
        <div className="bg-surface dark:bg-surface-dark rounded-2xl overflow-hidden border border-gray-100/80 dark:border-white/[0.06]">
          {settingsItems.map((item, i, arr) => (
            <button
              key={item.label}
              onClick={item.action}
              className={`w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors text-left ${i < arr.length - 1 ? 'border-b border-gray-100/60 dark:border-white/[0.04]' : ''}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg w-6 text-center flex-shrink-0">{item.emoji}</span>
                <span className="text-content dark:text-gray-100 text-[15px]">{item.label}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-content-tertiary flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Logout */}
      <div className="mt-4 animate-card-enter" style={{ animationDelay: '0.3s' }}>
        <button
          onClick={logout}
          className="w-full py-3.5 rounded-2xl text-red-500 font-medium text-[15px] bg-surface dark:bg-surface-dark border border-gray-100/80 dark:border-white/[0.06] hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
        >
          退出登录
        </button>
      </div>

      {/* Theme Modal */}
      <Modal open={themeModal} onClose={() => setThemeModal(false)} title="模式切换">
        <div className="grid grid-cols-2 gap-3">
          {themeOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => { setTheme(opt.key); setThemeModal(false) }}
              className={`p-4 rounded-xl text-left transition-all ${
                theme === opt.key
                  ? 'bg-primary/10 border-2 border-primary ring-1 ring-primary/20'
                  : 'bg-gray-50 dark:bg-white/[0.04] border-2 border-transparent hover:bg-gray-100 dark:hover:bg-white/[0.08]'
              }`}
            >
              <p className="text-sm font-semibold text-content dark:text-gray-100">{opt.label}</p>
              <p className="text-xs text-content-tertiary dark:text-gray-500 mt-0.5">{opt.desc}</p>
            </button>
          ))}
        </div>
      </Modal>

      {/* Help Modal */}
      <Modal open={helpModal} onClose={() => setHelpModal(false)} title="帮助与反馈">
        <div className="space-y-2">
          <a
            href="#"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-white/[0.04] hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">📖</span>
              <span className="text-sm font-medium text-content dark:text-gray-100">使用方法</span>
            </div>
            <ChevronRight className="w-4 h-4 text-content-tertiary" />
          </a>
          <button
            onClick={() => {
              navigator.clipboard.writeText('warriorzyc172@qq.com')
              toast('邮箱已复制', { description: 'warriorzyc172@qq.com' })
            }}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-white/[0.04] hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">📧</span>
              <div>
                <p className="text-sm font-medium text-content dark:text-gray-100">反馈问题</p>
                <p className="text-xs text-content-tertiary dark:text-gray-500 mt-0.5">warriorzyc172@qq.com</p>
              </div>
            </div>
            <span className="text-xs text-primary font-medium">复制邮箱</span>
          </button>
        </div>
      </Modal>
    </div>
  )
}
