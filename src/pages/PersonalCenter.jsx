import { useState, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  BookMarked, BookOpen, Headphones, Target,
  Palette, ChevronRight, Pencil, X, Camera, ChartColumn,
} from 'lucide-react'
import { useReadingStore } from '../modules/reading/hooks/useReadingStore'
import { useUserConfig } from '../hooks/useUserConfig'
import { useProfileStore } from '../hooks/useProfileStore'
import { useAuth } from '../contexts/AuthContext'
import { getErrorBookCount } from '../utils/errorBook'
import { getReadingWordBookCount } from '../utils/readingWordBook'
import { getCorpusWordBookCount } from '../utils/corpusWordBook'
import { copyText } from '../utils/clipboard'

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

export default function PersonalCenter() {
  const navigate = useNavigate()
  const store = useReadingStore()
  const { theme, setTheme } = useUserConfig()
  const profile = useProfileStore()
  const { logout } = useAuth()

  const [editModal, setEditModal] = useState(false)
  const [goalModal, setGoalModal] = useState(false)
  const [themeModal, setThemeModal] = useState(false)
  const [helpModal, setHelpModal] = useState(false)
  const [nicknameInput, setNicknameInput] = useState(profile.nickname)
  const [signatureInput, setSignatureInput] = useState(profile.signature)
  const avatarInputRef = useRef(null)

  const wordCount = useMemo(() => getReadingWordBookCount() + getCorpusWordBookCount() + getErrorBookCount(), [])
  const completedArticles = useMemo(() => store.getCompletedArticleCount(), [])
  const listeningHours = useMemo(() => (store.getTotalListeningSeconds() / 3600).toFixed(1), [])

  function handleSaveProfile() {
    const trimmed = nicknameInput.trim()
    if (!trimmed) return
    profile.setNickname(trimmed)
    profile.setSignature(signatureInput)
    setEditModal(false)
    toast('资料已更新')
  }

  function handleAvatarUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast('请选择图片文件')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast('图片大小不能超过 2MB')
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const size = 200
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        const min = Math.min(img.width, img.height)
        const sx = (img.width - min) / 2
        const sy = (img.height - min) / 2
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size)
        profile.setAvatar(canvas.toDataURL('image/jpeg', 0.8))
        toast('头像已更新')
      }
      img.src = ev.target.result
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const goalPresets = [10, 20, 30, 45, 60, 90, 120]

  const themeOptions = [
    { key: 'light', label: '明亮', desc: '清新简洁' },
    { key: 'gray', label: '暗夜', desc: '沉稳深邃' },
    { key: 'star', label: '星空', desc: '浩瀚星海' },
    { key: 'warm', label: '暖光', desc: '温暖舒适' },
  ]

  const stats = [
    { label: '单词', value: wordCount, unit: '', Icon: BookMarked },
    { label: '阅读', value: completedArticles, unit: '篇', Icon: BookOpen },
    { label: '听力', value: listeningHours, unit: 'h', Icon: Headphones },
  ]

  const settingsItems = [
    { label: '学习方法', emoji: '💡', action: () => navigate('/learning-methods') },
    { label: '模式切换', emoji: '🎨', action: () => setThemeModal(true) },
    { label: '帮助与反馈', emoji: '💬', action: () => setHelpModal(true) },
    { label: '登录设备管理', emoji: '💻', action: () => navigate('/profile/devices') },
  ].filter(Boolean)

  return (
    <div className="min-h-[calc(100vh-3rem-3.5rem)] md:min-h-[calc(100vh-4rem-3.5rem)] max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8 animate-page-fade-in">

      {/* Profile Header */}
      <div className="flex items-center gap-4 mb-6 animate-card-enter">
        <div
          onClick={() => avatarInputRef.current?.click()}
          className="relative w-16 h-16 rounded-full bg-primary/15 text-primary flex items-center justify-center text-2xl font-bold flex-shrink-0 cursor-pointer overflow-hidden group"
        >
          {profile.avatar ? (
            <img src={profile.avatar} alt="头像" className="w-full h-full object-cover" />
          ) : (
            profile.nickname.charAt(0)
          )}
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="w-5 h-5 text-white" />
          </div>
        </div>
        <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-content dark:text-gray-100 truncate">{profile.nickname}</h2>
          <p className="text-sm text-content-tertiary dark:text-gray-500 mt-0.5 truncate">
            {profile.signature || '这个人很懒，什么都没写~'}
          </p>
        </div>
        <button
          onClick={() => { setNicknameInput(profile.nickname); setSignatureInput(profile.signature); setEditModal(true) }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
          编辑
        </button>
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

      {/* Settings Section */}
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

      {/* Edit Profile Modal */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title="编辑资料">
        <div className="flex justify-center mb-5">
          <div
            onClick={() => avatarInputRef.current?.click()}
            className="relative w-20 h-20 rounded-full bg-primary/15 text-primary flex items-center justify-center text-3xl font-bold cursor-pointer overflow-hidden group"
          >
            {profile.avatar ? (
              <img src={profile.avatar} alt="头像" className="w-full h-full object-cover" />
            ) : (
              profile.nickname.charAt(0)
            )}
            <div className="absolute inset-0 bg-black/30 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-5 h-5 text-white" />
              <span className="text-[10px] text-white mt-0.5">更换头像</span>
            </div>
          </div>
        </div>
        <label className="block text-sm text-content-secondary dark:text-gray-400 mb-2">昵称</label>
        <input
          className="input-field w-full mb-4"
          value={nicknameInput}
          onChange={(e) => setNicknameInput(e.target.value)}
          maxLength={20}
          autoFocus
        />
        <label className="block text-sm text-content-secondary dark:text-gray-400 mb-2">个性签名</label>
        <input
          className="input-field w-full mb-4"
          value={signatureInput}
          onChange={(e) => setSignatureInput(e.target.value)}
          maxLength={50}
          placeholder="写点什么吧..."
        />
        <div className="flex gap-3 justify-end">
          <button onClick={() => setEditModal(false)} className="btn-secondary px-4 py-2 rounded-button text-sm">取消</button>
          <button onClick={handleSaveProfile} className="btn-primary px-4 py-2 rounded-button text-sm">保存</button>
        </div>
      </Modal>

      {/* Daily Goal Modal */}
      <Modal open={goalModal} onClose={() => setGoalModal(false)} title="每日目标">
        <p className="text-sm text-content-secondary dark:text-gray-400 mb-4">选择每天的最低学习时长</p>
        <div className="grid grid-cols-4 gap-2">
          {goalPresets.map((mins) => (
            <button
              key={mins}
              onClick={() => { profile.setDailyGoalMinutes(mins); setGoalModal(false); toast(`每日目标已设为 ${mins} 分钟`) }}
              className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${
                profile.dailyGoalMinutes === mins
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-white/[0.06] text-content dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-white/[0.1]'
              }`}
            >
              {mins} 分钟
            </button>
          ))}
        </div>
      </Modal>

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

      {/* Help & Feedback Modal */}
      <Modal open={helpModal} onClose={() => setHelpModal(false)} title="帮助与反馈">
        <div className="space-y-2">
          {/* 微信 */}
          <button
            onClick={async () => {
              const ok = await copyText('WarriorZYC')
              toast(ok ? '微信号已复制' : '复制失败，请手动长按复制', { description: ok ? 'WarriorZYC' : undefined })
            }}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-white/[0.04] hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#07C160' }}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="white">
                  <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.27-.027-.407-.03zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z" />
                </svg>
              </span>
              <div>
                <p className="text-sm font-medium text-content dark:text-gray-100">微信</p>
                <p className="text-xs text-content-tertiary dark:text-gray-500 mt-0.5">WarriorZYC</p>
              </div>
            </div>
            <span className="text-xs text-primary font-medium">复制微信号</span>
          </button>

          {/* 抖音 */}
          <button
            onClick={async () => {
              const ok = await copyText('WarriorZYC')
              toast(ok ? '抖音号已复制' : '复制失败，请手动长按复制', { description: ok ? 'WarriorZYC' : undefined })
            }}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-white/[0.04] hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#000000' }}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="white">
                  <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
                </svg>
              </span>
              <div>
                <p className="text-sm font-medium text-content dark:text-gray-100">抖音</p>
                <p className="text-xs text-content-tertiary dark:text-gray-500 mt-0.5">WarriorZYC</p>
              </div>
            </div>
            <span className="text-xs text-primary font-medium">复制抖音号</span>
          </button>

          {/* 小红书 */}
          <button
            onClick={async () => {
              const ok = await copyText('ambitionC666')
              toast(ok ? '小红书号已复制' : '复制失败，请手动长按复制', { description: ok ? 'ambitionC666' : undefined })
            }}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-white/[0.04] hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FF2442' }}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="white">
                  <path d="M22.405 9.879c.002.016.01.02.07.019h.725a.797.797 0 0 0 .78-.972.794.794 0 0 0-.884-.618.795.795 0 0 0-.692.794c0 .101-.002.666.001.777zm-11.509 4.808c-.203.001-1.353.004-1.685.003a2.528 2.528 0 0 1-.766-.126.025.025 0 0 0-.03.014L7.7 16.127a.025.025 0 0 0 .01.032c.111.06.336.124.495.124.66.01 1.32.002 1.981 0 .01 0 .02-.006.023-.015l.712-1.545a.025.025 0 0 0-.024-.036zM.477 9.91c-.071 0-.076.002-.076.01a.834.834 0 0 0-.01.08c-.027.397-.038.495-.234 3.06-.012.24-.034.389-.135.607-.026.057-.033.042.003.112.046.092.681 1.523.787 1.74.008.015.011.02.017.02.008 0 .033-.026.047-.044.147-.187.268-.391.371-.606.306-.635.44-1.325.486-1.706.014-.11.021-.22.03-.33l.204-2.616.022-.293c.003-.029 0-.033-.03-.034zm7.203 3.757a1.427 1.427 0 0 1-.135-.607c-.004-.084-.031-.39-.235-3.06a.443.443 0 0 0-.01-.082c-.004-.011-.052-.008-.076-.008h-1.48c-.03.001-.034.005-.03.034l.021.293c.076.982.153 1.964.233 2.946.05.4.186 1.085.487 1.706.103.215.223.419.37.606.015.018.037.051.048.049.02-.003.742-1.642.804-1.765.036-.07.03-.055.003-.112zm3.861-.913h-.872a.126.126 0 0 1-.116-.178l1.178-2.625a.025.025 0 0 0-.023-.035l-1.318-.003a.148.148 0 0 1-.135-.21l.876-1.954a.025.025 0 0 0-.023-.035h-1.56c-.01 0-.02.006-.024.015l-.926 2.068c-.085.169-.314.634-.399.938a.534.534 0 0 0-.02.191.46.46 0 0 0 .23.378.981.981 0 0 0 .46.119h.59c.041 0-.688 1.482-.834 1.972a.53.53 0 0 0-.023.172.465.465 0 0 0 .23.398c.15.092.342.12.475.12l1.66-.001c.01 0 .02-.006.023-.015l.575-1.28a.025.025 0 0 0-.024-.035zm-6.93-4.937H3.1a.032.032 0 0 0-.034.033c0 1.048-.01 2.795-.01 6.829 0 .288-.269.262-.28.262h-.74c-.04.001-.044.004-.04.047.001.037.465 1.064.555 1.263.01.02.03.033.051.033.157.003.767.009.938-.014.153-.02.3-.06.438-.132.3-.156.49-.419.595-.765.052-.172.075-.353.075-.533.002-2.33 0-4.66-.007-6.991a.032.032 0 0 0-.032-.032zm11.784 6.896c0-.014-.01-.021-.024-.022h-1.465c-.048-.001-.049-.002-.05-.049v-4.66c0-.072-.005-.07.07-.07h.863c.08 0 .075.004.075-.074V8.393c0-.082.006-.076-.08-.076h-3.5c-.064 0-.075-.006-.075.073v1.445c0 .083-.006.077.08.077h.854c.075 0 .07-.004.07.07v4.624c0 .095.008.084-.085.084-.37 0-1.11-.002-1.304 0-.048.001-.06.03-.06.03l-.697 1.519s-.014.025-.008.036c.006.01.013.008.058.008 1.748.003 3.495.002 5.243.002.03-.001.034-.006.035-.033v-1.539zm4.177-3.43c0 .013-.007.023-.02.024-.346.006-.692.004-1.037.004-.014-.002-.022-.01-.022-.024-.005-.434-.007-.869-.01-1.303 0-.072-.006-.071.07-.07l.733-.003c.041 0 .081.002.12.015.093.025.16.107.165.204.006.431.002 1.153.001 1.153zm2.67.244a1.953 1.953 0 0 0-.883-.222h-.18c-.04-.001-.04-.003-.042-.04V10.21c0-.132-.007-.263-.025-.394a1.823 1.823 0 0 0-.153-.53 1.533 1.533 0 0 0-.677-.71 2.167 2.167 0 0 0-1-.258c-.153-.003-.567 0-.72 0-.07 0-.068.004-.068-.065V7.76c0-.031-.01-.041-.046-.039H17.93s-.016 0-.023.007c-.006.006-.008.012-.008.023v.546c-.008.036-.057.015-.082.022h-.95c-.022.002-.028.008-.03.032v1.481c0 .09-.004.082.082.082h.913c.082 0 .072.128.072.128V11.19s.003.117-.06.117h-1.482c-.068 0-.06.082-.06.082v1.445s-.01.068.064.068h1.457c.082 0 .076-.006.076.079v3.225c0 .088-.007.081.082.081h1.43c.09 0 .082.007.082-.08v-3.27c0-.029.006-.035.033-.035l2.323-.003c.098 0 .191.02.28.061a.46.46 0 0 1 .274.407c.008.395.003.79.003 1.185 0 .259-.107.367-.33.367h-1.218c-.023.002-.029.008-.028.033.184.437.374.871.57 1.303a.045.045 0 0 0 .04.026c.17.005.34.002.51.003.15-.002.517.004.666-.01a2.03 2.03 0 0 0 .408-.075c.59-.18.975-.698.976-1.313v-1.981c0-.128-.01-.254-.034-.38 0 .078-.029-.641-.724-.998z" />
                </svg>
              </span>
              <div>
                <p className="text-sm font-medium text-content dark:text-gray-100">小红书</p>
                <p className="text-xs text-content-tertiary dark:text-gray-500 mt-0.5">ambitionC666</p>
              </div>
            </div>
            <span className="text-xs text-primary font-medium">复制小红书号</span>
          </button>
        </div>
      </Modal>

    </div>
  )
}
