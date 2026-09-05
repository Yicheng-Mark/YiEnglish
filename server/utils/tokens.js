// 共享的认证工具：cookie/token 签发、设备解析、输入校验。
// auth.js 与 demo.js 共用，消除重复手抄并保证体验码路径也写入设备信息。
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const config = require('../config')
const pool = require('../db')

const ACCESS_COOKIE = 'lf_access_token'
const REFRESH_COOKIE = 'lf_refresh_token'
// 服务端签发的设备标识 cookie：体验码去重以此为首选来源。
// HttpOnly 使客户端 JS 无法读取/伪造，清 localStorage 不影响此 cookie，
// 从而防止用户清 localStorage 换新 device_id 重复领取试用。
const DEVICE_COOKIE = 'lf_device_id'
const DEVICE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60 * 1000 // 1 年

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
// refresh cookie 既要发给 /refresh，也要发给 /logout，后者才能删除服务端 token 行。
// 旧 path 仅覆盖 /refresh，真实浏览器登出时不会携带 cookie，设备名额会一直被占用。
const REFRESH_COOKIE_OPTS = cookieOptions('/api/auth', REFRESH_MAX_AGE)
const LEGACY_REFRESH_COOKIE_PATH = '/api/auth/refresh'

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
  // 清理旧版本更窄 path 的同名 cookie，避免浏览器在 /refresh 同时发送两个值。
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax',
    path: LEGACY_REFRESH_COOKIE_PATH,
  })
  res.cookie(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTS)
}

function clearCookies(res) {
  const clearOpts = {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax',
  }
  res.clearCookie(ACCESS_COOKIE, { ...clearOpts, path: '/api' })
  res.clearCookie(REFRESH_COOKIE, { ...clearOpts, path: '/api/auth' })
  res.clearCookie(REFRESH_COOKIE, { ...clearOpts, path: LEGACY_REFRESH_COOKIE_PATH })
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

// deviceId 合法性：DB 列 device_id 为 VARCHAR(64)，超长/空值会触发 500 或污染去重统计。
function isValidDeviceId(v) {
  return typeof v === 'string' && v.length > 0 && v.length <= 64
}

// 解析设备标识：只信任服务端签发的 HttpOnly cookie，缺失或不合法时现场随机生成。
// 不再回退 req.body.deviceId——客户端可任意伪造新值，绕过"每设备一次试用"的去重
// （demo/redeem 按 device_id 全局去重）。cookie 由服务端签发（HttpOnly），
// 清 localStorage 不会改变它；超长（>64）/空白等被篡改的 cookie 值同样不采信。
function resolveDeviceId(req) {
  const fromCookie =
    req.cookies && typeof req.cookies[DEVICE_COOKIE] === 'string'
      ? req.cookies[DEVICE_COOKIE].trim()
      : ''
  if (isValidDeviceId(fromCookie)) return fromCookie
  return crypto.randomUUID()
}

// 确保响应带有 deviceId cookie：缺失或不合法则签发随机串并 Set-Cookie（HttpOnly, path=/, 1 年, sameSite=lax）。
// 返回最终生效的 deviceId（供调用方写入 refresh_tokens / trial_activations，保持一致性）。
function ensureDeviceCookie(req, res, deviceId) {
  const existing =
    req.cookies && typeof req.cookies[DEVICE_COOKIE] === 'string'
      ? req.cookies[DEVICE_COOKIE].trim()
      : ''
  if (isValidDeviceId(existing)) return existing
  res.cookie(DEVICE_COOKIE, deviceId, {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: DEVICE_COOKIE_MAX_AGE,
  })
  return deviceId
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
  DEVICE_COOKIE,
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
  ensureDeviceCookie,
  validateUsername,
  validatePassword,
}
