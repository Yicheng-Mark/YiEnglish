import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { apiFetch } from '../lib/api'
import { getDeviceId } from '../utils/getDeviceId'
import { resetErrorBookCache } from '../utils/errorBook'
import { resetReviewCardsCache } from '../utils/reviewCards'
import { resetFavoriteWordsCache } from '../utils/favoriteWords'
import { resetReadingWordBookCache } from '../utils/readingWordBook'
import { resetCorpusWordBookCache } from '../utils/corpusWordBook'
import { resetLocalProgressCache } from '../utils/localProgress'

// 方案A：拆成两个 context。
// - 稳定方法 context：login / register / logout / updateProfile / changePassword /
//   redeemDemoCode / upgradeAccount / recoverLookup / recoverReset / setNavigator。
//   全部 useCallback 稳定，挂载后引用不变。
// - 身份状态 context：user / loading。登录、登出、资料更新、会话刷新时才会变。
//
// useAuth() 仍返回扁平对象，签名完全兼容，消费方零改动；另提供细粒度 hook
// useAuthActions() / useAuthUser() 供只读方法或只读身份的组件订阅，避免互相牵连重渲染。
const AuthActionsContext = createContext(null)
const AuthUserContext = createContext(null)

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''
const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED !== 'false'

const DEFAULT_USER = { id: 1, username: 'demo', nickname: '学习者' }

export function AuthProvider({ children }) {
  const [user, setUser] = useState(AUTH_ENABLED ? null : DEFAULT_USER)
  const [loading, setLoading] = useState(AUTH_ENABLED)
  const navigateRef = useRef(null)

  const setNavigator = useCallback((nav) => {
    navigateRef.current = nav
  }, [])

  useEffect(() => {
    if (!AUTH_ENABLED) return
    async function checkSession() {
      try {
        let res = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' })
        if (res.status === 401) {
          const refreshRes = await fetch(`${API_BASE}/api/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
          })
          if (refreshRes.ok) {
            const data = await refreshRes.json()
            setUser(data.user)
            return
          }
        } else if (res.ok) {
          const data = await res.json()
          setUser(data.user)
        }
      } catch {
        // not logged in
      } finally {
        setLoading(false)
      }
    }
    checkSession()
  }, [])

  useEffect(() => {
    if (!AUTH_ENABLED) return
    function onUnauthorized() {
      setUser(null)
      navigateRef.current?.('/login', { replace: true })
    }
    window.addEventListener('auth:unauthorized', onUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized)
  }, [])

  const login = useCallback(async (username, password) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password, deviceId: getDeviceId() }),
    })
    // 网关 502 等场景返回 HTML，json() 会抛 SyntaxError：兜底为空对象走下方 !res.ok 文案
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || '登录失败')
    setUser(data.user)
    return data.user
  }, [])

  const register = useCallback(async (username, password, nickname, activationCode) => {
    const body = { username, password, activationCode }
    if (nickname) body.nickname = nickname
    body.deviceId = getDeviceId()
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || '注册失败')
    setUser(data.user)
    return data.user
  }, [])

  const recoverLookup = useCallback(async (code) => {
    const res = await fetch(`${API_BASE}/api/auth/recover-lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ code }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || '查找失败')
    return data
  }, [])

  const recoverReset = useCallback(async (code, username, password) => {
    const res = await fetch(`${API_BASE}/api/auth/recover-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ code, username, password, deviceId: getDeviceId() }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || '重置失败')
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })
    } catch {
      // ignore
    }
    // 服务端会话结束后断开本地各缓存的内存态与待写队列：本地缓存的内存快照
    // 属于上一个账号，直接留给下一个账号会串数据，未上云的合批增量也会被
    // 推进新账号（只断内存态，不删 localStorage/IDB 里的用户数据）
    resetErrorBookCache()
    resetReviewCardsCache()
    resetFavoriteWordsCache()
    resetReadingWordBookCache()
    resetCorpusWordBookCache()
    resetLocalProgressCache()
    setUser(null)
  }, [])

  const updateProfile = useCallback(async (fields) => {
    const res = await apiFetch('/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(fields),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || '更新失败')
    setUser(data.user)
    return data.user
  }, [])

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    const res = await apiFetch('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || '修改密码失败')
  }, [])

  const redeemDemoCode = useCallback(async (code) => {
    const res = await fetch(`${API_BASE}/api/demo/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ code, deviceId: getDeviceId() }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || '体验码无效')
    setUser(data.user)
    return data.user
  }, [])

  const upgradeAccount = useCallback(async (username, password, nickname) => {
    const body = { username, password }
    if (nickname) body.nickname = nickname
    const res = await apiFetch('/api/demo/upgrade', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || '升级失败')
    setUser(data.user)
    return data.user
  }, [])

  // 稳定方法 context：依赖全部是 useCallback 稳定引用，挂载后 value 永不重建。
  // 这意味着只读方法（如 Login/Register/Recover/Demo/PersonalCenter/DemoProfile/App=setNavigator）
  // 的消费者不再随 user/loading 变化重渲染。
  const actionsValue = useMemo(
    () => ({
      login,
      register,
      logout,
      updateProfile,
      changePassword,
      redeemDemoCode,
      upgradeAccount,
      recoverLookup,
      recoverReset,
      setNavigator,
    }),
    [
      login,
      register,
      logout,
      updateProfile,
      changePassword,
      redeemDemoCode,
      upgradeAccount,
      recoverLookup,
      recoverReset,
      setNavigator,
    ]
  )

  // 身份状态 context：只在登录/登出/会话刷新/资料更新时变化。
  const userValue = useMemo(() => ({ user, loading }), [user, loading])

  return (
    <AuthActionsContext.Provider value={actionsValue}>
      <AuthUserContext.Provider value={userValue}>{children}</AuthUserContext.Provider>
    </AuthActionsContext.Provider>
  )
}

export function useAuth() {
  const actions = useContext(AuthActionsContext)
  const userCtx = useContext(AuthUserContext)
  if (!actions || !userCtx) throw new Error('useAuth must be used within AuthProvider')
  // 返回扁平结构，字段与改造前完全一致；消费方零改动。
  return useMemo(() => ({ ...userCtx, ...actions }), [userCtx, actions])
}

// 细粒度 hook（消费方未改动，供未来优化使用）：
// - useAuthActions()：只订阅稳定方法，不随 user/loading 变化重渲染。
// - useAuthUser()：只订阅身份状态。
export function useAuthActions() {
  const ctx = useContext(AuthActionsContext)
  if (!ctx) throw new Error('useAuthActions must be used within AuthProvider')
  return ctx
}

export function useAuthUser() {
  const ctx = useContext(AuthUserContext)
  if (!ctx) throw new Error('useAuthUser must be used within AuthProvider')
  return ctx
}
