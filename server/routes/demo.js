const express = require('express')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const pool = require('../db')
const config = require('../config')
const authMiddleware = require('../middleware/auth')
const { logAttempt } = require('../middleware/rateLimit')

const router = express.Router()

function validateUsername(v) {
  if (typeof v !== 'string') return false
  return /^[a-zA-Z0-9_一-鿿]{3,30}$/.test(v)
}

function validatePassword(v) {
  if (typeof v !== 'string' || v.length < 8 || v.length > 128) return false
  return /[a-zA-Z]/.test(v) && /\d/.test(v)
}

// --- 兑换体验码（无需认证） ---
router.post('/redeem', async (req, res, next) => {
  try {
    const { code, deviceId } = req.body
    const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '127.0.0.1'

    if (!code || typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({ error: '请输入体验码' })
    }

    if (!deviceId || typeof deviceId !== 'string' || !deviceId.trim()) {
      return res.status(400).json({ error: '设备识别失败，请刷新页面重试' })
    }

    // 简单限流：每个 IP 每分钟最多 5 次
    const [recent] = await pool.execute(
      `SELECT COUNT(*) AS cnt FROM login_attempts WHERE identifier = ? AND success = 0 AND created_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE)`,
      [`demo_redeem:${ip}`]
    )
    if (recent[0].cnt >= 5) {
      return res.status(429).json({ error: '请求过于频繁，请稍后再试' })
    }

    // 查找体验码
    const [codes] = await pool.execute(
      `SELECT id, code, max_uses, current_uses, trial_hours, is_active, expires_at
       FROM experience_codes WHERE code = ? AND type = 'trial'`,
      [code.trim()]
    )

    if (codes.length === 0) {
      await logAttempt(`demo_redeem:${ip}`, ip, false)
      return res.status(400).json({ error: '体验码无效' })
    }

    const expCode = codes[0]

    if (!expCode.is_active) {
      await logAttempt(`demo_redeem:${ip}`, ip, false)
      return res.status(400).json({ error: '体验码已失效' })
    }

    if (expCode.expires_at && new Date(expCode.expires_at) < new Date()) {
      await logAttempt(`demo_redeem:${ip}`, ip, false)
      return res.status(400).json({ error: '体验码已过期' })
    }

    if (expCode.max_uses > 0 && expCode.current_uses >= expCode.max_uses) {
      await logAttempt(`demo_redeem:${ip}`, ip, false)
      return res.status(400).json({ error: '体验码已达使用上限' })
    }

    // 每台设备只能体验一次：按 device_id 全局去重
    const [dupDevice] = await pool.execute(
      'SELECT 1 FROM trial_activations WHERE device_id = ?',
      [deviceId.trim()]
    )
    if (dupDevice.length > 0) {
      await logAttempt(`demo_redeem:${ip}`, ip, false)
      return res.status(400).json({ error: '该设备已体验过' })
    }

    // 生成随机访客用户名（碰撞检测）
    let username
    for (let i = 0; i < 10; i++) {
      const candidate = 'guest_' + crypto.randomBytes(4).toString('hex')
      const [existing] = await pool.execute('SELECT id FROM users WHERE username = ?', [candidate])
      if (existing.length === 0) {
        username = candidate
        break
      }
    }
    if (!username) {
      return res.status(500).json({ error: '系统繁忙，请稍后再试' })
    }

    // 随机密码（用户不会知道，无法通过正常登录进入）
    const randomPassword = crypto.randomBytes(32).toString('hex')
    const hash = await bcrypt.hash(randomPassword, config.BCRYPT_ROUNDS)

    // 创建访客用户
    const [result] = await pool.execute(
      'INSERT INTO users (username, is_guest, nickname, password_hash, email) VALUES (?, 1, ?, ?, NULL)',
      [username, '体验用户', hash]
    )
    const userId = result.insertId

    // 计算试用到期时间
    const trialExpiresAt = new Date(Date.now() + expCode.trial_hours * 60 * 60 * 1000)

    // 记录试用激活（含设备标识，用于"每台设备一次"去重）
    await pool.execute(
      'INSERT INTO trial_activations (user_id, code_id, device_id, expires_at) VALUES (?, ?, ?, ?)',
      [userId, expCode.id, deviceId.trim(), trialExpiresAt]
    )

    // 递增使用次数
    await pool.execute(
      'UPDATE experience_codes SET current_uses = current_uses + 1 WHERE id = ?',
      [expCode.id]
    )

    await logAttempt(`demo_redeem:${ip}`, ip, true)

    // 发 token（复用 auth.js 的逻辑）
    const jwt = require('jsonwebtoken')
    const accessToken = jwt.sign({ userId, isGuest: true }, config.JWT_SECRET, { expiresIn: config.JWT_ACCESS_EXPIRES })
    const refreshToken = crypto.randomBytes(48).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex')
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await pool.execute(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [userId, tokenHash, refreshExpiresAt]
    )

    const cookieOpts = {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax',
    }
    res.cookie('lf_access_token', accessToken, { ...cookieOpts, path: '/api', maxAge: 3 * 24 * 60 * 60 * 1000 })
    res.cookie('lf_refresh_token', refreshToken, { ...cookieOpts, path: '/api/auth/refresh', maxAge: 7 * 24 * 60 * 60 * 1000 })

    res.json({
      user: {
        id: userId,
        username,
        nickname: '体验用户',
        isTrial: true,
        trialExpiresAt: trialExpiresAt.toISOString(),
      },
    })
  } catch (err) {
    next(err)
  }
})

