import { useState, useRef, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  BookMarked, BookOpen, Headphones, Target,
  Palette, ChevronRight, Pencil, Bot, X, Camera, ChartColumn, LogOut,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useReadingStore } from '../modules/reading/hooks/useReadingStore'
import { useUserConfig } from '../hooks/useUserConfig'
import { useProfileStore } from '../hooks/useProfileStore'
import { getErrorBookCount } from '../utils/errorBook'
import { getReadingWordBookCount } from '../utils/readingWordBook'
import { getCorpusWordBookCount } from '../utils/corpusWordBook'
import { fetchStyles, switchStyle, updateCustomName, updateGender, updateCustomPrompt, resetStyleSettings, resetPersonality, clearMemory } from '../lib/ai-settings'

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
  const { logout } = useAuth()
  const store = useReadingStore()
  const { theme, setTheme } = useUserConfig()
  const profile = useProfileStore()

  const [editModal, setEditModal] = useState(false)
  const [goalModal, setGoalModal] = useState(false)
  const [themeModal, setThemeModal] = useState(false)
  const [companionModal, setCompanionModal] = useState(false)
  const [nicknameInput, setNicknameInput] = useState(profile.nickname)
  const [signatureInput, setSignatureInput] = useState(profile.signature)
  const [aiStyles, setAiStyles] = useState({ current: null, all: [] })
  const [customNameInput, setCustomNameInput] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [customPromptInput, setCustomPromptInput] = useState('')
  const [editingPrompt, setEditingPrompt] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showResetPersonalityConfirm, setShowResetPersonalityConfirm] = useState(false)
  const [showClearMemoryConfirm, setShowClearMemoryConfirm] = useState(false)
  const avatarInputRef = useRef(null)

  // Load AI styles
  useEffect(() => {
    fetchStyles().then(data => {
      setAiStyles({ current: data.current, all: data.all })
      setCustomPromptInput(data.current?.custom_prompt || '')
    })
  }, [])

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
    { label: 'AI 伙伴设置', emoji: '🤖', action: () => setCompanionModal(true) },
    { label: '每日目标', emoji: '🎯', action: () => setGoalModal(true) },
    { label: '模式切换', emoji: '🎨', action: () => setThemeModal(true) },
    { label: '帮助与反馈', emoji: '💬', action: () => toast('即将上线', { description: '帮助与反馈功能正在开发中' }) },
  ]

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
      <div className="mt-4 animate-card-enter" style={{ animationDelay: '0.35s' }}>
        <button
          onClick={async () => { await logout(); navigate('/login') }}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-surface dark:bg-surface-dark border border-gray-100/80 dark:border-white/[0.06] hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors text-red-500 font-medium"
        >
          <LogOut className="w-4 h-4" />
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

      {/* AI Companion Modal */}
      <Modal open={companionModal} onClose={() => { setCompanionModal(false); setEditingName(false); setEditingPrompt(false); setShowResetConfirm(false); setShowResetPersonalityConfirm(false); setShowClearMemoryConfirm(false) }} title="AI 伙伴设置">
        {/* Custom name section */}
        {aiStyles.current && (
          <div className="mb-4 p-3 rounded-xl bg-gray-50 dark:bg-white/[0.04]">
            <p className="text-xs text-content-tertiary dark:text-gray-500 mb-2">自定义名称</p>
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  className="input-field flex-1 text-sm"
                  value={customNameInput}
                  onChange={(e) => setCustomNameInput(e.target.value)}
                  maxLength={12}
                  autoFocus
                  placeholder="给 TA 起个名字吧..."
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      const trimmed = customNameInput.trim()
                      if (!trimmed) return
                      try {
                        await updateCustomName(trimmed)
                        setAiStyles(prev => ({ ...prev, current: { ...prev.current, custom_name: trimmed } }))
                        toast('名称已更新')
                        setEditingName(false)
                      } catch (err) {
                        toast('更新失败', { description: err.message })
                      }
                    }
                    if (e.key === 'Escape') setEditingName(false)
                  }}
                />
                <span className="text-xs text-content-tertiary flex-shrink-0">{customNameInput.length}/12</span>
                <button
                  onClick={async () => {
                    const trimmed = customNameInput.trim()
                    if (!trimmed) return
                    try {
                      await updateCustomName(trimmed)
                      setAiStyles(prev => ({ ...prev, current: { ...prev.current, custom_name: trimmed } }))
                      toast('名称已更新')
                      setEditingName(false)
                    } catch (err) {
                      toast('更新失败', { description: err.message })
                    }
                  }}
                  className="btn-primary px-3 py-1.5 rounded-button text-xs"
                >确定</button>
                <button
                  onClick={() => setEditingName(false)}
                  className="btn-secondary px-3 py-1.5 rounded-button text-xs"
                >取消</button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-content dark:text-gray-100">
                  {aiStyles.current.custom_name || '未命名'}
                </span>
                <button
                  onClick={() => { setCustomNameInput(aiStyles.current.custom_name || ''); setEditingName(true) }}
                  className="text-xs text-primary hover:underline"
                >编辑</button>
              </div>
            )}
          </div>
        )}
        {/* Gender section */}
        {aiStyles.current && (
          <div className="mb-4 p-3 rounded-xl bg-gray-50 dark:bg-white/[0.04]">
            <p className="text-xs text-content-tertiary dark:text-gray-500 mb-2">性别</p>
            <div className="flex gap-2">
              {[
                { key: 'male', label: '男' },
                { key: 'female', label: '女' },
              ].map(g => (
                <button
                  key={g.key}
                  onClick={async () => {
                    try {
                      await updateGender(g.key)
                      setAiStyles(prev => ({ ...prev, current: { ...prev.current, gender: g.key } }))
                      toast('性别已更新')
                    } catch (err) {
                      toast('更新失败', { description: err.message })
                    }
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    aiStyles.current.gender === g.key
                      ? 'bg-primary text-white'
                      : 'bg-white dark:bg-white/[0.06] text-content-secondary dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.1]'
                  }`}
                >{g.label}</button>
              ))}
            </div>
          </div>
        )}
        <p className="text-sm text-content-secondary dark:text-gray-400 mb-2">选择你的 AI 学习伙伴风格</p>
        <div className="grid grid-cols-1 gap-2">
          {(aiStyles.all || []).map((s) => (
            <button
              key={s.style_key}
              onClick={async () => {
                if (aiStyles.current?.style_key === s.style_key) return
                try {
                  await switchStyle(s.style_key)
                  setAiStyles(prev => ({ ...prev, current: { ...s, custom_name: prev.current?.custom_name, custom_prompt: prev.current?.custom_prompt } }))
                  toast(`已切换为 ${s.name}`)
                  // Auto-open custom prompt editor when switching to custom without one
                  if (s.style_key === 'custom' && !aiStyles.current?.custom_prompt) setEditingPrompt(true)
                } catch (err) {
                  toast('切换失败，请重试', { description: err.message })
                }
              }}
              className={`flex items-center gap-2 p-2.5 rounded-lg text-left transition-all ${
                aiStyles.current?.style_key === s.style_key
                  ? 'bg-primary/10 border border-primary ring-1 ring-primary/20'
                  : 'bg-gray-50 dark:bg-white/[0.04] border border-transparent hover:bg-gray-100 dark:hover:bg-white/[0.08]'
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-content dark:text-gray-100">{s.name}</p>
                <p className="text-[11px] text-content-tertiary dark:text-gray-500 mt-0.5 leading-tight">{s.description}</p>
              </div>
              {aiStyles.current?.style_key === s.style_key && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-medium flex-shrink-0">当前</span>
              )}
            </button>
          ))}
        </div>

        {/* Custom Prompt Section — only visible when custom style is selected */}
        {aiStyles.current?.style_key === 'custom' && (
        <div className="mt-4 p-3 rounded-xl bg-gray-50 dark:bg-white/[0.04]">
          <p className="text-xs text-content-tertiary dark:text-gray-500 mb-2">自定义性格描述</p>
          {editingPrompt ? (
            <div>
              <textarea
                className="w-full px-3 py-2 bg-white dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.06] rounded-xl text-sm text-content dark:text-gray-100 resize-none focus:outline-none focus:border-primary/50 transition-all"
                rows={4}
                value={customPromptInput}
                onChange={(e) => setCustomPromptInput(e.target.value)}
                maxLength={500}
                placeholder="描述你希望 AI 伙伴的性格、语气和交流方式..."
                autoFocus
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-content-tertiary">{customPromptInput.length}/500</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditingPrompt(false); setCustomPromptInput(aiStyles.current?.custom_prompt || '') }}
                    className="btn-secondary px-3 py-1.5 rounded-button text-xs"
                  >取消</button>
                  <button
                    onClick={async () => {
                      try {
                        const result = await updateCustomPrompt(customPromptInput)
                        setAiStyles(prev => ({ ...prev, current: { ...prev.current, custom_prompt: result.customPrompt } }))
                        toast('自定义描述已更新')
                        setEditingPrompt(false)
                      } catch (err) {
                        toast('更新失败', { description: err.message })
                      }
                    }}
                    className="btn-primary px-3 py-1.5 rounded-button text-xs"
                  >保存</button>
                </div>
              </div>
              <p className="text-[11px] text-content-tertiary dark:text-gray-600 mt-2">
                提示：描述 AI 的性格、说话风格、用词习惯等。留空则使用预设风格。
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm text-content dark:text-gray-100 truncate flex-1">
                {aiStyles.current?.custom_prompt
                  ? (aiStyles.current.custom_prompt.length > 40
                      ? aiStyles.current.custom_prompt.slice(0, 40) + '...'
                      : aiStyles.current.custom_prompt)
                  : '未设置'}
              </span>
              <button
                onClick={() => setEditingPrompt(true)}
                className="text-xs text-primary hover:underline ml-2 flex-shrink-0"
              >{aiStyles.current?.custom_prompt ? '编辑' : '创建'}</button>
            </div>
          )}
        </div>
        )}

        {/* Reset Section */}
        <div className="mt-5 pt-4 border-t border-gray-100/60 dark:border-white/[0.06] flex flex-col gap-2">
          {/* Reset personality — only for custom style */}
          {aiStyles.current?.style_key === 'custom' && (
            showResetPersonalityConfirm ? (
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-red-50 dark:bg-red-500/10">
                <p className="text-xs text-content-secondary flex-1">确定重置性格描述？将清除自定义性格描述。</p>
                <button
                  onClick={async () => {
                    try {
                      await resetPersonality()
                      setAiStyles(prev => prev.current ? { ...prev, current: { ...prev.current, custom_prompt: null } } : prev)
                      setCustomPromptInput('')
                      toast('性格描述已重置')
                      setShowResetPersonalityConfirm(false)
                    } catch (err) {
                      toast('重置失败', { description: err.message })
                    }
                  }}
                  className="px-3 py-1 rounded-button text-xs bg-red-500 text-white hover:bg-red-600 transition-colors"
                >确定</button>
                <button
                  onClick={() => setShowResetPersonalityConfirm(false)}
                  className="btn-secondary px-3 py-1 rounded-button text-xs"
                >取消</button>
              </div>
            ) : (
              <button
                onClick={() => setShowResetPersonalityConfirm(true)}
                className="text-xs text-red-400 hover:text-red-500 transition-colors w-fit"
              >重置性格</button>
            )
          )}

          {/* Clear memory */}
          {showClearMemoryConfirm ? (
            <div className="flex items-center gap-3 p-2.5 rounded-lg bg-red-50 dark:bg-red-500/10">
              <p className="text-xs text-content-secondary flex-1">确定清除记忆？将删除所有聊天记录和 AI 记忆，不可恢复。</p>
              <button
                onClick={async () => {
                  try {
                    await clearMemory()
                    toast('记忆已清除')
                    setShowClearMemoryConfirm(false)
                  } catch (err) {
                    toast('清除失败', { description: err.message })
                  }
                }}
                className="px-3 py-1 rounded-button text-xs bg-red-500 text-white hover:bg-red-600 transition-colors"
              >确定</button>
              <button
                onClick={() => setShowClearMemoryConfirm(false)}
                className="btn-secondary px-3 py-1 rounded-button text-xs"
              >取消</button>
            </div>
          ) : (
            <button
              onClick={() => setShowClearMemoryConfirm(true)}
              className="text-xs text-red-400 hover:text-red-500 transition-colors w-fit"
            >清除记忆</button>
          )}
        </div>
      </Modal>

    </div>
  )
}
