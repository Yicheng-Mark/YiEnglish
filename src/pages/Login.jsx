import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { apiLogin, apiRegister, apiSendCode, apiResetPassword } from '../lib/auth'
import { useAuth } from '../hooks/useAuth'
import styles from './Login.module.css'

const TABS = {
  login: 'login',
  register: 'register',
  forgot: 'forgot',
}

export default function Login() {
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/word'

  const [tab, setTab] = useState(TABS.login)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const timerRef = useRef(null)

  useEffect(() => {
    return () => clearInterval(timerRef.current)
  }, [])

  const startCountdown = () => {
    setCountdown(60)
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const handleSendCode = async (type) => {
    if (!email) { setError('请输入邮箱'); return }
    if (!/\S+@\S+\.\S+/.test(email)) { setError('邮箱格式不正确'); return }
    setError('')
    try {
      await apiSendCode(email, type)
      startCountdown()
    } catch (err) {
      setError(err instanceof TypeError ? '服务器暂时不可用，请稍后再试' : err.message)
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await apiLogin(email, password)
      setUser(data.user)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof TypeError ? '服务器暂时不可用，请稍后再试' : err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await apiRegister(email, code, password, nickname)
      setUser(data.user)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof TypeError ? '服务器暂时不可用，请稍后再试' : err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await apiResetPassword(email, code, password)
      setTab(TABS.login)
      setError('')
      setPassword('')
      setCode('')
    } catch (err) {
      setError(err instanceof TypeError ? '服务器暂时不可用，请稍后再试' : err.message)
    } finally {
      setLoading(false)
    }
  }

  const switchTab = (t) => {
    setTab(t)
    setError('')
    setCode('')
    setPassword('')
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>LingoForge</div>
        <p className={styles.subtitle}>英语学习闭环平台</p>

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === TABS.login ? styles.tabActive : ''}`}
            onClick={() => switchTab(TABS.login)}
          >登录</button>
          <button
            className={`${styles.tab} ${tab === TABS.register ? styles.tabActive : ''}`}
            onClick={() => switchTab(TABS.register)}
          >注册</button>
        </div>

        {/* ---- LOGIN ---- */}
        {tab === TABS.login && (
          <form onSubmit={handleLogin} className={styles.form}>
            <input
              type="email"
              placeholder="邮箱"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className={styles.input}
            />
            <input
              type="password"
              placeholder="密码"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className={styles.input}
            />
            {error && <p className={styles.error}>{error}</p>}
            <button type="submit" disabled={loading} className={styles.submitBtn}>
              {loading ? '请稍候...' : '登录'}
            </button>
            <button type="button" className={styles.linkBtn} onClick={() => switchTab(TABS.forgot)}>
              忘记密码？
            </button>
          </form>
        )}

        {/* ---- REGISTER ---- */}
        {tab === TABS.register && (
          <form onSubmit={handleRegister} className={styles.form}>
            <div className={styles.inputRow}>
              <input
                type="email"
                placeholder="邮箱"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className={styles.input}
              />
              <button
                type="button"
                className={styles.codeBtn}
                disabled={countdown > 0}
                onClick={() => handleSendCode('register')}
              >
                {countdown > 0 ? `${countdown}s` : '获取验证码'}
              </button>
            </div>
            <input
              type="text"
              placeholder="6 位验证码"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              maxLength={6}
              className={styles.input}
            />
            <input
              type="password"
              placeholder="密码（至少 6 位）"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              className={styles.input}
            />
            <input
              type="text"
              placeholder="昵称（选填）"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              className={styles.input}
            />
            {error && <p className={styles.error}>{error}</p>}
            <button type="submit" disabled={loading} className={styles.submitBtn}>
              {loading ? '请稍候...' : '注册'}
            </button>
          </form>
        )}

        {/* ---- FORGOT PASSWORD ---- */}
        {tab === TABS.forgot && (
          <form onSubmit={handleReset} className={styles.form}>
            <p className={styles.forgotHint}>输入注册邮箱，获取验证码后重置密码</p>
            <div className={styles.inputRow}>
              <input
                type="email"
                placeholder="邮箱"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className={styles.input}
              />
              <button
                type="button"
                className={styles.codeBtn}
                disabled={countdown > 0}
                onClick={() => handleSendCode('reset')}
              >
                {countdown > 0 ? `${countdown}s` : '获取验证码'}
              </button>
            </div>
            <input
              type="text"
              placeholder="6 位验证码"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              maxLength={6}
              className={styles.input}
            />
            <input
              type="password"
              placeholder="新密码（至少 6 位）"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              className={styles.input}
            />
            {error && <p className={styles.error}>{error}</p>}
            <button type="submit" disabled={loading} className={styles.submitBtn}>
              {loading ? '请稍候...' : '重置密码'}
            </button>
            <button type="button" className={styles.linkBtn} onClick={() => switchTab(TABS.login)}>
              返回登录
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