// --- 查询试用状态（需认证） ---
router.get('/status', authMiddleware, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT u.is_guest, t.expires_at
       FROM users u
       LEFT JOIN trial_activations t ON t.user_id = u.id
       WHERE u.id = ?`,
      [req.userId]
    )

    if (rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' })
    }

    const row = rows[0]
    if (!row.is_guest) {
      return res.json({ isTrial: false })
    }

    res.json({
      isTrial: true,
      trialExpiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    })
  } catch (err) {
    next(err)
  }
})

// --- 升级为正式账号（需认证） ---
router.post('/upgrade', authMiddleware, async (req, res, next) => {
  try {
    const { username, password, nickname } = req.body

    // 确认当前是访客用户
    const [users] = await pool.execute(
      'SELECT id, is_guest FROM users WHERE id = ?',
      [req.userId]
    )
    if (users.length === 0 || !users[0].is_guest) {
      return res.status(400).json({ error: '当前账号无需升级' })
    }

    if (!validateUsername(username)) {
      return res.status(400).json({ error: '用户名需 3-30 位，支持字母、数字、下划线、中文' })
    }
    if (!validatePassword(password)) {
      return res.status(400).json({ error: '密码需 8-128 位，至少包含一个字母和一个数字' })
    }

    // 检查用户名唯一性
    const [existing] = await pool.execute('SELECT id FROM users WHERE username = ? AND id != ?', [username, req.userId])
    if (existing.length > 0) {
      return res.status(400).json({ error: '用户名已被占用' })
    }

    const hash = await bcrypt.hash(password, config.BCRYPT_ROUNDS)
    const displayName = (typeof nickname === 'string' && nickname.trim()) ? nickname.trim().slice(0, 50) : username

    // 更新为正式用户
    await pool.execute(
      'UPDATE users SET username = ?, nickname = ?, password_hash = ?, is_guest = 0 WHERE id = ?',
      [username, displayName, hash, req.userId]
    )

    // 标记试用记录为已转换
    await pool.execute(
      'UPDATE trial_activations SET converted = 1, converted_at = NOW() WHERE user_id = ?',
      [req.userId]
    )

    // 重新签发 token（去掉 isGuest 标记）
    const jwt = require('jsonwebtoken')
    const accessToken = jwt.sign({ userId: req.userId }, config.JWT_SECRET, { expiresIn: config.JWT_ACCESS_EXPIRES })
    const refreshToken = crypto.randomBytes(48).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex')
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    // 清除旧 refresh token，写入新的
    await pool.execute('DELETE FROM refresh_tokens WHERE user_id = ?', [req.userId])
    await pool.execute(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [req.userId, tokenHash, refreshExpiresAt]
    )

    const cookieOpts = {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax',
    }
    res.cookie('lf_access_token', accessToken, { ...cookieOpts, path: '/api', maxAge: 3 * 24 * 60 * 60 * 1000 })
    res.cookie('lf_refresh_token', refreshToken, { ...cookieOpts, path: '/api/auth/refresh', maxAge: 7 * 24 * 60 * 60 * 1000 })

    res.json({
      user: {
        id: req.userId,
        username,
        nickname: displayName,
        isTrial: false,
      },
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
