const { Router } = require('express')

const router = Router()

// POST /api/client-error — 接收前端上报的运行时错误（公开接口，不鉴权）。
// 仅打日志、不写库（零迁移、零依赖），便于在 pm2 logs 里 grep 定位 Safari/iOS 等客户端问题。
router.post('/', (req, res) => {
  try {
    const { type, message, stack, href, ua } = req.body || {}
    if (message) {
      console.warn(
        `[client-error][${type || 'unknown'}] ${String(message).slice(0, 500)}` +
          ` | ${href || ''} | ${String(ua || '').slice(0, 200)}` +
          (stack ? `\n${String(stack).slice(0, 1500)}` : '')
      )
    }
  } catch (_) {
    // 永不返回 500，避免客户端上报链路影响业务
  }
  res.status(204).end()
})

module.exports = router
