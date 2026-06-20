import { describe, it, expect } from 'vitest'
import { normalizeWordName } from './wordName.js'

describe('normalizeWordName', () => {
  it('把连字符替换为空格（移动端键盘无法输入连字符）', () => {
    expect(normalizeWordName('pencil-box')).toBe('pencil box')
    expect(normalizeWordName('ice-cream')).toBe('ice cream')
  })

  it('多个连字符全部替换', () => {
    expect(normalizeWordName('merry-go-round')).toBe('merry go round')
  })

  it('无连字符时保持原样', () => {
    expect(normalizeWordName('hello')).toBe('hello')
  })

  it('保留大小写', () => {
    expect(normalizeWordName('Hello-World')).toBe('Hello World')
  })

  it('空值 / null / undefined 安全返回空串', () => {
    expect(normalizeWordName('')).toBe('')
    expect(normalizeWordName(null)).toBe('')
    expect(normalizeWordName(undefined)).toBe('')
  })
})
