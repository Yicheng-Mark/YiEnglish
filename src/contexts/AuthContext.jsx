import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '../lib/api'
import { getDeviceId } from '../utils/getDeviceId'
import { resetErrorBookCache } from '../utils/errorBook'
import { resetReviewCardsCache } from '../utils/reviewCards'
import { resetFavoriteWordsCache } from '../utils/favoriteWords'
import { resetReadingWordBookCache } from '../utils/readingWordBook'
import { resetCorpusWordBookCache } from '../utils/corpusWordBook'
import { resetLocalProgressCache } from '../utils/localProgress'
import { syncSettingsFromServer } from '../hooks/useUserConfig'
import { syncErrorBookFromServer } from '../utils/errorBook'
import { syncReviewCardsFromServer } from '../utils/reviewCards'
import { syncFavoriteWordsFromServer } from '../utils/favoriteWords'
import { syncReadingWordBookFromServer } from '../utils/readingWordBook'
import { syncCorpusWordBookFromServer } from '../utils/corpusWordBook'

// 方案A：拆成两个 context。
// - 稳定方法 context：login / register / logout / updateProfile / changePassword /
//   redeemDemoCode / recoverLookup / recoverReset / setNavigator。
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

// 登出与 401 强制登出共用：断开各本地缓存的内存态与待写队列（只断内存态，
// 不删 localStorage/IDB 里的用户数据），避免旧账号的内存快照/合批增量串进新会话
function resetAllLocalCaches() {
  resetErrorBookCache()
  resetReviewCardsCache()
  resetFavoriteWordsCache()
  resetReadingWordBookCache()
  resetCorpusWordBookCache()
  resetLocalProgressCache()
}

// 登录/会话恢复成功后，并行拉取五个词本的服务端权威数据覆盖本地缓存。
// 采用覆盖式而非合并：主应用所有词本写入口（打字/阅读/语料/复习）都在
// ProtectedRoute 之下，不存在「未登录本地积累 → 后登录」的场景；登出与 401
// 时已 reset 内存态，本地残留只有上一个账号的数据，覆盖正是期望行为。
// allSettled + 各 sync 自带 try/catch：任一失败静默，不阻塞登录流程
function syncWordBooksFromServer() {
  Promise.allSettled([
    syncErrorBookFromServer(),
    syncReviewCardsFromServer(),
    syncFavoriteWordsFromServer(),
    syncReadingWordBookFromServer(),
    syncCorpusWordBookFromServer(),
  ])
}

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
            // 恢复会话后拉一次服务端设置（跨设备同步设置/主题），失败静默
            syncSettingsFromServer()
            syncWordBooksFromServer()
            return
          }
          // 会话恢复失败的真实原因提示：这里走的是裸 fetch，不经 api.js 的 toast 通道，
          // 不读 body 的话到期用户回到页面只会被静默弹回登录页，没有任何解释
          const failData = await refreshRes.json().catch(() => ({}))
          if (failData.code === 'SUBSCRIPTION_EXPIRED') {
            toast.error('账号已到期')
          } else if (failData.code === 'TRIAL_EXPIRED') {
            toast.error('体验时间已结束，欢迎注册继续使用')
          }
        } else if (res.ok) {
          const data = await res.json()
          setUser(data.user)
          syncSettingsFromServer()
          syncWordBooksFromServer()
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
      // 与 logout 同样的缓存断开：401 强制登出后旧账号内存态不能留给下一个登录
      resetAllLocalCaches()
      setUser(null)
      navigateRef.current?.('/login', { replace: true })
    }
    window.addEventListener('auth:unauthorized', onUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized)
  }, [])

  // totpCode：管理员开启两步验证后的第二因子；非管理员/未开启时省略
  const login = useCallback(async (username, password, totpCode) => {
    const body = { username, password, deviceId: getDeviceId() }
    if (totpCode) body.totpCode = totpCode
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
    // 网关 502 等场景返回 HTML，json() 会抛 SyntaxError：兜底为空对象走下方 !res.ok 文案
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const err = new Error(data.error || '登录失败')
      // TOTP_REQUIRED/TOTP_INVALID 供登录页展示动态验证码输入框（管理员两步验证）
      if (data.code) err.code = data.code
      throw err
    }
    setUser(data.user)
    // 登录后拉一次服务端设置（跨设备同步设置/主题），并拉取五个词本的服务端
    // 权威数据，均不阻塞登录流程
    syncSettingsFromServer()
    syncWordBooksFromServer()
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

  // lookup 只回打码用户名（usernameMasked）：完整用户名是 reset 的第二要素，
  // 不能凭激活码直接拿到
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

  // 双要素找回：激活码 + 当前用户名（newUsername 可选改名；totpCode 为管理员两步验证）
  const recoverReset = useCallback(
    async (code, currentUsername, password, newUsername, totpCode) => {
      const body = { code, currentUsername, password, deviceId: getDeviceId() }
      if (newUsername) body.newUsername = newUsername
      if (totpCode) body.totpCode = totpCode
      const res = await fetch(`${API_BASE}/api/auth/recover-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const err = new Error(data.error || '重置失败')
        if (data.code) err.code = data.code
        throw err
      }
      setUser(data.user)
      return data.user
    },
    []
  )

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
    resetAllLocalCaches()
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

  // 稳定方法 context：依赖全部是 useCallback 稳定引用，挂载后 value 永不重建。
  // 这意味着只读方法（如 Login/Register/Recover/Demo/PersonalCenter/DemoProfile/App=setNavigator）
  // 的消费者不再随 user/loading 变化重渲染。
  // upgradeAccount 已随 /api/demo/upgrade 端点关闭（2026-09-16）一并移除。
  const actionsValue = useMemo(
    () => ({
      login,
      register,
      logout,
      updateProfile,
      changePassword,
      redeemDemoCode,
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
