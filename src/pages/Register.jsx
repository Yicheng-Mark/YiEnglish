import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'sonner'
import SocialLinks from '../components/SocialLinks'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
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
      toast.error('密码需包含至少一个字母和一个数字')
      return
    }
    if (password !== confirmPassword) {
      toast.error('两次密码不一致')
      return
    }

    setLoading(true)
    try {
      await register(username.trim(), password, nickname.trim() || undefined)
      toast.success('注册成功')
      navigate('/', { replace: true })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black">
      <div className="min-h-screen flex items-center justify-center px-4 py-8">
        <div
          className="w-full max-w-sm backdrop-blur-xl bg-black/30 border border-white/20 rounded-2xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto"
          style={{ animation: 'login-card-enter 0.6s ease-out' }}
        >
          <h1 className="text-2xl font-bold text-white text-center mb-8">注册</h1>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="用户名（3-30 位，字母/数字/下划线/中文）"
                autoComplete="username"
                className="w-full bg-transparent border-b border-white/30 text-white placeholder-white/40 py-3 px-1 outline-none focus:border-white transition-colors text-sm"
              />
            </div>
            <div>
              <input
                type="text"
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                placeholder="昵称（选填，默认同用户名）"
                className="w-full bg-transparent border-b border-white/30 text-white placeholder-white/40 py-3 px-1 outline-none focus:border-white transition-colors text-sm"
              />
            </div>
            <div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="密码（8+ 位，含字母和数字）"
                autoComplete="new-password"
                className="w-full bg-transparent border-b border-white/30 text-white placeholder-white/40 py-3 px-1 outline-none focus:border-white transition-colors text-sm"
              />
            </div>
            <div>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="确认密码"
                autoComplete="new-password"
                className="w-full bg-transparent border-b border-white/30 text-white placeholder-white/40 py-3 px-1 outline-none focus:border-white transition-colors text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-white/90 text-gray-800 font-medium hover:bg-white disabled:opacity-50 transition-colors mt-2"
            >
              {loading ? '注册中...' : '注册'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-white/60">
            已有账号？
            <Link to="/login" className="text-white hover:underline ml-1">
              登录
            </Link>
          </p>
          <p className="mt-2 text-center text-sm text-white/60">
            想先体验一下？
            <Link to="/demo" className="text-white hover:underline ml-1">
              输入体验码
            </Link>
          </p>
        </div>
      </div>

      <SocialLinks className="absolute bottom-12 left-0 right-0" />
      <a
        href="https://beian.miit.gov.cn/"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-4 left-0 right-0 text-center text-xs text-white/40 hover:text-white/60 transition-colors"
      >
        闽ICP备2026017084号-1
      </a>
    </div>
  )
}
