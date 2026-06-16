const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const pool = require('../db')
const config = require('../config')
const authMiddleware = require('../middleware/auth')
const { checkLoginRateLimit, checkRegisterRateLimit, logAttempt } = require('../middleware/rateLimit')

const router = express.Router()

const ACCESS_COOKIE = 'lf_access_token'
const REFRESH_COOKIE = 'lf_refresh_token'

function cookieOptions(path, maxAge) {
  return {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax',
    path,
    maxAge,
  }
}

const ACCESS_COOKIE_OPTS = cookieOptions('/api', 3 * 24 * 60 * 60 * 1000)
const REFRESH_COOKIE_OPTS = cookieOptions('/api/auth/refresh', 7 * 24 * 60 * 60 * 1000)

function signAccessToken(userId, isGuest = false) {
  const payload = { userId }
  if (isGuest) payload.isGuest = true
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: config.JWT_ACCESS_EXPIRES })
}

function signRefreshToken() {
  return crypto.randomBytes(48).toString('hex')
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
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

async function issueTokens(res, userId, isGuest = false, device = {}) {
  const accessToken = signAccessToken(userId, isGuest)
  const refreshToken = signRefreshToken()
  const tokenHash = hashToken(refreshToken)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  await pool.execute(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, device_id, device_name, ip, last_active_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [userId, tokenHash, expiresAt, device.deviceId || '', device.deviceName || null, device.ip || null]
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

// --- Validate activation code ---
router.post('/validate-activation-code', async (req, res, next) => {
  try {
    const { code } = req.body
    if (!code || typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({ valid: false, message: '请输入激活码' })
    }

    const [codes] = await pool.execute(
      `SELECT id, code, max_uses, current_uses, is_active, expires_at
       FROM experience_codes WHERE code = ? AND type = 'activation'`,
      [code.trim()]
    )
    if (codes.length === 0) {
      return res.json({ valid: false, message: '激活码无效' })
    }
    const actCode = codes[0]
    if (!actCode.is_active) {
      return res.json({ valid: false, message: '激活码已失效' })
    }
    if (actCode.expires_at && new Date(actCode.expires_at) < new Date()) {
      return res.json({ valid: false, message: '激活码已过期' })
    }
    if (actCode.max_uses > 0 && actCode.current_uses >= actCode.max_uses) {
      return res.json({ valid: false, message: '激活码已达使用上限' })
    }

    res.json({ valid: true })
  } catch (err) {
    next(err)
  }
})

// --- Register ---
router.post('/register', async (req, res, next) => {
  try {
    const { username, password, nickname, activationCode } = req.body
    const ip = getClientIp(req)

    if (!activationCode || typeof activationCode !== 'string' || !activationCode.trim()) {
      return res.status(400).json({ error: '请输入激活码' })
    }
    if (!validateUsername(username)) {
      return res.status(400).json({ error: '用户名需 3-30 位，支持字母、数字、下划线、中文' })
    }
    if (!validatePassword(password)) {
      return res.status(400).json({ error: '密码需 8-128 位，至少包含一个字母和一个数字' })
    }

    // 验证激活码
    const [codes] = await pool.execute(
      `SELECT id, code, max_uses, current_uses, is_active, expires_at
       FROM experience_codes WHERE code = ? AND type = 'activation'`,
      [activationCode.trim()]
    )
    if (codes.length === 0) {
      return res.status(400).json({ error: '激活码无效' })
    }
    const actCode = codes[0]
    if (!actCode.is_active) {
      return res.status(400).json({ error: '激活码已失效' })
    }
    if (actCode.expires_at && new Date(actCode.expires_at) < new Date()) {
      return res.status(400).json({ error: '激活码已过期' })
    }
    if (actCode.max_uses > 0 && actCode.current_uses >= actCode.max_uses) {
      return res.status(400).json({ error: '激活码已达使用上限' })
    }

    await checkRegisterRateLimit(ip)

    const [existing] = await pool.execute('SELECT id FROM users WHERE username = ?', [username])
    if (existing.length > 0) {
      return res.status(400).json({ error: '注册失败，请稍后重试' })
    }

    const hash = await bcrypt.hash(password, config.BCRYPT_ROUNDS)
    const displayName = (typeof nickname === 'string' && nickname.trim()) ? nickname.trim().slice(0, 50) : username

    const [result] = await pool.execute(
      'INSERT INTO users (username, nickname, password_hash, email) VALUES (?, ?, ?, NULL)',
      [username, displayName, hash]
    )
    const userId = result.insertId

    // 原子消费激活码（防竞态）
    const [updateResult] = await pool.execute(
      'UPDATE experience_codes SET current_uses = current_uses + 1 WHERE id = ? AND (max_uses = 0 OR current_uses < max_uses)',
      [actCode.id]
    )
    if (updateResult.affectedRows === 0) {
      // 码在并发下被耗尽，回滚删除刚创建的用户
      await pool.execute('DELETE FROM users WHERE id = ?', [userId])
      return res.status(400).json({ error: '激活码已达使用上限' })
    }

    // 记录激活码来源
    await pool.execute(
      'UPDATE users SET activation_code_id = ? WHERE id = ?',
      [actCode.id, userId]
    )

    await issueTokens(res, userId, false, {
      deviceId: resolveDeviceId(req),
      deviceName: parseDeviceName(req.headers['user-agent']),
      ip,
    })
    await logAttempt(`register:${ip}`, ip, true)

    res.json({
      user: { id: userId, username, nickname: displayName },
    })
  } catch (err) {
    next(err)
  }
})

// --- Login ---
const DUMMY_HASH = '$2a$12$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body
    const ip = getClientIp(req)

    if (!username || !password) {
      return res.status(400).json({ error: '请输入用户名和密码' })
    }

    await checkLoginRateLimit(username, ip)

    const [rows] = await pool.execute(
      'SELECT id, username, nickname, password_hash FROM users WHERE username = ?',
      [username]
    )

    const user = rows[0]
    const hashToCompare = user ? user.password_hash : DUMMY_HASH
    const match = await bcrypt.compare(password, hashToCompare)

    if (!user || !match) {
      await logAttempt(username, ip, false)
      return res.status(401).json({ error: '用户名或密码错误' })
    }

    await logAttempt(username, ip, true)

    // 设备级会话名额：统计本设备以外的活跃设备，达上限则拒绝第 N+1 台登录
    const deviceId = resolveDeviceId(req)
    const device = { deviceId, deviceName: parseDeviceName(req.headers['user-agent']), ip }

    const [[{ cnt }]] = await pool.execute(
      `SELECT COUNT(*) AS cnt FROM refresh_tokens
       WHERE user_id = ? AND device_id <> '' AND device_id <> ? AND expires_at > NOW()`,
      [user.id, deviceId]
    )
    if (cnt >= config.MAX_DEVICES_PER_USER) {
      return res.status(403).json({
        error: `该账号已在 ${config.MAX_DEVICES_PER_USER} 台设备登录，请到已登录设备的「设置-登录设备管理」中退出一台后再试`,
        code: 'DEVICE_LIMIT_REACHED',
      })
    }

    // 替换本设备旧行：同一设备重复登录不占新名额
    await pool.execute('DELETE FROM refresh_tokens WHERE user_id = ? AND device_id = ?', [user.id, deviceId])

    await issueTokens(res, user.id, false, device)

    res.json({
      user: { id: user.id, username: user.username, nickname: user.nickname },
    })
  } catch (err) {
    next(err)
  }
})

