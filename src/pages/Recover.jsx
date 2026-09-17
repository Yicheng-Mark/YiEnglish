import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import AuthFooter from '../components/AuthFooter'
import { useAuth } from '../contexts/AuthContext'

// 从输入中提取激活码：支持裸码，也支持粘贴完整链接 .../activate/<码> 或 .../recover/<码>
function extractCode(raw) {
  const trimmed = String(raw || '').trim()
  const m = trimmed.match(/\/(?:activate|recover)\/([^/?#]+)/)
  return m ? m[1] : trimmed
}

export default function Recover() {
  const navigate = useNavigate()
  const { recoverLookup, recoverReset } = useAuth()
  const { code: urlCode } = useParams()

  const [step, setStep] = useState(1)
  const [code, setCode] = useState(urlCode || '')
  // lookup 只回打码用户名（如 z***g），仅供确认找对了账号
  const [usernameMasked, setUsernameMasked] = useState('')
  const [currentUsername, setCurrentUsername] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [needTotp, setNeedTotp] = useState(false)
  const [loading, setLoading] = useState(false)

  // Step 1：凭注册链接定位账号
  async function handleLookup(e) {
    e.preventDefault()
    const trimmed = extractCode(code)
    if (!trimmed) {
      toast.error('请输入注册链接')
      return
    }
    setLoading(true)
    try {
      const data = await recoverLookup(trimmed)
      setUsernameMasked(data.usernameMasked || '')
      setCode(trimmed)
      setStep(2)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Step 2：输入当前用户名（第二要素）+ 新密码；可选改用户名
  async function handleReset(e) {
    e.preventDefault()
    if (!currentUsername.trim()) {
      toast.error('请输入该账号的当前用户名')
      return
    }
    if (newUsername.trim() && !/^[a-zA-Z0-9_一-鿿]{3,30}$/.test(newUsername.trim())) {
      toast.error('新用户名需 3-30 位，支持字母、数字、下划线、中文')
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
      await recoverReset(
        extractCode(code),
        currentUsername.trim(),
        password,
        newUsername.trim() || undefined,
        needTotp ? totpCode.trim() : undefined
      )
      toast.success('重置成功')
      navigate('/', { replace: true })
    } catch (err) {
      if (err.code === 'TOTP_REQUIRED' || err.code === 'TOTP_INVALID') {
        setNeedTotp(true)
        if (err.code === 'TOTP_INVALID') setTotpCode('')
      }
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-shell fixed inset-0 bg-black">
      <div className="min-h-screen flex items-center justify-center px-4 py-8">
        <div
          className="w-full max-w-sm backdrop-blur-xl bg-black/30 border border-white/20 rounded-2xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto"
          style={{ animation: 'login-card-enter 0.6s ease-out' }}
        >
          <h1 className="text-2xl font-bold text-white text-center mb-8">找回密码</h1>

          {step === 1 ? (
            <form onSubmit={handleLookup} className="space-y-5">
              <p className="text-center text-sm text-white/60">输入你的注册链接以定位账号</p>
              <div>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(extractCode(e.target.value))}
                  placeholder="请输入注册链接"
                  autoComplete="off"
                  autoFocus
                  className="w-full bg-transparent border-b border-white/30 text-white placeholder-white/40 py-3 px-1 outline-none focus:border-white transition-colors text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={!code.trim() || loading}
                className="w-full py-3 rounded-xl bg-white/90 text-gray-800 font-medium hover:bg-white disabled:opacity-50 transition-colors mt-2"
              >
                {loading ? '查找中...' : '查找账号'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleReset} className="space-y-5">
              <div>
                <input
                  type="text"
                  value={usernameMasked}
                  readOnly
                  placeholder="关联账号"
                  className="w-full bg-transparent border-b border-white/30 text-white placeholder-white/40 py-3 px-1 outline-none text-sm opacity-70 cursor-default"
                />
              </div>
              <div>
                <input
                  type="text"
                  value={currentUsername}
                  onChange={(e) => setCurrentUsername(e.target.value)}
                  placeholder="当前用户名（凭此确认账号归属）"
                  autoComplete="username"
                  autoFocus
                  className="w-full bg-transparent border-b border-white/30 text-white placeholder-white/40 py-3 px-1 outline-none focus:border-white transition-colors text-sm"
                />
              </div>
              <div>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="新用户名（可选，3-30 位，字母/数字/下划线/中文）"
                  autoComplete="off"
                  className="w-full bg-transparent border-b border-white/30 text-white placeholder-white/40 py-3 px-1 outline-none focus:border-white transition-colors text-sm"
                />
              </div>
              <div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="新密码（8+ 位，含字母和数字）"
                  autoComplete="new-password"
                  className="w-full bg-transparent border-b border-white/30 text-white placeholder-white/40 py-3 px-1 outline-none focus:border-white transition-colors text-sm"
                />
              </div>
              <div>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="确认新密码"
                  autoComplete="new-password"
                  className="w-full bg-transparent border-b border-white/30 text-white placeholder-white/40 py-3 px-1 outline-none focus:border-white transition-colors text-sm"
                />
              </div>
              {needTotp && (
                <div>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="动态验证码（6 位）"
                    autoComplete="one-time-code"
                    className="w-full bg-transparent border-b border-white/30 text-white placeholder-white/40 py-3 px-1 outline-none focus:border-white transition-colors text-sm tracking-[0.3em]"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-white/90 text-gray-800 font-medium hover:bg-white disabled:opacity-50 transition-colors mt-2"
              >
                {loading ? '重置中...' : '重置并登录'}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-white/60">
            <Link to="/login" className="text-white hover:underline">
              返回登录
            </Link>
          </p>
        </div>
      </div>

      <AuthFooter />
    </div>
  )
}
