import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

const STORAGE_KEY = 'lingoforge_profile'

const defaultState = {
  nickname: '学习者',
  signature: '',
  avatar: '',
  dailyGoalMinutes: 30,
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
      dailyGoalMinutes: typeof parsed.dailyGoalMinutes === 'number' ? parsed.dailyGoalMinutes : defaultState.dailyGoalMinutes,
    }
  } catch {
    return { ...defaultState }
  }
}

let cache = loadFromStorage()
const listeners = new Set()

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
      if (user.nickname && user.nickname !== cache.nickname) { cache = { ...cache, nickname: user.nickname }; changed = true }
      if (user.signature != null && user.signature !== cache.signature) { cache = { ...cache, signature: user.signature }; changed = true }
      if (user.avatar && user.avatar !== cache.avatar) { cache = { ...cache, avatar: user.avatar }; changed = true }
      if (user.dailyGoalMinutes && user.dailyGoalMinutes !== cache.dailyGoalMinutes) { cache = { ...cache, dailyGoalMinutes: user.dailyGoalMinutes }; changed = true }
      if (changed) persist()
    }
  }, [user])

  return {
    nickname: cache.nickname,
    signature: cache.signature,
    avatar: cache.avatar,
    dailyGoalMinutes: cache.dailyGoalMinutes,
    setNickname(name) {
      const trimmed = name.trim()
      if (!trimmed) return
      cache = { ...cache, nickname: trimmed }
      persist()
      updateProfile({ nickname: trimmed }).catch(() => {})
    },
    setSignature(sig) {
      cache = { ...cache, signature: sig }
      persist()
      updateProfile({ signature: sig }).catch(() => {})
    },
    setAvatar(dataUrl) {
      cache = { ...cache, avatar: dataUrl }
      persist()
      updateProfile({ avatar: dataUrl }).catch(() => {})
    },
    setDailyGoalMinutes(n) {
      const clamped = Math.max(5, Math.min(300, Math.round(n)))
      cache = { ...cache, dailyGoalMinutes: clamped }
      persist()
      updateProfile({ dailyGoalMinutes: clamped }).catch(() => {})
    },
  }
}

export async function syncProfileFromServer() {
  // Profile sync is now handled by AuthContext
}
