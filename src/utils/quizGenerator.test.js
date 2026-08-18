// quizGenerator 纯逻辑测试：编辑距离 / 乱序 / 干扰项三档筛选 / 出题与题型守卫。
import { describe, it, expect } from 'vitest'
import {
  levenshtein,
  shuffle,
  getDistractors,
  generateQuestion,
  generateQuestions,
} from './quizGenerator.js'

describe('levenshtein', () => {
  it.each([
    ['', '', 0],
    ['', 'abc', 3],
    ['cat', 'cat', 0],
    ['kitten', 'sitting', 3],
    ['stop', 'stoppe', 2],
  ])('levenshtein(%j, %j) = %i', (a, b, expected) => {
    expect(levenshtein(a, b)).toBe(expected)
  })
})

describe('shuffle', () => {
  it('不增删元素，只改变顺序', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8]
    const shuffled = shuffle([...arr])
    expect(shuffled).toHaveLength(arr.length)
    expect([...shuffled].sort((a, b) => a - b)).toEqual(arr)
  })

  it('返回新数组，不改原数组', () => {
    const arr = [1, 2, 3]
    const copy = [...arr]
    shuffle(arr)
    expect(arr).toEqual(copy)
  })
})

describe('getDistractors', () => {
  const word = { name: 'apple', trans: '[n] 苹果' }

  it('排除目标词自身', () => {
    const all = [
      word,
      { name: 'banana', trans: '[n] 香蕉' },
      { name: 'dog', trans: '[n] 狗' },
      { name: 'egg', trans: '[n] 鸡蛋' },
      { name: 'fish', trans: '[n] 鱼' },
    ]
    const result = getDistractors(word, all, 'en2cn')
    expect(result.some((w) => w.name === 'apple')).toBe(false)
  })

  it('排除形近词（编辑距离 ≤ 2，硬性规则不可放松）', () => {
    const all = [
      word,
      { name: 'apples', trans: '[n] 苹果们' }, // 距离 1
      { name: 'apply', trans: '[v] 申请' }, // 距离 2
      { name: 'banana', trans: '[n] 香蕉' },
      { name: 'dog', trans: '[n] 狗' },
      { name: 'egg', trans: '[n] 鸡蛋' },
      { name: 'fish', trans: '[n] 鱼' },
    ]
    const result = getDistractors(word, all, 'en2cn', 4)
    expect(result.some((w) => w.name === 'apples')).toBe(false)
    expect(result.some((w) => w.name === 'apply')).toBe(false)
  })

  it('候选足够时优先同词性', () => {
    const all = [
      word,
      { name: 'banana', trans: '[n] 香蕉' },
      { name: 'dog', trans: '[n] 狗' },
      { name: 'egg', trans: '[n] 鸡蛋' },
      { name: 'run', trans: '[v] 跑' },
    ]
    const result = getDistractors(word, all, 'en2cn')
    expect(result).toHaveLength(3)
    // 三个名词候选足够，不应混入动词
    expect(result.every((w) => w.trans.startsWith('[n]'))).toBe(true)
  })

  it('词本词数不足时从备用池补足到 count 个', () => {
    const result = getDistractors(word, [word], 'en2cn')
    expect(result).toHaveLength(3)
    // 备用池补充的候选不含目标词
    expect(result.some((w) => w.name === 'apple')).toBe(false)
  })
})

describe('generateQuestion', () => {
  const all = [
    { name: 'apple', trans: '[n] 苹果' },
    { name: 'banana', trans: '[n] 香蕉' },
    { name: 'dog', trans: '[n] 狗' },
    { name: 'egg', trans: '[n] 鸡蛋' },
    { name: 'fish', trans: '[n] 鱼' },
  ]

  it('en2cn：选项为释义，正确项可被 correctIndex 命中', () => {
    const q = generateQuestion(all[0], all, 'en2cn')
    expect(q.type).toBe('en2cn')
    expect(q.options).toHaveLength(4)
    expect(q.options[q.correctIndex].isCorrect).toBe(true)
    expect(q.options[q.correctIndex].label).toBe('[n] 苹果')
  })

  it('cn2en：选项为英文单词', () => {
    const q = generateQuestion(all[0], all, 'cn2en')
    expect(q.type).toBe('cn2en')
    expect(q.options[q.correctIndex].label).toBe('apple')
    expect(q.options.filter((o) => o.isCorrect)).toHaveLength(1)
  })

  it('listening 题型与 en2cn 同为释义选项', () => {
    const q = generateQuestion(all[0], all, 'listening')
    expect(q.options[q.correctIndex].label).toBe('[n] 苹果')
  })
})

describe('generateQuestions', () => {
  const words = [
    { name: 'apple', trans: '[n] 苹果' },
    { name: 'banana', trans: '[n] 香蕉' },
    { name: 'dog', trans: '[n] 狗' },
    { name: 'egg', trans: '[n] 鸡蛋' },
  ]

  it('按 count 出题且题干不重复', () => {
    const qs = generateQuestions(words, words, ['en2cn', 'cn2en'], 4)
    expect(qs).toHaveLength(4)
    const stems = qs.map((q) => q.stem.name)
    expect(new Set(stems).size).toBe(4)
  })

  it('空题型池回退默认题型而非静默落入 cn2en（回归守卫）', () => {
    const qs = generateQuestions(words, words, [], 4)
    expect(qs).toHaveLength(4)
    // 修复前 type=undefined 会静默走 cn2en 分支；现在应显式回退为 en2cn
    expect(qs.every((q) => q.type === 'en2cn')).toBe(true)
  })
})
