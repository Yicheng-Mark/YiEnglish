// sanitize.js 共享净化工具测试：夹取边界、无效输入兜底、trans 序列化语义。
import { describe, it, expect } from 'vitest'
const { clampStr, toValidDate, toTransJson, clampNum } = require('./sanitize')

describe('clampStr', () => {
  it('非字符串/空串 → null', () => {
    expect(clampStr(null, 255)).toBeNull()
    expect(clampStr(undefined, 255)).toBeNull()
    expect(clampStr(123, 255)).toBeNull()
    expect(clampStr('', 255)).toBeNull()
  })

  it('合法字符串原样返回，超长截断', () => {
    expect(clampStr('hello', 255)).toBe('hello')
    expect(clampStr('a'.repeat(300), 255)).toHaveLength(255)
  })
})

describe('toValidDate', () => {
  it('合法日期串 → Date', () => {
    const d = toValidDate('2026-01-02T03:04:05Z')
    expect(d).toBeInstanceOf(Date)
    expect(d.toISOString()).toBe('2026-01-02T03:04:05.000Z')
  })

  it('空值/垃圾 → null（Invalid Date 会让 mysql2 序列化抛错）', () => {
    expect(toValidDate(null)).toBeNull()
    expect(toValidDate('')).toBeNull()
    expect(toValidDate('not-a-date')).toBeNull()
  })
})

describe('toTransJson', () => {
  it('数组原样序列化', () => {
    expect(toTransJson(['[n] 猫', '[v] 喵'])).toBe('["[n] 猫","[v] 喵"]')
  })

  it('非空字符串包成单元素数组（老用户字符串释义不丢失）', () => {
    expect(toTransJson('[n] 猫')).toBe('["[n] 猫"]')
  })

  it('空白字符串/数字/数组以外类型 → null', () => {
    expect(toTransJson('   ')).toBeNull()
    expect(toTransJson(123)).toBeNull()
    expect(toTransJson(null)).toBeNull()
  })
})

describe('clampNum', () => {
  it('合法数字原样返回', () => {
    expect(clampNum(2.5, 1, 0, 10)).toBe(2.5)
  })

  it('非数字回退默认值', () => {
    expect(clampNum('abc', 2.5, 0, 10)).toBe(2.5)
    expect(clampNum(NaN, 2.5, 0, 10)).toBe(2.5)
    expect(clampNum(undefined, 2.5, 0, 10)).toBe(2.5)
  })

  it('null 是 Number(null)=0 的有限数，走夹取而非回退（原 review.js 语义）', () => {
    expect(clampNum(null, 2.5, 0, 10)).toBe(0)
    expect(clampNum(null, 2.5, 1, 10)).toBe(1)
  })

  it('越界夹取到 [min, max]', () => {
    expect(clampNum(-5, 1, 0, 10)).toBe(0)
    expect(clampNum(999, 1, 0, 10)).toBe(10)
  })

  it('数字字符串可解析（SM-2 客户端可能上送字符串数值）', () => {
    expect(clampNum('3.5', 1, 0, 10)).toBe(3.5)
  })
})
