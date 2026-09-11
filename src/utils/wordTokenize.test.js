// wordTokenize 纯函数测试：词条切分（含 ' 和 - 连接形）、查找词清洗、
// 可点击元素结构与 onWordClick 回调参数。被 reading ArticleDetail 与
// corpus 字幕/句卡组件共用，是「点词查义」链路的入口。
import { describe, it, expect, vi } from 'vitest'
import { getWordRect, isValidWord, cleanWordForLookup, tokenizeText } from './wordTokenize.jsx'

const CLICKABLE =
  'word-clickable cursor-pointer hover:underline hover:opacity-80 transition-opacity'
const PLAIN = 'non-clickable'

function spans(elements) {
  return elements.map((el) => ({
    key: el.key,
    className: el.props.className,
    text: el.props.children,
    clickable: el.props.className === CLICKABLE,
  }))
}

describe('isValidWord', () => {
  it('含字母即有效（含混合了数字的词）', () => {
    expect(isValidWord('abc')).toBe(true)
    expect(isValidWord('ABC')).toBe(true)
    expect(isValidWord('a1')).toBe(true)
  })

  it('空串 / 纯数字 / 非字符串 → 无效', () => {
    expect(isValidWord('')).toBe(false)
    expect(isValidWord('123')).toBe(false)
    expect(isValidWord(null)).toBe(false)
    expect(isValidWord(undefined)).toBe(false)
    expect(isValidWord(42)).toBe(false)
  })
})

describe('cleanWordForLookup', () => {
  it('剥首尾标点并转小写', () => {
    expect(cleanWordForLookup('Hello,')).toBe('hello')
    expect(cleanWordForLookup('"Quoted."')).toBe('quoted')
    expect(cleanWordForLookup('--Test--')).toBe('test')
  })

  it("词中的撇号/连字符保留（don't、well-known 整词查找）", () => {
    expect(cleanWordForLookup("Don't")).toBe("don't")
    expect(cleanWordForLookup('Well-Known')).toBe('well-known')
  })

  it('首部的数字串会被剥掉（123abc → abc）', () => {
    expect(cleanWordForLookup('123abc')).toBe('abc')
  })

  it('空值短路', () => {
    expect(cleanWordForLookup('')).toBe('')
    expect(cleanWordForLookup(null)).toBe('')
    expect(cleanWordForLookup(undefined)).toBe('')
  })
})

describe('getWordRect', () => {
  it('优先取 getClientRects()[0]（比 rect 更贴近文本边界）', () => {
    const rect = { top: 1, height: 20 }
    const target = { getClientRects: () => [rect, { top: 99 }] }
    expect(getWordRect(target)).toBe(rect)
  })

  it('getClientRects 为空 / 不存在时回退 getBoundingClientRect', () => {
    const rect = { top: 2 }
    expect(getWordRect({ getClientRects: () => [], getBoundingClientRect: () => rect })).toBe(rect)
    expect(getWordRect({ getBoundingClientRect: () => rect })).toBe(rect)
  })

  it('target 为空或两者皆无 → null', () => {
    expect(getWordRect(null)).toBeNull()
    expect(getWordRect({})).toBeNull()
  })
})

describe('tokenizeText', () => {
  it('纯文本两个词 → 两个可点击元素，词间空格落在间隙元素里', () => {
    const out = spans(tokenizeText('hello world', 0, vi.fn()))
    expect(out).toEqual([
      { key: '0-plain-word-0', className: CLICKABLE, text: 'hello', clickable: true },
      { key: '0-plain-pre-5', className: PLAIN, text: ' ', clickable: false },
      { key: '0-plain-word-6', className: CLICKABLE, text: 'world', clickable: true },
    ])
  })

  it('标点落在间隙元素里，保留原文大小写展示', () => {
    const out = spans(tokenizeText('Hello, world!', 0, vi.fn()))
    expect(out.map((s) => `${s.clickable ? 'W' : 'T'}:${s.text}`)).toEqual([
      'W:Hello',
      'T:, ',
      'W:world',
      'T:!',
    ])
  })

  it("撇号/连字符词不拆分（don't、well-known 各成一个词）", () => {
    const out = spans(tokenizeText("don't stop well-known", 0, vi.fn()))
    expect(out.filter((s) => s.clickable).map((s) => s.text)).toEqual([
      "don't",
      'stop',
      'well-known',
    ])
  })

  it('无字母文本 → 整段为单个不可点击元素', () => {
    const out = spans(tokenizeText('123 456 !!', 0, vi.fn()))
    expect(out).toEqual([
      { key: '0-plain-post-0', className: PLAIN, text: '123 456 !!', clickable: false },
    ])
  })

  it('key 全局唯一（多词 + 间隙混合）', () => {
    const elements = tokenizeText("Hello, world! It's fine-2.", 3, vi.fn(), 'src')
    const keys = elements.map((el) => el.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('点击词元素：onWordClick 收到清洗后的查找词、rect 与原始 target', () => {
    const onWordClick = vi.fn()
    const [wordEl] = tokenizeText('Hello,', 0, onWordClick)
    const rect = { top: 5, height: 18 }
    const target = { getClientRects: () => [rect] }
    const stopPropagation = vi.fn()
    const preventDefault = vi.fn()

    wordEl.props.onClick({ stopPropagation, preventDefault, target })

    expect(stopPropagation).toHaveBeenCalled()
    expect(preventDefault).toHaveBeenCalled()
    expect(onWordClick).toHaveBeenCalledWith('hello', rect, target)
    expect(wordEl.props.title).toBe('hello')
  })
})