// --- Refresh ---
router.post('/refresh', async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE]
    if (!refreshToken) {
      return res.status(401).json({ error: '请先登录' })
    }

    const tokenHash = hashToken(refreshToken)

    const [rows] = await pool.execute(
      'SELECT id, user_id, device_id, device_name, ip FROM refresh_tokens WHERE token_hash = ? AND expires_at > NOW()',
      [tokenHash]
    )

    if (rows.length === 0) {
      clearCookies(res)
      return res.status(401).json({ error: '请先登录' })
    }

    const stored = rows[0]

    // rotation: delete used token
    await pool.execute('DELETE FROM refresh_tokens WHERE id = ?', [stored.id])

    const [userRows] = await pool.execute(
      'SELECT id, username, nickname, is_guest FROM users WHERE id = ?',
      [stored.user_id]
    )

    if (userRows.length === 0) {
      clearCookies(res)
      return res.status(401).json({ error: '请先登录' })
    }

    const isGuest = !!userRows[0].is_guest
    // rotation 时沿用原会话的设备标识/IP，刷新 last_active_at
    await issueTokens(res, stored.user_id, isGuest, {
      deviceId: stored.device_id,
      deviceName: stored.device_name,
      ip: stored.ip,
    })

    const userObj = { id: userRows[0].id, username: userRows[0].username, nickname: userRows[0].nickname }
    if (isGuest) {
      userObj.isTrial = true
      // 查询试用到期时间
      const [trialRows] = await pool.execute(
        'SELECT expires_at FROM trial_activations WHERE user_id = ?',
        [stored.user_id]
      )
      if (trialRows.length > 0 && trialRows[0].expires_at) {
        userObj.trialExpiresAt = new Date(trialRows[0].expires_at).toISOString()
      }
    }

    res.json({ user: userObj })
  } catch (err) {
    next(err)
  }
})

