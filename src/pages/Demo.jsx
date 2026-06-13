import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'sonner'
import AuthFooter from '../components/AuthFooter'

export default function Demo() {
  const { redeemDemoCode } = useAuth()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!code.trim()) {
      toast.error('请输入体验码')
      return
    }
    setLoading(true)
    try {
      await redeemDemoCode(code.trim())
      toast.success('欢迎使用 LingoForge！')
      navigate('/demo/home', { replace: true })
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
          Nothing is impossible.
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
          <h1 className="text-2xl font-bold text-white text-center mb-8">体验</h1>
          <p className="text-sm text-white/50 text-center mb-6">
            输入体验码，免费试用 1 小时
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="体验码"
                autoComplete="off"
                className="w-full border-b border-white/30 py-3 px-1 outline-none focus:border-white transition-colors text-sm"
                style={{ backgroundColor: 'transparent', color: 'white' }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-white/90 text-gray-800 font-medium hover:bg-white disabled:opacity-50 transition-colors mt-2"
            >
              {loading ? '验证中...' : '开始体验'}
            </button>
          </form>

          <div className="mt-6 text-center space-y-2">
            <p className="text-sm text-white/60">
              已有账号？
              <Link to="/login" className="text-white hover:underline ml-1">
                登录
              </Link>
            </p>
            <p className="text-sm text-white/60">
              还没有账号？
              <Link to="/register" className="text-white hover:underline ml-1">
                注册
              </Link>
            </p>
          </div>
        </div>
      </div>

      <AuthFooter />
    </div>
  )
}
