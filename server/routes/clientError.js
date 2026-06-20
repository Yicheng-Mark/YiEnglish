const { Router } = require('express')

const router = Router()

// 净化文本：去除换行/制表/控制字符（C0 + DEL）并截断，避免攻击者用控制字符伪造/污染 pm2 日志。
// 用 charCode 遍历而非正则，避免在源码里嵌入裸控制字符。
// keepNewline=true 时把 \r/\n 规范为 \n 保留（用于 stack 的可读性），否则换行也被丢弃。
function sanitizeControl(value, maxLen, keepNewline = false) {
  if (typeof value !== 'string') return ''
  let out = ''
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code === 13 || code === 10) {               // \r \n
      if (keepNewline) out += '\n'
      continue
    }
    if (code === 9 || code === 11 || code === 12) { // \t \v \f -> 空格
      out += ' '
      continue
    }
    if (code < 32 || code === 127) continue         // 其余 C0 控制符 + DEL 丢弃
    out += value[i]
  }
  return (keepNewline ? out : out.trim()).slice(0, maxLen)
}

const ALLOWED_TYPES = new Set(['error', 'unhandledrejection', 'api', 'unknown'])

// POST /api/client-error — 接收前端上报的运行时错误（公开接口，不鉴权）。
// 仅打日志、不写库（零迁移、零依赖），便于在 pm2 logs 里 grep 定位 Safari/iOS 等客户端问题。
router.post('/', (req, res) => {
  try {
    const raw = req.body || {}
    const type = ALLOWED_TYPES.has(raw.type) ? raw.type : 'unknown'
    const message = sanitizeControl(raw.message, 500, false)
    if (!message) {
      res.status(204).end()
      return
    }
    const href = sanitizeControl(raw.href, 300, false)
    const ua = sanitizeControl(raw.ua, 200, false)
    const stack = sanitizeControl(raw.stack, 1500, true)
    console.warn(
      `[client-error][${type}] ${message} | ${href} | ${ua}` +
        (stack ? `\n${stack}` : '')
    )
  } catch {
    // 永不返回 500，避免客户端上报链路影响业务
  }
  res.status(204).end()
})

module.exports = router
