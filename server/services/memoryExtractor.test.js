// extractMemories 启发式抽取器单元测试：各 pattern 命中、过短内容过滤、去重、无命中。

import { describe, it, expect } from 'vitest'
const { extractMemories } = require('./memoryExtractor')

describe('extractMemories', () => {
  it('「我喜欢/我偏好/我更…」→ preference', () => {
    const out = extractMemories('我喜欢用例句记单词')
    expect(out).toContainEqual({ category: 'preference', content: '我喜欢用例句记单词' })
  })

  it('「我不喜欢/我讨厌/别用」→ preference_negative', () => {
    const out = extractMemories('我讨厌长篇大论的回复')
    expect(out).toContainEqual({ category: 'preference_negative', content: '我讨厌长篇大论的回复' })
  })

  it('「简洁一点/详细一些」→ response_style', () => {
    const out = extractMemories('回答请简洁一点')
    expect(out).toContainEqual({ category: 'response_style', content: '简洁一点' })
  })

  it('「我是…」→ identity', () => {
    const out = extractMemories('我是一名高三学生')
    expect(out).toContainEqual({ category: 'identity', content: '我是一名高三学生' })
  })

  it('「我在做/学/开发…」→ project', () => {
    const out = extractMemories('我在准备雅思考试')
    expect(out).toContainEqual({ category: 'project', content: '我在准备雅思考试' })
  })

  it('「我的名字是…」→ name', () => {
    const out = extractMemories('我的名字是 Alice')
    expect(out).toContainEqual({ category: 'name', content: '我的名字是 alice' })
  })

  it('「以后…」→ instruction', () => {
    const out = extractMemories('以后都先给中文释义')
    expect(out).toContainEqual({ category: 'instruction', content: '以后都先给中文释义' })
  })

  it('同一句命中多个 pattern → 全部保留（各自 category）', () => {
    const out = extractMemories('我喜欢例句，我的名字是 Alice')
    const cats = out.map((m) => m.category)
    expect(cats).toContain('preference')
    expect(cats).toContain('name')
  })

  it('匹配内容过短（<4 字符）→ 过滤（如「简洁点」仅 3 字）', () => {
    expect(extractMemories('简洁点')).toEqual([])
    // 「简洁一点」4 字 → 保留
    expect(extractMemories('简洁一点')).toContainEqual({
      category: 'response_style',
      content: '简洁一点',
    })
  })

  it('重复内容去重', () => {
    const out = extractMemories('我喜欢简洁一点的回答')
    const contents = out.map((m) => m.content)
    expect(new Set(contents).size).toBe(contents.length)
  })

  it('无关文本 → 空数组', () => {
    expect(extractMemories('How do you say apple in English?')).toEqual([])
  })

  it('空输入 → 空数组', () => {
    expect(extractMemories('')).toEqual([])
  })
})
