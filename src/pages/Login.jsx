import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'sonner'
import AuthFooter from '../components/AuthFooter'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const from = location.state?.from?.pathname || '/'

  async function handleSubmit(e) {
    e.preventDefault()
    if (!username.trim() || !password) {
      toast.error('请输入用户名和密码')
      return
    }
    setLoading(true)
    try {
      await login(username.trim(), password)
      navigate(from, { replace: true })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black">
      <div className="min-h-screen flex flex-col items-center justify-center px-4 pt-[10vh] pb-[10vh]">
        <p
          className="text-4xl md:text-5xl lg:text-6xl font-light italic tracking-[0.25em] mb-20 md:mb-28"
          style={{
            color: 'rgba(255,255,255,0.9)',
            textShadow: '0 0 20px rgba(255,255,255,0.08)',
            animation: 'titleFadeIn 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
          }}
        >
          Yi English
        </p>
        <div
          className="w-full max-w-sm border border-white/20 rounded-2xl shadow-2xl p-8"
          style={{
            animation: 'login-card-enter 0.6s ease-out 0.3s both',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
          }}
        >
          <h1 className="text-2xl font-bold text-white text-center mb-8">登录</h1>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="用户名"
                autoComplete="username"
                className="w-full border-b border-white/30 py-3 px-1 outline-none focus:border-white transition-colors text-sm"
                style={{ backgroundColor: 'transparent', color: 'white' }}
              />
            </div>
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="密码"
                autoComplete="current-password"
                className="w-full border-b border-white/30 py-3 px-1 outline-none focus:border-white transition-colors text-sm"
                style={{ backgroundColor: 'transparent', color: 'white' }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-white/90 text-gray-800 font-medium hover:bg-white disabled:opacity-50 transition-colors mt-2"
            >
              {loading ? '登录中...' : '登录'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-white/60">
            还没有账号？
            <Link to="/activate" className="text-white hover:underline ml-1">
              注册
            </Link>
          </p>
          <p className="mt-2 text-center text-sm text-white/60">
            想先体验一下？
            <Link to="/demo" className="text-white hover:underline ml-1">
              输入体验码
            </Link>
          </p>
          <p className="mt-2 text-center text-sm text-white/60">
            <Link to="/recover" className="text-white hover:underline">
              找回密码
            </Link>
          </p>
        </div>
      </div>

      <AuthFooter />
    </div>
  )
}
