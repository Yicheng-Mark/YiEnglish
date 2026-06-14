import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function TrialBanner() {
  const { user } = useAuth()
  const [remaining, setRemaining] = useState('')

  // 倒计时
  useEffect(() => {
    if (!user?.trialExpiresAt) return
    function update() {
      const diff = new Date(user.trialExpiresAt) - new Date()
      if (diff <= 0) {
        setRemaining('已到期')
        return
      }
      const minutes = Math.floor(diff / 60000)
      const hours = Math.floor(minutes / 60)
      const mins = minutes % 60
      if (hours > 0) {
        setRemaining(`${hours} 小时 ${mins} 分钟`)
      } else {
        setRemaining(`${mins} 分钟`)
      }
    }
    update()
    const timer = setInterval(update, 60000)
    return () => clearInterval(timer)
  }, [user?.trialExpiresAt])

  if (!user?.isTrial) return null

  return (
    <>
      {/* 试用状态条（保留倒计时） */}
      <div className="bg-gradient-to-r from-amber-500/90 to-orange-500/90 text-white text-center py-2 px-4 text-sm">
        <span>
          体验中{remaining ? ` — 剩余 ${remaining}` : ''}
        </span>
      </div>
    </>
  )
}
