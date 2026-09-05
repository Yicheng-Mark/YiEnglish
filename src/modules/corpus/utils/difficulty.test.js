// difficulty 纯函数测试：句数 → 难度档位/标签。边界值锁定（<= 才算入档），
// 行为变更会直接影响语料库的难度筛选展示。
import { describe, it, expect } from 'vitest'
import {
  DIFFICULTY_TIERS,
  DIFFICULTY_LABELS,
  getDifficultyLevel,
  getDifficultyLabel,
} from './difficulty.js'

describe('常量', () => {
  it('五个档位且 max 递增，最高档为 Infinity', () => {
    expect(DIFFICULTY_TIERS).toHaveLength(5)
    expect(DIFFICULTY_TIERS.map((t) => t.level)).toEqual([1, 2, 3, 4, 5])
    expect(DIFFICULTY_TIERS[4].max).toBe(Infinity)
  })

  it('DIFFICULTY_LABELS 与 tiers 一致', () => {
    expect(DIFFICULTY_LABELS).toEqual(['初级', '基础', '中级', '中高级', '高级'])
  })
})

describe('getDifficultyLevel 边界', () => {
  it.each([
    [0, 1],
    [50, 1], // <= 50 归初级
    [51, 2],
    [149, 2], // <= 149 归基础
    [150, 3],
    [199, 3], // <= 199 归中级
    [200, 4],
    [249, 4], // <= 249 归中高级
    [250, 5],
    [10000, 5],
  ])('%i 句 → 第 %i 档', (count, level) => {
    expect(getDifficultyLevel(count)).toBe(level)
  })

  it('缺省参数按 0 处理 → 第 1 档', () => {
    expect(getDifficultyLevel()).toBe(1)
  })
})

describe('getDifficultyLabel', () => {
  it.each([
    [50, '初级'],
    [51, '基础'],
    [199, '中级'],
    [249, '中高级'],
    [250, '高级'],
  ])('%i 句 → %s', (count, label) => {
    expect(getDifficultyLabel(count)).toBe(label)
  })

  it('缺省参数 → 初级', () => {
    expect(getDifficultyLabel()).toBe('初级')
  })
})
