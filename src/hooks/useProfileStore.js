import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

const STORAGE_KEY = 'lingoforge_profile'
const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED !== 'false'

const defaultState = {
  nickname: '学习者',
  signature: '',
  avatar: '',
  dailyGoalMinutes: 30,
  dailyWordGoal: 20,
}

function loadFromStorage() {
  if (typeof window === 'undefined') return { ...defaultState }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...defaultState }
    const parsed = JSON.parse(raw)
    return {
      nickname: typeof parsed.nickname === 'string' ? parsed.nickname : defaultState.nickname,
      signature: typeof parsed.signature === 'string' ? parsed.signature : defaultState.signature,
      avatar: typeof parsed.avatar === 'string' ? parsed.avatar : defaultState.avatar,
      dailyGoalMinutes:
        typeof parsed.dailyGoalMinutes === 'number'
          ? parsed.dailyGoalMinutes
          : defaultState.dailyGoalMinutes,
      dailyWordGoal:
        typeof parsed.dailyWordGoal === 'number'
          ? parsed.dailyWordGoal
          : defaultState.dailyWordGoal,
    }
  } catch {
    return { ...defaultState }
  }
}

let cache = loadFromStorage()
const listeners = new Set()
let profileMutationQueue = Promise.resolve()

function persist() {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
    } catch {
      /* ignore quota errors */
    }
  }
  listeners.forEach((fn) => fn())
}

// 资料接口每次都会返回完整 user。串行提交可避免头像与昵称等并发 PATCH
// 乱序返回后，用较旧的完整响应覆盖刚保存的新字段。
function enqueueProfileMutation(mutation) {
  const current = profileMutationQueue.catch(() => {}).then(mutation)
  profileMutationQueue = current
  return current
}

export function useProfileStore() {
  const { user, updateProfile } = useAuth()
  const [, setTick] = useState(0)

  useEffect(() => {
    const fn = () => setTick((t) => t + 1)
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  }, [])

  // sync from server user data when available
  useEffect(() => {
    if (user) {
      let changed = false
      if (typeof user.nickname === 'string' && user.nickname !== cache.nickname) {
        cache = { ...cache, nickname: user.nickname }
        changed = true
      }
      if (Object.prototype.hasOwnProperty.call(user, 'signature')) {
        const signature = typeof user.signature === 'string' ? user.signature : ''
        if (signature !== cache.signature) {
          cache = { ...cache, signature }
          changed = true
        }
      }
      // 服务端用 null 表示未设置/已清空头像；也要覆盖本地旧值，避免换设备或清空后“复活”。
      if (Object.prototype.hasOwnProperty.call(user, 'avatar')) {
        const avatar = typeof user.avatar === 'string' ? user.avatar : ''
        if (avatar !== cache.avatar) {
          cache = { ...cache, avatar }
          changed = true
        }
      }
      if (
        Number.isFinite(user.dailyGoalMinutes) &&
        user.dailyGoalMinutes !== cache.dailyGoalMinutes
      ) {
        cache = { ...cache, dailyGoalMinutes: user.dailyGoalMinutes }
        changed = true
      }
      if (changed) persist()
    }
  }, [user])

  const saveServerProfile = (fields, patch) => {
    if (!AUTH_ENABLED) {
      cache = { ...cache, ...patch }
      persist()
      return Promise.resolve()
    }
    return enqueueProfileMutation(async () => {
      await updateProfile(fields)
      cache = { ...cache, ...patch }
      persist()
    })
  }

  return {
    nickname: cache.nickname,
    signature: cache.signature,
    avatar: cache.avatar,
    dailyGoalMinutes: cache.dailyGoalMinutes,
    dailyWordGoal: cache.dailyWordGoal,
    setNickname(name) {
      const trimmed = name.trim()
      if (!trimmed) return Promise.resolve()
      return saveServerProfile({ nickname: trimmed }, { nickname: trimmed })
    },
    setSignature(sig) {
      return saveServerProfile({ signature: sig }, { signature: sig })
    },
    setProfile(name, signature) {
      const nickname = name.trim()
      if (!nickname) return Promise.resolve()
      return saveServerProfile({ nickname, signature }, { nickname, signature })
    },
    setAvatar(dataUrl) {
      // /api/auth/profile 的传输字段名是 avatarUrl；响应 user 字段才叫 avatar。
      const avatar = typeof dataUrl === 'string' ? dataUrl : ''
      return saveServerProfile({ avatarUrl: dataUrl }, { avatar })
    },
    setDailyGoalMinutes(n) {
      const clamped = Math.max(5, Math.min(300, Math.round(n)))
      return saveServerProfile({ dailyGoalMinutes: clamped }, { dailyGoalMinutes: clamped })
    },
    setDailyWordGoal(n) {
      const clamped = Math.max(5, Math.min(200, Math.round(n)))
      cache = { ...cache, dailyWordGoal: clamped }
      persist()
      // 当前服务端没有 dailyWordGoal 字段；该预留设置仅保存在本地。
    },
  }
}

export async function syncProfileFromServer() {
  // Profile sync is now handled by AuthContext
}
