// 持久设备标识：首次访问生成并写入 localStorage，用于"每台设备只能体验一次"去重。
// 注意：清缓存 / 无痕模式 / 换浏览器会丢失，是 localStorage 方案的已知上限。
const KEY = 'lf_device_id'

export function getDeviceId() {
  try {
    let id = localStorage.getItem(KEY)
    if (!id) {
      id =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `d_${Date.now()}_${Math.random().toString(36).slice(2)}`
      localStorage.setItem(KEY, id)
    }
    return id
  } catch {
    // localStorage 不可用（隐私模式等）——退化为随机值，不阻塞兑换
    return `d_${Date.now()}_${Math.random().toString(36).slice(2)}`
  }
}