// --- Logout ---
router.post('/logout', async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE]
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken)
      await pool.execute('DELETE FROM refresh_tokens WHERE token_hash = ?', [tokenHash]).catch(() => {})
    }
    clearCookies(res)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// --- Me (requires auth) ---
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.username, u.nickname, u.avatar_url, u.daily_goal_minutes, u.signature, u.is_guest,
              t.expires_at AS trial_expires_at
       FROM users u
       LEFT JOIN trial_activations t ON t.user_id = u.id
       WHERE u.id = ?`,
      [req.userId]
    )
    if (rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' })
    }
    const u = rows[0]
    const userObj = {
      id: u.id,
      username: u.username,
      nickname: u.nickname,
      avatar: u.avatar_url,
      dailyGoalMinutes: u.daily_goal_minutes,
      signature: u.signature,
    }
    if (u.is_guest) {
      userObj.isTrial = true
      userObj.trialExpiresAt = u.trial_expires_at ? new Date(u.trial_expires_at).toISOString() : null
    }
    res.json({ user: userObj })
  } catch (err) {
    next(err)
  }
})

// --- Update profile (requires auth) ---
router.patch('/profile', authMiddleware, async (req, res, next) => {
  try {
    const { nickname, signature, dailyGoalMinutes } = req.body
    const sets = []
    const values = []

    if (nickname !== undefined) {
      const trimmed = String(nickname).trim()
      if (trimmed.length < 1 || trimmed.length > 50) {
        return res.status(400).json({ error: '昵称需 1-50 个字符' })
      }
      sets.push('nickname = ?')
      values.push(trimmed)
    }
    if (signature !== undefined) {
      const sig = String(signature)
      if (sig.length > 200) {
        return res.status(400).json({ error: '签名不能超过 200 个字符' })
      }
      sets.push('signature = ?')
      values.push(sig)
    }
    if (dailyGoalMinutes !== undefined) {
      const n = Number(dailyGoalMinutes)
      if (!Number.isInteger(n) || n < 5 || n > 300) {
        return res.status(400).json({ error: '每日目标需在 5-300 分钟之间' })
      }
      sets.push('daily_goal_minutes = ?')
      values.push(n)
    }

    if (sets.length === 0) {
      return res.status(400).json({ error: '没有需要更新的字段' })
    }

    values.push(req.userId)
    await pool.execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, values)

    const [rows] = await pool.execute(
      'SELECT id, username, nickname, avatar_url, daily_goal_minutes, signature FROM users WHERE id = ?',
      [req.userId]
    )
    const u = rows[0]
    res.json({
      user: {
        id: u.id,
        username: u.username,
        nickname: u.nickname,
        avatar: u.avatar_url,
        dailyGoalMinutes: u.daily_goal_minutes,
        signature: u.signature,
      },
    })
  } catch (err) {
    next(err)
  }
})

// --- Change password (requires auth) ---
router.post('/change-password', authMiddleware, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: '请输入当前密码和新密码' })
    }
    if (!validatePassword(newPassword)) {
      return res.status(400).json({ error: '新密码需 8-128 位，至少包含一个字母和一个数字' })
    }

    const [rows] = await pool.execute(
      'SELECT password_hash FROM users WHERE id = ?',
      [req.userId]
    )
    if (rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' })
    }

    const match = await bcrypt.compare(currentPassword, rows[0].password_hash)
    if (!match) {
      return res.status(400).json({ error: '当前密码错误' })
    }

    const hash = await bcrypt.hash(newPassword, config.BCRYPT_ROUNDS)
    await pool.execute(
      'UPDATE users SET password_hash = ?, password_changed_at = NOW() WHERE id = ?',
      [hash, req.userId]
    )

    // force re-login on all devices
    await pool.execute('DELETE FROM refresh_tokens WHERE user_id = ?', [req.userId])

    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// --- 找回密码：凭注册链接查找关联账号（只读，不修改）---
router.post('/recover-lookup', async (req, res, next) => {
  try {
    const { code } = req.body
    const ip = getClientIp(req)

    if (!code || typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({ error: '请输入激活码' })
    }

    const codeKey = 'recover:' + code.trim()
    await checkLoginRateLimit(codeKey, ip)

    // 通过 activation_code_id 反查注册账号；不校验 is_active/expires_at/uses，
    // 这些只管"新注册"，已注册账号的找回权利不随码失效而消失
    const [rows] = await pool.execute(
      `SELECT u.id, u.username FROM users u
       JOIN experience_codes ec ON u.activation_code_id = ec.id
       WHERE ec.code = ? AND ec.type = 'activation'`,
      [code.trim()]
    )

    if (rows.length === 0) {
      await logAttempt(codeKey, ip, false)
      return res.status(404).json({ error: '未找到关联账号' })
    }
    if (rows.length > 1) {
      // 一码一账号不变量下不应发生；防御性返回
      return res.status(409).json({ error: '该链接关联多个账号，请联系客服' })
    }

    await logAttempt(codeKey, ip, true)
    res.json({ found: true, username: rows[0].username })
  } catch (err) {
    next(err)
  }
})

// --- 找回密码：重置用户名与密码，并自动登录 ---
router.post('/recover-reset', async (req, res, next) => {
  try {
    const { code, username, password } = req.body
    const ip = getClientIp(req)

    if (!code || typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({ error: '请输入激活码' })
    }
    if (!validateUsername(username)) {
      return res.status(400).json({ error: '用户名需 3-30 位，支持字母、数字、下划线、中文' })
    }
    if (!validatePassword(password)) {
      return res.status(400).json({ error: '密码需 8-128 位，至少包含一个字母和一个数字' })
    }

    await checkRegisterRateLimit(ip)

    const [rows] = await pool.execute(
      `SELECT u.id, u.username FROM users u
       JOIN experience_codes ec ON u.activation_code_id = ec.id
       WHERE ec.code = ? AND ec.type = 'activation'`,
      [code.trim()]
    )
    if (rows.length === 0) {
      return res.status(404).json({ error: '未找到关联账号' })
    }
    if (rows.length > 1) {
      return res.status(409).json({ error: '该链接关联多个账号，请联系客服' })
    }
    const userId = rows[0].id

    // 唯一性预检（排除自身）
    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE username = ? AND id != ?',
      [username, userId]
    )
    if (existing.length > 0) {
      return res.status(409).json({ error: '用户名已被占用' })
    }

    const hash = await bcrypt.hash(password, config.BCRYPT_ROUNDS)

    try {
      await pool.execute(
        'UPDATE users SET username = ?, password_hash = ?, password_changed_at = NOW() WHERE id = ?',
        [username, hash, userId]
      )
    } catch (err) {
      // 唯一索引兜底，防 TOCTOU
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: '用户名已被占用' })
      }
      throw err
    }

    // 踢掉其他设备的登录态
    await pool.execute('DELETE FROM refresh_tokens WHERE user_id = ?', [userId])

    await issueTokens(res, userId, false, {
      deviceId: resolveDeviceId(req),
      deviceName: parseDeviceName(req.headers['user-agent']),
      ip,
    })
    await logAttempt('recover:' + ip, ip, true)

    const [updated] = await pool.execute(
      'SELECT id, username, nickname FROM users WHERE id = ?',
      [userId]
    )
    res.json({ user: updated[0] })
  } catch (err) {
    next(err)
  }
})

// --- 设备管理：列出当前账号的登录设备（requires auth）---
router.get('/devices', authMiddleware, async (req, res, next) => {
  try {
    const deviceId = typeof req.query.deviceId === 'string' ? req.query.deviceId.trim() : ''
    const [rows] = await pool.execute(
      `SELECT id, device_name, ip, last_active_at,
              (device_id = ?) AS is_current
       FROM refresh_tokens
       WHERE user_id = ? AND device_id <> '' AND expires_at > NOW()
       ORDER BY last_active_at DESC`,
      [deviceId, req.userId]
    )
    res.json({
      devices: rows.map((r) => ({
        id: r.id,
        name: r.device_name || '未知设备',
        ip: r.ip,
        lastActiveAt: r.last_active_at ? new Date(r.last_active_at).toISOString() : null,
        isCurrent: !!r.is_current,
      })),
    })
  } catch (err) {
    next(err)
  }
})

// --- 设备管理：退出指定设备（requires auth）---
// 删除该设备的刷新令牌行，名额立即释放；被踢设备的访问令牌最长 3 天后随过期失效
router.delete('/devices/:id', authMiddleware, async (req, res, next) => {
  try {
    const sessionId = Number(req.params.id)
    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      return res.status(400).json({ error: '无效的设备会话' })
    }
    const [result] = await pool.execute(
      'DELETE FROM refresh_tokens WHERE id = ? AND user_id = ?',
      [sessionId, req.userId]
    )
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '设备会话不存在或已退出' })
    }
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

module.exports = router
