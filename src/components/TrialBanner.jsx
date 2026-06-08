import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'sonner'

export default function TrialBanner() {
  const { user, upgradeAccount } = useAuth()
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(false)
  const [remaining, setRemaining] = useState('')

  // 倒计时
  useEffect(() => {
    if (!user?.trialExpiresAt) return
    function update() {
      const diff = new Date(user.trialExpiresAt) - new Date()
      if (diff <= 0) {
        setRemaining('已到期')
        return
      }
      const minutes = Math.floor(diff / 60000)
      const hours = Math.floor(minutes / 60)
      const mins = minutes % 60
      if (hours > 0) {
        setRemaining(`${hours} 小时 ${mins} 分钟`)
      } else {
        setRemaining(`${mins} 分钟`)
      }
    }
    update()
    const timer = setInterval(update, 60000)
    return () => clearInterval(timer)
  }, [user?.trialExpiresAt])

  async function handleUpgrade(e) {
    e.preventDefault()
    if (!username.trim()) {
      toast.error('请输入用户名')
      return
    }
    if (!/^[a-zA-Z0-9_一-鿿]{3,30}$/.test(username.trim())) {
      toast.error('用户名需 3-30 位，支持字母、数字、下划线、中文')
      return
    }
    if (password.length < 8) {
      toast.error('密码至少 8 位')
      return
    }
    if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      toast.error('密码需包含字母和数字')
      return
    }
    if (password !== confirmPassword) {
      toast.error('两次密码不一致')
      return
    }
    setLoading(true)
    try {
      await upgradeAccount(username.trim(), password, nickname.trim() || undefined)
      toast.success('升级成功，欢迎使用 LingoForge！')
      setShowUpgrade(false)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!user?.isTrial) return null

  return (
    <>
      {/* 试用状态条 */}
      <div className="bg-gradient-to-r from-amber-500/90 to-orange-500/90 text-white text-center py-2 px-4 text-sm flex items-center justify-center gap-3">
        <span>
          体验中{remaining ? ` — 剩余 ${remaining}` : ''}
        </span>
        <button
          onClick={() => setShowUpgrade(true)}
          className="px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-xs font-medium"
        >
          升级为正式账号
        </button>
      </div>

      {/* 升级弹窗 */}
      {showUpgrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm border border-white/20 rounded-2xl shadow-2xl p-8 bg-neutral-900/95">
            <h2 className="text-xl font-bold text-white text-center mb-2">升级为正式账号</h2>
            <p className="text-sm text-white/50 text-center mb-6">
              设置用户名和密码，你的学习数据将全部保留
            </p>

            <form onSubmit={handleUpgrade} className="space-y-4">
              <div>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="用户名（3-30位）"
                  autoComplete="username"
                  className="w-full border-b border-white/30 py-3 px-1 outline-none focus:border-white transition-colors text-sm"
                  style={{ backgroundColor: 'transparent', color: 'white' }}
                />
              </div>
              <div>
                <input
                  type="text"
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  placeholder="昵称（选填）"
                  className="w-full border-b border-white/30 py-3 px-1 outline-none focus:border-white transition-colors text-sm"
                  style={{ backgroundColor: 'transparent', color: 'white' }}
                />
              </div>
              <div>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="密码（至少8位，含字母和数字）"
                  autoComplete="new-password"
                  className="w-full border-b border-white/30 py-3 px-1 outline-none focus:border-white transition-colors text-sm"
                  style={{ backgroundColor: 'transparent', color: 'white' }}
                />
              </div>
              <div>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="确认密码"
                  autoComplete="new-password"
                  className="w-full border-b border-white/30 py-3 px-1 outline-none focus:border-white transition-colors text-sm"
                  style={{ backgroundColor: 'transparent', color: 'white' }}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUpgrade(false)}
                  className="flex-1 py-3 rounded-xl border border-white/20 text-white/70 hover:text-white hover:border-white/40 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 rounded-xl bg-white/90 text-gray-800 font-medium hover:bg-white disabled:opacity-50 transition-colors"
                >
                  {loading ? '升级中...' : '确认升级'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
