const pool = require('../db')
const config = require('../config')

async function checkLoginRateLimit(username, ip) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS cnt FROM login_attempts
     WHERE identifier = ? AND success = 0 AND created_at > NOW() - INTERVAL 15 MINUTE`,
    [username]
  )
  if (rows[0].cnt >= config.LOGIN_RATE_LIMIT_MAX) {
    const err = new Error('登录尝试过于频繁，请稍后再试')
    err.status = 429
    throw err
  }

  const [ipRows] = await pool.execute(
    `SELECT COUNT(*) AS cnt FROM login_attempts
     WHERE ip_address = ? AND success = 0 AND created_at > NOW() - INTERVAL 15 MINUTE`,
    [ip]
  )
  if (ipRows[0].cnt >= config.LOGIN_RATE_LIMIT_MAX * 4) {
    const err = new Error('登录尝试过于频繁，请稍后再试')
    err.status = 429
    throw err
  }
}

async function checkRegisterRateLimit(ip) {
  const key = `register:${ip}`
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS cnt FROM login_attempts
     WHERE identifier = ? AND created_at > NOW() - INTERVAL 1 HOUR`,
    [key]
  )
  if (rows[0].cnt >= config.REGISTER_RATE_LIMIT_MAX) {
    const err = new Error('注册尝试过于频繁，请稍后再试')
    err.status = 429
    throw err
  }
}

async function logAttempt(identifier, ip, success) {
  try {
    await pool.execute(
      'INSERT INTO login_attempts (identifier, ip_address, success) VALUES (?, ?, ?)',
      [identifier, ip, success ? 1 : 0]
    )
  } catch {
    // log failures should not block the main flow
  }
}

async function cleanupStaleAttempts() {
  try {
    await pool.execute(
      'DELETE FROM login_attempts WHERE created_at < NOW() - INTERVAL 24 HOUR'
    )
  } catch {
    // ignore
  }
}

module.exports = { checkLoginRateLimit, checkRegisterRateLimit, logAttempt, cleanupStaleAttempts }
