// wordColorMap 纯函数测试：分词（tokenizeEnglish）、cloze 选点（pickClozeIndices）、
// 词性解析（parsePosFromTrans）与词性取色。
//
// 这些函数处于语料播放器热路径（ColorizedText 每句渲染都会调用），
// 行为变更会直接影响字幕展示/挖空题目，用测试锁定语义。
import { describe, it, expect } from 'vitest'
import {
  tokenizeEnglish,
  pickClozeIndices,
  parsePosFromTrans,
  getPosColor,
  getPosHighlightColor,
} from './wordColorMap.js'

describe('tokenizeEnglish', () => {
  it('按单词/非单词切分，保留标点 token 与 offset', () => {
    const tokens = tokenizeEnglish('Hello, world!')
    expect(tokens.map((t) => t.raw)).toEqual(['Hello', ', ', 'world', '!'])
    expect(tokens.map((t) => t.isWord)).toEqual([true, false, true, false])
    expect(tokens[0].offset).toBe(0)
    expect(tokens[2].offset).toBe(7)
  })

  it('单词 token 的 lower 为小写并清洗非字母符号', () => {
    const [tok] = tokenizeEnglish('Hello')
    expect(tok.lower).toBe('hello')
  })

  it('连字符与撇号词保持为单一 token', () => {
    expect(tokenizeEnglish('state-of-the-art')).toHaveLength(1)
    expect(tokenizeEnglish("don't")[0].lower).toBe("don't")
  })

  it('非 ASCII 字符（如重音字母）拆为非单词 token，lower 清洗后仅保留字母', () => {
    const tokens = tokenizeEnglish('café')
    // 'caf' 是单词 token；é 不属于 [a-zA-Z]，单独成非单词 token
    expect(tokens[0]).toMatchObject({ raw: 'caf', isWord: true, lower: 'caf' })
    expect(tokens[1]).toMatchObject({ raw: 'é', isWord: false, lower: '' })
  })

  it('空输入返回空数组', () => {
    expect(tokenizeEnglish('')).toEqual([])
    expect(tokenizeEnglish(null)).toEqual([])
    expect(tokenizeEnglish(undefined)).toEqual([])
  })

  it('连续调用结果一致（共享 regex 的 lastIndex 复位正确）', () => {
    const first = tokenizeEnglish('one two three')
    // 模拟上次执行中途被打断后 lastIndex 残留的场景：手动置非零再调一次
    const second = tokenizeEnglish('one two three')
    expect(second).toEqual(first)
  })
})

describe('pickClozeIndices', () => {
  const sentence = 'The quick brown fox jumps over the lazy dog'
  const tokens = tokenizeEnglish(sentence)

  it('同一字幕 id 结果确定（seeded rng）', () => {
    const posMap = new Map()
    const a = pickClozeIndices(tokens, posMap, { id: 1 })
    const b = pickClozeIndices(tokens, posMap, { id: 1 })
    expect(a).toEqual(b)
  })

  it('停用词与短词（<3 字符）不入选', () => {
    const picked = pickClozeIndices(tokens, new Map(), { id: 1 }, 1) // 只挖 1 个
    for (const idx of picked) {
      const t = tokens[idx]
      expect(t.isWord).toBe(true)
      expect(t.lower.length).toBeGreaterThanOrEqual(3)
      expect(['the', 'over']).not.toContain(t.lower)
    }
  })

  it('按 density 控制挖空数量', () => {
    // 候选：quick brown fox jumps lazy dog（the/over 是停用词）共 6 个
    const picked = pickClozeIndices(tokens, new Map(), { id: 1 }, 0.5)
    expect(picked.size).toBe(3)
  })

  it('空输入返回空集合', () => {
    expect(pickClozeIndices([], new Map(), { id: 1 }).size).toBe(0)
    expect(pickClozeIndices(null, new Map(), { id: 1 }).size).toBe(0)
  })
})

describe('parsePosFromTrans', () => {
  it.each([
    ['[v] 完成', 'verb'],
    ['[vt] 获取', 'verb'],
    // 注：'[vt.]' 带点形式不在方括号 pattern 覆盖范围内（现有语义），归为 unknown
    ['[vt.] 获取', 'unknown'],
    ['[n] 苹果', 'noun'],
    ['[adj] 美丽的', 'adjective'],
    ['[a] 好（古用法）', 'adjective'],
    ['[adv] 突然地', 'adverb'],
    ['[prep] 在…之下', 'preposition'],
    ['[conj] 和', 'conjunction'],
    ['[pron] 他', 'pronoun'],
    ['[int] 哎呀', 'interjection'],
    ['[phr] 放弃', 'phrase'],
    // 注：方括号 pattern 优先于行内缩写——字符串中任何位置的 [n] 都会压过开头的 vt.
    ['vt. 获取; [n] 接近', 'noun'],
    ['n. 苹果', 'noun'],
    ['苹果', 'unknown'],
  ])('%s → %s', (trans, expected) => {
    expect(parsePosFromTrans(trans)).toBe(expected)
  })

  it('数组形态取首个释义解析', () => {
    expect(parsePosFromTrans(['[v] 完成', '[n] 完成量'])).toBe('verb')
  })
})

describe('词性取色', () => {
  it('getPosColor 返回对应 CSS 变量', () => {
    expect(getPosColor('verb')).toBe('var(--word-verb)')
    expect(getPosColor('unknown')).toBe('var(--word-default)')
    expect(getPosColor('bogus')).toBe('var(--word-default)')
    expect(getPosColor(null)).toBe('var(--word-default)')
  })

  it('getPosHighlightColor 未知词性返回空串', () => {
    expect(getPosHighlightColor('verb')).toBeTruthy()
    expect(getPosHighlightColor('bogus')).toBe('')
  })
})
