// RFC 6238 TOTP（时间基一次性密码）：管理员两步验证。
// 零依赖——HMAC-SHA1 / AES-256-GCM 全部走 node:crypto。
// 密钥不出现在日志/响应明文里：入库前 AES-256-GCM 加密，key 由 JWT_SECRET 派生。
const crypto = require('crypto')
const config = require('../config')

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

// ---- base32（RFC 4648，无 padding）----

function base32Encode(buf) {
  let bits = 0
  let value = 0
  let output = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  return output
}

function base32Decode(str) {
  const clean = String(str || '')
    .toUpperCase()
    .replace(/=+$/, '')
    .replace(/\s+/g, '')
  if (!/^[A-Z2-7]+$/.test(clean)) return null
  let bits = 0
  let value = 0
  const bytes = []
  for (const ch of clean) {
    value = (value << 5) | BASE32_ALPHABET.indexOf(ch)
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

// ---- HOTP / TOTP ----

// RFC 4226 动态截断：31 位取值再模 10^digits
function hotp(secretBuf, counter, digits = 6) {
  const counterBuf = Buffer.alloc(8)
  // JS 安全整数到 2^53，计数器（Unix 秒/30）远小于 2^31，writeBigUInt64BE 稳妥
  counterBuf.writeBigUInt64BE(BigInt(counter))
  const hmac = crypto.createHmac('sha1', secretBuf).update(counterBuf).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  return String(bin % 10 ** digits).padStart(digits, '0')
}

function totpAt(secretBase32, counter) {
  const secretBuf = base32Decode(secretBase32)
  if (!secretBuf || secretBuf.length === 0) return null
  return hotp(secretBuf, counter)
}

// 校验 6 位验证码：±1 个 30s 窗口容忍时钟偏移；逐字节恒时比较防时序侧信道
function verifyTotp(secretBase32, code, { window = 1, now = Date.now() } = {}) {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return false
  const secretBuf = base32Decode(secretBase32)
  if (!secretBuf || secretBuf.length === 0) return false
  const counter = Math.floor(now / 1000 / 30)
  const a = Buffer.from(code, 'ascii')
  for (let i = -window; i <= window; i++) {
    const expected = hotp(secretBuf, counter + i)
    if (crypto.timingSafeEqual(a, Buffer.from(expected, 'ascii'))) return true
  }
  return false
}

function generateTotpSecret() {
  // 160 bit 随机密钥 → 32 字符 base32（Google Authenticator 等标准长度）
  return base32Encode(crypto.randomBytes(20))
}

// 校验用户提交的 base32 密钥形态（长度 32 = 160bit；留 16-64 余量兼容异构端）
function isValidTotpSecret(s) {
  return typeof s === 'string' && /^[A-Za-z2-7]{16,64}$/.test(s)
}

// ---- 密钥加密存储（AES-256-GCM，key = sha256(JWT_SECRET)）----
// 格式：base64(iv).base64(authTag).base64(ciphertext)。解密失败返回 null
//（JWT_SECRET 轮换后存量密钥不可解 → verifyTotp 恒 false，见 migrate_admin_totp.sql 的解锁说明）。

function totpKey() {
  return crypto.createHash('sha256').update(String(config.JWT_SECRET)).digest()
}

function encryptTotpSecret(secretBase32) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', totpKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(secretBase32, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv, tag, ciphertext].map((b) => b.toString('base64')).join('.')
}

function decryptTotpSecret(stored) {
  if (typeof stored !== 'string') return null
  const parts = stored.split('.')
  if (parts.length !== 3) return null
  try {
    const [iv, tag, ciphertext] = parts.map((p) => Buffer.from(p, 'base64'))
    const decipher = crypto.createDecipheriv('aes-256-gcm', totpKey(), iv)
    decipher.setAuthTag(tag)
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
    return isValidTotpSecret(plain) ? plain : null
  } catch {
    return null
  }
}

module.exports = {
  base32Encode,
  base32Decode,
  hotp,
  totpAt,
  verifyTotp,
  generateTotpSecret,
  isValidTotpSecret,
  encryptTotpSecret,
  decryptTotpSecret,
}
