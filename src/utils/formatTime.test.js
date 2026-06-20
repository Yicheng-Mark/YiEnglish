import { describe, it, expect } from 'vitest'
import { formatTime } from './formatTime.js'

describe('formatTime', () => {
  it('0 秒 → 0:00', () => {
    expect(formatTime(0)).toBe('0:00')
  })

  it('小于 60 秒时秒数补零', () => {
    expect(formatTime(5)).toBe('0:05')
    expect(formatTime(59)).toBe('0:59')
  })

  it('分钟:秒 格式', () => {
    expect(formatTime(60)).toBe('1:00')
    expect(formatTime(65)).toBe('1:05')
    expect(formatTime(125)).toBe('2:05')
    expect(formatTime(3661)).toBe('61:01')
  })

  it('负数截断为 0', () => {
    expect(formatTime(-10)).toBe('0:00')
    expect(formatTime(-1)).toBe('0:00')
  })

  it('小数向下取整', () => {
    expect(formatTime(59.9)).toBe('0:59')
    expect(formatTime(60.999)).toBe('1:00')
  })
})
