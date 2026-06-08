import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { apiFetch } from '../lib/api'

const AuthContext = createContext(null)

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''
const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED !== 'false'

const DEFAULT_USER = { id: 1, username: 'demo', nickname: '学习者' }

export function AuthProvider({ children }) {
  const [user, setUser] = useState(AUTH_ENABLED ? null : DEFAULT_USER)
  const [loading, setLoading] = useState(AUTH_ENABLED)
  const navigateRef = useRef(null)

  const setNavigator = useCallback((nav) => { navigateRef.current = nav }, [])

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
      body: JSON.stringify({ username, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '登录失败')
    setUser(data.user)
    return data.user
  }, [])

  const register = useCallback(async (username, password, nickname) => {
    const body = { username, password }
    if (nickname) body.nickname = nickname
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '注册失败')
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
    setUser(null)
  }, [])

  const updateProfile = useCallback(async (fields) => {
    const res = await apiFetch('/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(fields),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '更新失败')
    setUser(data.user)
    return data.user
  }, [])

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    const res = await apiFetch('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '修改密码失败')
  }, [])

  const redeemDemoCode = useCallback(async (code) => {
    const res = await fetch(`${API_BASE}/api/demo/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ code }),
    })
    const data = await res.json()
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
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '升级失败')
    setUser(data.user)
    return data.user
  }, [])

  const value = useMemo(() => ({
    user, loading, login, register, logout, updateProfile, changePassword, redeemDemoCode, upgradeAccount, setNavigator
  }), [user, loading, login, register, logout, updateProfile, changePassword, redeemDemoCode, upgradeAccount, setNavigator])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
