const { Router } = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const pool = require('../db')
const config = require('../config')
const authMiddleware = require('../middleware/auth')
const { sendEmail, codeEmailHtml } = require('../services/email')
const { generateCode, saveCode, verifyCode, clearCode } = require('../services/codeManager')

const router = Router()

const COOKIE_OPTS = {
  httpOnly: true,
  secure: config.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 3600 * 1000,
}

function signToken(userId) {
  return jwt.sign({ userId }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN })
}

// ---------- POST /api/auth/send-code ----------
router.post('/send-code', async (req, res, next) => {
  try {
    const { email, type } = req.body
    if (!email || !type) {
      return res.status(400).json({ error: '参数缺失' })
    }
    if (!/^[\w.-]+@[\w.-]+\.\w+$/.test(email)) {
      return res.status(400).json({ error: '邮箱格式不正确' })
    }

    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email])

    if (type === 'register') {
      if (existing.length > 0) {
        return res.status(409).json({ error: '该邮箱已注册' })
      }
      // Create placeholder row so we can store the code
      await pool.execute(
        'INSERT IGNORE INTO users (email, password_hash, nickname) VALUES (?, "", "学习者")',
        [email]
      )
    }

    if (type === 'reset') {
      if (existing.length === 0) {
        return res.status(404).json({ error: '该邮箱未注册' })
      }
    }

    // Rate limit: check last code sent time (stored in code_expires_at minus 10min)
    const [rows] = await pool.execute(
      'SELECT code_expires_at FROM users WHERE email = ?',
      [email]
    )
    if (rows.length > 0 && rows[0].code_expires_at) {
      const sentAt = new Date(rows[0].code_expires_at).getTime() - 10 * 60 * 1000
      if (Date.now() - sentAt < 60 * 1000) {
        return res.status(429).json({ error: '发送太频繁，请 1 分钟后再试' })
      }
    }

    const code = generateCode()
    await saveCode(email, code)

    await sendEmail({
      to: email,
      subject: type === 'register' ? 'LingoForge 注册验证码' : 'LingoForge 密码重置验证码',
      html: codeEmailHtml(code, type),
    })

    res.json({ success: true, message: '验证码已发送' })
  } catch (err) {
    next(err)
  }
})

// ---------- POST /api/auth/register ----------
router.post('/register', async (req, res, next) => {
  try {
    const { email, code, password, nickname } = req.body
    if (!email || !code || !password) {
      return res.status(400).json({ error: '邮箱、验证码和密码不能为空' })
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少 6 位' })
    }

    const valid = await verifyCode(email, code)
    if (!valid) {
      return res.status(400).json({ error: '验证码错误或已过期' })
    }

    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE email = ? AND password_hash != ""',
      [email]
    )
    if (existing.length > 0) {
      return res.status(409).json({ error: '该邮箱已注册' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const name = nickname || email.split('@')[0]

    // Update the placeholder row
    const [result] = await pool.execute(
      `UPDATE users SET password_hash = ?, nickname = ?, email_verified = 1,
       verify_code = NULL, code_expires_at = NULL WHERE email = ?`,
      [passwordHash, name, email]
    )

    const [userRows] = await pool.execute('SELECT id FROM users WHERE email = ?', [email])
    const userId = userRows[0].id

    // Default style
    await pool.execute(
      'INSERT IGNORE INTO user_style_settings (user_id, style_key) VALUES (?, ?)',
      [userId, 'teacher']
    )

    const token = signToken(userId)
    res.cookie('token', token, COOKIE_OPTS)
    res.status(201).json({
      user: { id: userId, nickname: name, email },
    })
  } catch (err) {
    next(err)
  }
})

// ---------- POST /api/auth/login ----------
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: '邮箱和密码不能为空' })
    }

    const [rows] = await pool.execute(
      'SELECT id, nickname, email, password_hash, avatar_url FROM users WHERE email = ?',
      [email]
    )
    if (rows.length === 0 || !rows[0].password_hash) {
      return res.status(401).json({ error: '邮箱或密码错误' })
    }

    const user = rows[0]
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      // Log failed attempt
      try {
        await pool.execute(
          'INSERT INTO login_logs (user_id, ip, ua, success) VALUES (?, ?, ?, 0)',
          [user.id, req.ip || null, req.headers['user-agent'] || null]
        )
      } catch (_) {}
      return res.status(401).json({ error: '邮箱或密码错误' })
    }

    // Log success
    try {
      await pool.execute(
        'INSERT INTO login_logs (user_id, ip, ua, success) VALUES (?, ?, ?, 1)',
        [user.id, req.ip || null, req.headers['user-agent'] || null]
      )
    } catch (_) {}

    const token = signToken(user.id)
    res.cookie('token', token, COOKIE_OPTS)
    res.json({
      user: { id: user.id, nickname: user.nickname, email: user.email, avatar: user.avatar_url },
    })
  } catch (err) {
    next(err)
  }
})

