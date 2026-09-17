import { describe, it, expect } from 'vitest'
import crypto from 'node:crypto'
import {
  base32Encode,
  base32Decode,
  hotp,
  verifyTotp,
  generateTotpSecret,
  isValidTotpSecret,
  encryptTotpSecret,
  decryptTotpSecret,
} from './totp.js'

// RFC 4226 附录 B / RFC 6238 附录 B 的标准测试密钥（20 字节，base32 即
// 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'），SHA-1、8 位长度的期望值直接取自 RFC。
const RFC_SECRET_B32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'

describe('base32', () => {
  it('roundtrip', () => {
    // len=0 编码为空串、空串按无效密钥解码返回 null（见下一条用例），不参与 roundtrip
    for (const len of [1, 5, 19, 20, 32]) {
      const buf = crypto.randomBytes(len)
      expect(base32Decode(base32Encode(buf)).equals(buf)).toBe(true)
    }
  })
  it('非法字符返回 null', () => {
    expect(base32Decode('ABC1')).toBeNull() // 1 不在字母表
    expect(base32Decode('ABC8')).toBeNull() // 8 不在字母表
    expect(base32Decode('')).toBeNull() // 空串产出空 buffer，按无效处理
  })
  it('RFC 密钥解码为 20 字节', () => {
    expect(base32Decode(RFC_SECRET_B32).length).toBe(20)
  })
})

describe('hotp / totp（RFC 4238 向量）', () => {
  // RFC 6238 附录 B：SHA1 分支的 8 位期望值
  const vectors8 = [
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130'],
  ]
  it.each(vectors8)('T=%i → %s（8 位）', (t, expected) => {
    expect(hotp(base32Decode(RFC_SECRET_B32), Math.floor(t / 30), 8)).toBe(expected)
  })
  it('6 位 = 8 位的后 6 位（动态截断同一分支）', () => {
    for (const [t, expected8] of vectors8) {
      expect(hotp(base32Decode(RFC_SECRET_B32), Math.floor(t / 30), 6)).toBe(expected8.slice(2))
    }
  })
})

describe('verifyTotp', () => {
  const now = 59_000
  it('当期验证码通过', () => {
    const code = hotp(base32Decode(RFC_SECRET_B32), Math.floor(59 / 30))
    expect(verifyTotp(RFC_SECRET_B32, code, { now })).toBe(true)
  })
  it('±1 窗口容忍时钟偏移', () => {
    const code = hotp(base32Decode(RFC_SECRET_B32), Math.floor(59 / 30) + 1)
    expect(verifyTotp(RFC_SECRET_B32, code, { now })).toBe(true)
    const codePrev = hotp(base32Decode(RFC_SECRET_B32), Math.floor(59 / 30) - 1)
    expect(verifyTotp(RFC_SECRET_B32, codePrev, { now })).toBe(true)
  })
  it('超出窗口拒绝', () => {
    const code = hotp(base32Decode(RFC_SECRET_B32), Math.floor(59 / 30) + 2)
    expect(verifyTotp(RFC_SECRET_B32, code, { now })).toBe(false)
  })
  it('格式非法拒绝（位数/非数字/复用过的旧码形状）', () => {
    expect(verifyTotp(RFC_SECRET_B32, '12345', { now })).toBe(false)
    expect(verifyTotp(RFC_SECRET_B32, '1234567', { now })).toBe(false)
    expect(verifyTotp(RFC_SECRET_B32, '12345a', { now })).toBe(false)
    expect(verifyTotp(RFC_SECRET_B32, 123456, { now })).toBe(false)
  })
  it('非法密钥拒绝', () => {
    expect(verifyTotp('NOT_A_SECRET!!', '123456', { now })).toBe(false)
    expect(verifyTotp('', '123456', { now })).toBe(false)
  })
})

describe('密钥生成与校验', () => {
  it('generateTotpSecret 输出 32 位合法 base32', () => {
    for (let i = 0; i < 20; i++) {
      const s = generateTotpSecret()
      expect(s).toMatch(/^[A-Z2-7]{32}$/)
      expect(isValidTotpSecret(s)).toBe(true)
    }
  })
  it('isValidTotpSecret 拒绝过短/非法字符', () => {
    expect(isValidTotpSecret('ABC23456')).toBe(false) // 8 位过短
    expect(isValidTotpSecret('abc123')).toBe(false)
    expect(isValidTotpSecret(123456)).toBe(false)
  })
})

describe('密钥加密存储', () => {
  it('roundtrip', () => {
    const secret = generateTotpSecret()
    const stored = encryptTotpSecret(secret)
    expect(stored).not.toContain(secret)
    expect(decryptTotpSecret(stored)).toBe(secret)
  })
  it('每次加密产生不同密文（随机 IV）', () => {
    const secret = generateTotpSecret()
    expect(encryptTotpSecret(secret)).not.toBe(encryptTotpSecret(secret))
  })
  it('篡改密文解密失败返回 null（GCM 认证）', () => {
    const stored = encryptTotpSecret(generateTotpSecret())
    const parts = stored.split('.')
    const tampered = Buffer.from(parts[2], 'base64')
    tampered[0] ^= 0xff
    parts[2] = tampered.toString('base64')
    expect(decryptTotpSecret(parts.join('.'))).toBeNull()
  })
  it('非三段/乱码输入返回 null 而非抛错', () => {
    expect(decryptTotpSecret('garbage')).toBeNull()
    expect(decryptTotpSecret('a.b.c')).toBeNull()
    expect(decryptTotpSecret(null)).toBeNull()
  })
})
