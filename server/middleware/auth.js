const jwt = require('jsonwebtoken')
const config = require('../config')

function authMiddleware(req, res, next) {
  const token = req.cookies?.lf_access_token
  if (!token) {
    return res.status(401).json({ error: '请先登录' })
  }
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET)
    req.userId = decoded.userId
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '登录已过期，请重新登录', code: 'TOKEN_EXPIRED' })
    }
    return res.status(401).json({ error: '请先登录' })
  }
}

module.exports = authMiddleware
