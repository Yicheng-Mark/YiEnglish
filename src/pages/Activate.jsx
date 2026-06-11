import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import SocialLinks from '../components/SocialLinks'
import { apiFetch } from '../lib/api'

const VALIDATED_CODE_KEY = 'validated_activation_code'

export default function Activate() {
  const navigate = useNavigate()
  const { code: urlCode } = useParams()
  const [code, setCode] = useState(urlCode || '')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = code.trim()
    if (!trimmed) return

    setLoading(true)
    try {
      const res = await apiFetch('/api/auth/validate-activation-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      })
      const data = await res.json()

      if (!res.ok || !data.valid) {
        toast.error(data.message || '激活码无效')
        return
      }

      sessionStorage.setItem(VALIDATED_CODE_KEY, trimmed)
      navigate('/register', { replace: true })
    } catch (err) {
      toast.error('验证失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black">
      <div className="min-h-screen flex items-center justify-center px-4 py-8">
        <div
          className="w-full max-w-sm border border-white/20 rounded-2xl shadow-2xl p-8"
          style={{
            animation: 'login-card-enter 0.6s ease-out 0.3s both',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
          }}
        >
          <h1 className="text-2xl font-bold text-white text-center mb-8">加入 Nothing is impossible.</h1>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="请输入激活码"
                autoComplete="off"
                autoFocus
                className="w-full border-b border-white/30 py-3 px-1 outline-none focus:border-white transition-colors text-sm"
                style={{ backgroundColor: 'transparent', color: 'white' }}
              />
            </div>

            <button
              type="submit"
              disabled={!code.trim() || loading}
              className="w-full py-3 rounded-xl bg-white/90 text-gray-800 font-medium hover:bg-white disabled:opacity-50 transition-colors mt-2"
            >
              {loading ? '验证中...' : '验证'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-white/60">
            <Link to="/login" className="text-white hover:underline">
              返回登录
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
