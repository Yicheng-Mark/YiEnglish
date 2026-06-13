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

function validateUsername(v) {
  if (typeof v !== 'string') return false
  return /^[a-zA-Z0-9_一-鿿]{3,30}$/.test(v)
}

function validatePassword(v) {
  if (typeof v !== 'string' || v.length < 8 || v.length > 128) return false
  return /[a-zA-Z]/.test(v) && /\d/.test(v)
}

async function issueTokens(res, userId, isGuest = false) {
  const accessToken = signAccessToken(userId, isGuest)
  const refreshToken = signRefreshToken()
  const tokenHash = hashToken(refreshToken)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  await pool.execute(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [userId, tokenHash, expiresAt]
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

    await issueTokens(res, userId)
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

    // invalidate old refresh tokens
    await pool.execute('DELETE FROM refresh_tokens WHERE user_id = ?', [user.id])

    await issueTokens(res, user.id)

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
      'SELECT id, user_id FROM refresh_tokens WHERE token_hash = ? AND expires_at > NOW()',
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
    await issueTokens(res, stored.user_id, isGuest)

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

module.exports = router
