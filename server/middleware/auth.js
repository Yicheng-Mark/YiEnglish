const jwt = require('jsonwebtoken')
const config = require('../config')
const pool = require('../db')

async function authMiddleware(req, res, next) {
  const token = req.cookies?.lf_access_token
  if (!token) {
    return res.status(401).json({ error: '请先登录' })
  }
  let decoded
  try {
    decoded = jwt.verify(token, config.JWT_SECRET)
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '登录已过期，请重新登录', code: 'TOKEN_EXPIRED' })
    }
    return res.status(401).json({ error: '请先登录' })
  }

  req.userId = decoded.userId
  req.isGuest = decoded.isGuest || false

  // 体验用户：试用到期则拒绝（强制下线，服务端兜底）
  if (req.isGuest) {
    // 优先用 access token 内嵌的 trialExp 免查库（新 token）；
    // 老 token 无该字段或格式异常时回查 DB，保持向后兼容与权威性。
    // 权衡：trialExp 是签发时的快照，管理员中途缩短试用最多滞后一个 access 周期（refresh 时已查库校正）。
    const tokenExpMs = decoded.trialExp ? new Date(decoded.trialExp).getTime() : NaN
    if (!Number.isNaN(tokenExpMs)) {
      if (tokenExpMs <= Date.now()) {
        return res.status(401).json({ error: '体验时间已结束', code: 'TRIAL_EXPIRED' })
      }
      return next() // JWT 内 trialExp 有效且未过期 → 放行，省去每请求查库
    }
    // JWT 内无 trialExp 或格式异常 → 回查 DB
    try {
      const [rows] = await pool.execute(
        'SELECT expires_at FROM trial_activations WHERE user_id = ? LIMIT 1',
        [req.userId]
      )
      const expiresAt = rows[0]?.expires_at
      // 访客必有 trial_activations 记录；无记录或已到期 → 拒绝
      if (!expiresAt || new Date(expiresAt) <= new Date()) {
        return res.status(401).json({ error: '体验时间已结束', code: 'TRIAL_EXPIRED' })
      }
    } catch (err) {
      // DB 查询失败时放行（fail-open），避免临时故障误踢活跃体验用户
      console.error('[auth] trial expiry check failed:', err.message)
    }
  }

  next()
}

module.exports = authMiddleware
