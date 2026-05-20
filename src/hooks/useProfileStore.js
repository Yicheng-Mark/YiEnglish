import { useEffect, useState } from 'react'
import { getToken } from '../lib/auth'
import { apiUpdateProfile, apiGetProfile } from '../lib/auth'

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

function syncProfileUpdate(updates) {
  if (!getToken()) return
  apiUpdateProfile(updates).catch(e => console.warn('Sync profile update failed:', e))
}

export function useProfileStore() {
  const [, setTick] = useState(0)

  useEffect(() => {
    const fn = () => setTick((t) => t + 1)
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  }, [])

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
      syncProfileUpdate({ nickname: trimmed })
    },
    setSignature(sig) {
      cache = { ...cache, signature: sig }
      persist()
      syncProfileUpdate({ signature: sig })
    },
    setAvatar(dataUrl) {
      cache = { ...cache, avatar: dataUrl }
      persist()
      syncProfileUpdate({ avatar: dataUrl })
    },
    setDailyGoalMinutes(n) {
      const clamped = Math.max(5, Math.min(300, Math.round(n)))
      cache = { ...cache, dailyGoalMinutes: clamped }
      persist()
      syncProfileUpdate({ dailyGoalMinutes: clamped })
    },
  }
}

export async function syncProfileFromServer() {
  if (!getToken()) return
  try {
    const profile = await apiGetProfile()
    if (!profile) return
    cache = {
      nickname: profile.nickname || defaultState.nickname,
      signature: profile.signature || defaultState.signature,
      avatar: profile.avatar || defaultState.avatar,
      dailyGoalMinutes: profile.dailyGoalMinutes || defaultState.dailyGoalMinutes,
    }
    persist()
  } catch (e) {
    console.warn('Sync profile from server failed:', e)
  }
}
