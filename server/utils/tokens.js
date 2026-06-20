// 共享的认证工具：cookie/token 签发、设备解析、输入校验。
// auth.js 与 demo.js 共用，消除重复手抄并保证体验码路径也写入设备信息。
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const config = require('../config')
const pool = require('../db')

const ACCESS_COOKIE = 'lf_access_token'
const REFRESH_COOKIE = 'lf_refresh_token'

// 将过期时间字符串（'30m'/'2h'/'3d' 或纯数字秒）解析为毫秒，与 jsonwebtoken expiresIn 语义一致
function parseDuration(str, fallbackMs = 3 * 24 * 60 * 60 * 1000) {
  if (str == null) return fallbackMs
  if (typeof str === 'number') return str * 1000
  const s = String(str).trim()
  if (/^\d+$/.test(s)) return parseInt(s, 10) * 1000
  const m = s.match(/^(\d+)\s*(d|h|m|s)$/i)
  if (!m) return fallbackMs
  const n = parseInt(m[1], 10)
  const mult = { d: 86400, h: 3600, m: 60, s: 1 }[m[2].toLowerCase()]
  return n * mult * 1000
}

const ACCESS_MAX_AGE = parseDuration(config.JWT_ACCESS_EXPIRES)
const REFRESH_MAX_AGE = parseDuration(config.JWT_REFRESH_EXPIRES)

function cookieOptions(path, maxAge) {
  return {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax',
    path,
    maxAge,
  }
}

// access cookie 寿命对齐 refresh（7d）而非 access token（30m）：保证 access token 总是先于 cookie 过期，
// 从而命中 401/TOKEN_EXPIRED 自动刷新链路；避免 cookie 被浏览器先删除（边界时序）导致活跃用户被误登出
const ACCESS_COOKIE_OPTS = cookieOptions('/api', REFRESH_MAX_AGE)
const REFRESH_COOKIE_OPTS = cookieOptions('/api/auth/refresh', REFRESH_MAX_AGE)

function signAccessToken(userId, isGuest = false, trialExp = null) {
  const payload = { userId }
  if (isGuest) {
    payload.isGuest = true
    // 内嵌试用截止时间（ISO）：中间件据此免查库判定试用是否到期，仅老 token 或格式异常时才回查 DB
    if (trialExp) payload.trialExp = trialExp
  }
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: config.JWT_ACCESS_EXPIRES })
}

function signRefreshToken() {
  return crypto.randomBytes(48).toString('hex')
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

// 签发 access + refresh，写入 refresh_tokens（含设备信息用于设备管理/名额统计），并下发 cookie
async function issueTokens(res, userId, isGuest = false, device = {}, trialExp = null) {
  const accessToken = signAccessToken(userId, isGuest, trialExp)
  const refreshToken = signRefreshToken()
  const tokenHash = hashToken(refreshToken)
  const expiresAt = new Date(Date.now() + REFRESH_MAX_AGE)

  await pool.execute(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, device_id, device_name, ip, last_active_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [
      userId,
      tokenHash,
      expiresAt,
      device.deviceId || '',
      device.deviceName || null,
      device.ip || null,
    ]
  )

  res.cookie(ACCESS_COOKIE, accessToken, ACCESS_COOKIE_OPTS)
  res.cookie(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTS)
}

function clearCookies(res) {
  const clearOpts = {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax',
  }
  res.clearCookie(ACCESS_COOKIE, { ...clearOpts, path: '/api' })
  res.clearCookie(REFRESH_COOKIE, { ...clearOpts, path: '/api/auth/refresh' })
}

function getClientIp(req) {
  return req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '127.0.0.1'
}

// 解析 User-Agent 为可读设备名，如 "Chrome · Windows" / "Safari · iPhone"
function parseDeviceName(ua) {
  if (!ua) return '未知设备'
  const u = ua.toLowerCase()
  let browser = '浏览器'
  if (u.includes('micromessenger')) browser = '微信'
  else if (u.includes('edg/')) browser = 'Edge'
  else if (u.includes('chrome/') && !u.includes('chromium')) browser = 'Chrome'
  else if (u.includes('firefox/')) browser = 'Firefox'
  else if (u.includes('safari/') && !u.includes('chrome')) browser = 'Safari'

  let os = '设备'
  if (u.includes('iphone')) os = 'iPhone'
  else if (u.includes('ipad')) os = 'iPad'
  else if (u.includes('android')) os = 'Android'
  else if (u.includes('windows')) os = 'Windows'
  else if (u.includes('mac os') || u.includes('macintosh')) os = 'Mac'
  else if (u.includes('linux')) os = 'Linux'

  return `${browser} · ${os}`
}

// 从请求体取客户端设备标识；缺失时退化为服务端随机值，保证名额判定仍生效
function resolveDeviceId(req) {
  const fromBody = req.body && typeof req.body.deviceId === 'string' ? req.body.deviceId.trim() : ''
  return fromBody || crypto.randomUUID()
}

function validateUsername(v) {
  if (typeof v !== 'string') return false
  return /^[a-zA-Z0-9_一-鿿]{3,30}$/.test(v)
}

function validatePassword(v) {
  if (typeof v !== 'string' || v.length < 8 || v.length > 128) return false
  return /[a-zA-Z]/.test(v) && /\d/.test(v)
}

module.exports = {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  parseDuration,
  ACCESS_MAX_AGE,
  REFRESH_MAX_AGE,
  signAccessToken,
  signRefreshToken,
  hashToken,
  issueTokens,
  clearCookies,
  getClientIp,
  parseDeviceName,
  resolveDeviceId,
  validateUsername,
  validatePassword,
}
