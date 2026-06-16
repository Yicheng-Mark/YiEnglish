import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Smartphone, Monitor, Trash2, Loader2 } from 'lucide-react'
import { apiFetch } from '../lib/api'
import { getDeviceId } from '../utils/getDeviceId'

// 相对时间：刚刚 / X 分钟前 / X 小时前 / X 天前
function timeAgo(iso) {
  if (!iso) return '未知'
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 0) return '刚刚'
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} 小时前`
  const day = Math.floor(hr / 24)
  return `${day} 天前`
}

export default function Devices() {
  const navigate = useNavigate()
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [removingId, setRemovingId] = useState(null)

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/auth/devices?deviceId=${encodeURIComponent(getDeviceId())}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '加载失败')
      setDevices(data.devices || [])
    } catch (err) {
      toast('加载设备列表失败', { description: err.message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleRemove(id) {
    setRemovingId(id)
    try {
      const res = await apiFetch(`/api/auth/devices/${id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || '退出失败')
      toast('已退出该设备')
      setDevices((prev) => prev.filter((d) => d.id !== id))
    } catch (err) {
      toast('退出失败', { description: err.message })
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="min-h-[calc(100vh-3rem-3.5rem)] md:min-h-[calc(100vh-4rem-3.5rem)] max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-8 animate-page-fade-in">
      {/* Back button */}
      <button
        onClick={() => navigate('/profile')}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-content-secondary dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-colors -ml-2 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>返回</span>
      </button>

      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-content dark:text-gray-100">登录设备管理</h1>
        <p className="text-sm text-content-tertiary dark:text-gray-500 mt-1">
          每个账号最多同时登录 2 台设备。退出一台设备可立即为新设备腾出名额。
        </p>
      </div>

      {/* Device list */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-content-tertiary">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : devices.length === 0 ? (
        <div className="card py-12 text-center text-sm text-content-tertiary">
          当前没有已登录的设备
        </div>
      ) : (
        <div className="space-y-3">
          {devices.map((d) => {
            const isMobile = /iPhone|iPad|Android/i.test(d.name)
            const Icon = isMobile ? Smartphone : Monitor
            return (
              <div
                key={d.id}
                className="flex items-center gap-3 p-4 rounded-2xl bg-surface dark:bg-surface-dark border border-gray-100/80 dark:border-white/[0.06]"
              >
                <span className="w-10 h-10 rounded-full flex items-center justify-center bg-primary/10 text-primary flex-shrink-0">
                  <Icon className="w-5 h-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-content dark:text-gray-100 truncate">{d.name}</span>
                    {d.isCurrent && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                        本机
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-content-tertiary dark:text-gray-500 mt-0.5">
                    上次活跃：{timeAgo(d.lastActiveAt)}
                    {d.ip ? ` · ${d.ip}` : ''}
                  </p>
                </div>
                {d.isCurrent ? (
                  <span className="text-xs text-content-tertiary dark:text-gray-500 px-3">当前设备</span>
                ) : (
                  <button
                    onClick={() => handleRemove(d.id)}
                    disabled={removingId === d.id}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors disabled:opacity-50 flex-shrink-0"
                  >
                    {removingId === d.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    退出此设备
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Hint */}
      {!loading && devices.length >= 2 && (
        <p className="text-xs text-content-tertiary dark:text-gray-500 mt-4 leading-relaxed">
          已达设备上限。如需在新设备登录，请先在上方「退出此设备」释放名额。
        </p>
      )}
    </div>
  )
}