// ---------- POST /api/auth/reset-password ----------
router.post('/reset-password', async (req, res, next) => {
  try {
    const { email, code, password } = req.body
    if (!email || !code || !password) {
      return res.status(400).json({ error: '参数缺失' })
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少 6 位' })
    }

    const valid = await verifyCode(email, code)
    if (!valid) {
      return res.status(400).json({ error: '验证码错误或已过期' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    await pool.execute(
      'UPDATE users SET password_hash = ?, verify_code = NULL, code_expires_at = NULL WHERE email = ?',
      [passwordHash, email]
    )

    res.json({ success: true, message: '密码重置成功' })
  } catch (err) {
    next(err)
  }
})

// ---------- GET /api/auth/me ----------
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, nickname, email, avatar_url, daily_goal_minutes, signature FROM users WHERE id = ?',
      [req.userId]
    )
    if (rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' })
    }
    const r = rows[0]
    res.json({ id: r.id, nickname: r.nickname, email: r.email, avatar: r.avatar_url, dailyGoalMinutes: r.daily_goal_minutes, signature: r.signature || '' })
  } catch (err) {
    next(err)
  }
})

// ---------- PATCH /api/auth/profile ----------
router.patch('/profile', authMiddleware, async (req, res, next) => {
  try {
    const { nickname, signature, avatar, dailyGoalMinutes } = req.body
    const setClauses = []
    const values = []

    if (nickname !== undefined) {
      const trimmed = String(nickname).trim()
      if (trimmed) { setClauses.push('nickname = ?'); values.push(trimmed) }
    }
    if (signature !== undefined) { setClauses.push('signature = ?'); values.push(String(signature)) }
    if (avatar !== undefined) { setClauses.push('avatar_url = ?'); values.push(avatar) }
    if (dailyGoalMinutes !== undefined) {
      const n = Math.max(5, Math.min(300, Math.round(dailyGoalMinutes)))
      setClauses.push('daily_goal_minutes = ?'); values.push(n)
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: '没有有效的更新字段' })
    }

    values.push(req.userId)
    await pool.execute(
      `UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`,
      values
    )

    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// ---------- POST /api/auth/reset-learning ----------
router.post('/reset-learning', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId
    await Promise.all([
      pool.execute('DELETE FROM word_progress WHERE user_id = ?', [userId]),
      pool.execute('DELETE FROM user_word_books WHERE user_id = ?', [userId]),
      pool.execute('DELETE FROM user_favorite_dicts WHERE user_id = ?', [userId]),
      pool.execute('DELETE FROM chat_messages WHERE user_id = ?', [userId]),
      pool.execute('DELETE FROM conversation_memory WHERE user_id = ?', [userId]),
    ])
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// ---------- POST /api/auth/logout ----------
router.post('/logout', (req, res) => {
  res.clearCookie('token', { httpOnly: true, sameSite: 'lax' })
  res.json({ success: true })
})

module.exports = router
