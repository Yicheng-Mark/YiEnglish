// 题目生成 / 干扰项 / 答案判定的纯逻辑单元测试。
// 测试目标为从 useQuiz 抽出的 src/utils/quizGenerator.js，覆盖高价值、可稳定通过的逻辑。
import { describe, it, expect } from 'vitest'
import {
  levenshtein,
  shuffle,
  getDistractors,
  generateQuestion,
  generateQuestions,
} from '../utils/quizGenerator.js'

describe('levenshtein', () => {
  it('相同字符串距离为 0', () => {
    expect(levenshtein('apple', 'apple')).toBe(0)
  })

  it('空串距离等于另一串长度', () => {
    expect(levenshtein('', 'abc')).toBe(3)
    expect(levenshtein('abc', '')).toBe(3)
  })

  it('单字符替换计 1', () => {
    expect(levenshtein('cat', 'bat')).toBe(1)
  })

  it('插入/删除/多步替换正确累计', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3)
    expect(levenshtein('flaw', 'lawn')).toBe(2)
  })

  it('大小写敏感（编辑距离算法以字符严格相等计）', () => {
    // 'a' vs 'A' 视为不同字符，故距离为 1
    expect(levenshtein('a', 'A')).toBe(1)
  })
})

describe('shuffle', () => {
  it('返回新数组且不改原数组', () => {
    const arr = [1, 2, 3, 4, 5]
    const copy = arr.slice()
    const out = shuffle(arr)
    expect(arr).toEqual(copy) // 原数组不变
    expect(out).not.toBe(arr) // 新引用
  })

  it('包含与输入相同的元素集合', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8]
    const out = shuffle(arr)
    expect(out.slice().sort()).toEqual(arr.slice().sort())
  })

  it('空数组与单元素数组安全返回', () => {
    expect(shuffle([])).toEqual([])
    expect(shuffle([42])).toEqual([42])
  })
})

describe('getDistractors', () => {
  const allWords = [
    { name: 'apple', trans: '[n] 苹果' },
    { name: 'banana', trans: '[n] 香蕉' },
    { name: 'cat', trans: '[n] 猫' },
    { name: 'dog', trans: '[n] 狗' },
    { name: 'run', trans: '[v] 跑' },
    { name: 'jump', trans: '[v] 跳' },
  ]

  it('排除目标词本身', () => {
    const out = getDistractors({ name: 'apple', trans: '[n] 苹果' }, allWords, 'en2cn')
    expect(out.every((w) => w.name !== 'apple')).toBe(true)
  })

  it('排除形近词（编辑距离 ≤ 2）', () => {
    // cat 与目标 cat 距离 0，应被排除；dog 距离 3 保留
    const out = getDistractors({ name: 'cat', trans: '[n] 猫' }, allWords, 'en2cn')
    expect(out.find((w) => w.name === 'cat')).toBeUndefined()
  })

  it('默认返回至多 3 个干扰项', () => {
    const out = getDistractors({ name: 'apple', trans: '[n] 苹果' }, allWords, 'en2cn')
    expect(out.length).toBeLessThanOrEqual(3)
  })

  it('词本不足时从备用池补足到 3 个', () => {
    // 仅 1 个非形近词，需补足
    const tiny = [
      { name: 'apple', trans: '[n] 苹果' },
      { name: 'xylophone', trans: '[n] 木琴' },
    ]
    const out = getDistractors({ name: 'apple', trans: '[n] 苹果' }, tiny, 'en2cn')
    expect(out.length).toBe(3)
    expect(out.every((w) => w.name !== 'apple')).toBe(true)
  })

  it('备用池仍排除与目标形近的词', () => {
    // 目标 apple，备用池中无 apple，但应排除形近词（编辑距离 ≤ 2 的不会出现）
    const out = getDistractors({ name: 'apple', trans: '[n] 苹果' }, [], 'en2cn')
    const tooClose = out.filter((w) => levenshtein('apple', w.name.toLowerCase()) <= 2)
    expect(tooClose).toEqual([])
  })
})

describe('generateQuestion', () => {
  const allWords = [
    { name: 'apple', trans: '[n] 苹果' },
    { name: 'banana', trans: '[n] 香蕉' },
    { name: 'cat', trans: '[n] 猫' },
    { name: 'dog', trans: '[n] 狗' },
    { name: 'run', trans: '[v] 跑' },
  ]
  const target = { name: 'apple', trans: '[n] 苹果' }

  it('en2cn：正确选项 label 为中文释义', () => {
    const q = generateQuestion(target, allWords, 'en2cn')
    const correct = q.options[q.correctIndex]
    expect(correct.isCorrect).toBe(true)
    expect(correct.label).toBe('[n] 苹果')
  })

  it('cn2en：正确选项 label 为英文单词', () => {
    const q = generateQuestion(target, allWords, 'cn2en')
    const correct = q.options[q.correctIndex]
    expect(correct.isCorrect).toBe(true)
    expect(correct.label).toBe('apple')
  })

  it('listening：正确选项 label 为中文释义', () => {
    const q = generateQuestion(target, allWords, 'listening')
    const correct = q.options[q.correctIndex]
    expect(correct.label).toBe('[n] 苹果')
  })

  it('恰好一个正确选项，correctIndex 指向它', () => {
    const q = generateQuestion(target, allWords, 'en2cn')
    const corrects = q.options.filter((o) => o.isCorrect)
    expect(corrects.length).toBe(1)
    expect(q.options[q.correctIndex].isCorrect).toBe(true)
  })

  it('stem 保留目标词，type 透传', () => {
    const q = generateQuestion(target, allWords, 'en2cn')
    expect(q.stem).toBe(target)
    expect(q.type).toBe('en2cn')
  })

  it('选项总数 = 1 正确 + min(干扰项,3)，不超过 4', () => {
    const q = generateQuestion(target, allWords, 'en2cn')
    expect(q.options.length).toBeGreaterThanOrEqual(1)
    expect(q.options.length).toBeLessThanOrEqual(4)
  })
})

describe('generateQuestions', () => {
  const words = [
    { name: 'apple', trans: '[n] 苹果' },
    { name: 'banana', trans: '[n] 香蕉' },
    { name: 'cat', trans: '[n] 猫' },
    { name: 'dog', trans: '[n] 狗' },
    { name: 'run', trans: '[v] 跑' },
  ]

  it('生成的题目数不超过请求数', () => {
    const qs = generateQuestions(words, words, ['en2cn'], 3)
    expect(qs.length).toBe(3)
  })

  it('请求超过词数时仅生成词数个', () => {
    const qs = generateQuestions(words, words, ['en2cn'], 99)
    expect(qs.length).toBe(words.length)
  })

  it('每道题的 type 来自 questionTypes', () => {
    const types = ['en2cn', 'cn2en', 'listening']
    const qs = generateQuestions(words, words, types, words.length)
    expect(qs.every((q) => types.includes(q.type))).toBe(true)
  })

  it('每道题结构完整且含唯一正确选项', () => {
    const qs = generateQuestions(words, words, ['en2cn'], words.length)
    for (const q of qs) {
      expect(q.options[q.correctIndex].isCorrect).toBe(true)
      expect(q.options.filter((o) => o.isCorrect).length).toBe(1)
    }
  })
})
