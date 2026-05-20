const pool = require('../db')

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

async function saveCode(email, code) {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
  await pool.execute(
    'UPDATE users SET verify_code = ?, code_expires_at = ? WHERE email = ?',
    [code, expiresAt, email]
  )
}

async function verifyCode(email, code) {
  const [rows] = await pool.execute(
    'SELECT verify_code, code_expires_at FROM users WHERE email = ?',
    [email]
  )
  if (rows.length === 0) return false
  const row = rows[0]
  if (!row.verify_code || !row.code_expires_at) return false
  if (row.verify_code !== code) return false
  if (new Date() > new Date(row.code_expires_at)) return false
  return true
}

async function clearCode(email) {
  await pool.execute(
    'UPDATE users SET verify_code = NULL, code_expires_at = NULL WHERE email = ?',
    [email]
  )
}

module.exports = { generateCode, saveCode, verifyCode, clearCode }
