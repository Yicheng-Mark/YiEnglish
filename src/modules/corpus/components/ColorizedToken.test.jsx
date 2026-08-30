// @vitest-environment jsdom
// ColorizedToken / ColorizedText 组件测试。
//
// 覆盖：分词渲染（单词 token 可点击、标点纯文本）、词性着色、查词回调、
// cloze 空白交互（点击揭示/隐藏），以及 memo + 分词缓存的渲染热路径
// （字幕面板随 timeupdate ~4Hz 重渲染时 props 不变不应重复分词）。
// 注：本文件含 JSX，用 .jsx 扩展名让 esbuild 自动做 JSX 转换。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'

// spy 包装 tokenizeEnglish：验证重渲染时是否重复分词
vi.mock('../utils/wordColorMap.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, tokenizeEnglish: vi.fn(actual.tokenizeEnglish) }
})

import { tokenizeEnglish } from '../utils/wordColorMap.js'
import { ColorizedText } from './ColorizedToken.jsx'

function makeProps(overrides = {}) {
  return {
    text: 'Hello, world!',
    paraKey: 't',
    posMap: new Map([['hello', 'noun']]),
    onWordClick: vi.fn(),
    showColor: true,
    clozeIndices: null,
    ...overrides,
  }
}

beforeEach(() => {
  tokenizeEnglish.mockClear()
})

describe('ColorizedText 渲染', () => {
  it('单词渲染为可点击 token，标点为纯文本', () => {
    const props = makeProps()
    const { container } = render(<ColorizedText {...props} />)

    expect(container.textContent).toBe('Hello, world!')
    const clickables = container.querySelectorAll('.word-clickable')
    expect(clickables).toHaveLength(2)
    expect(clickables[0].getAttribute('title')).toBe('hello')
  })

  it('有词性的单词带词性颜色变量，unknown 不带', () => {
    const props = makeProps()
    const { container } = render(<ColorizedText {...props} />)

    const hello = container.querySelectorAll('.word-clickable')[0]
    expect(hello.style.getPropertyValue('--corpus-pos-color')).toBe('var(--word-noun)')
    // world 不在 posMap 中 → unknown，不着色
    const world = container.querySelectorAll('.word-clickable')[1]
    expect(world.style.getPropertyValue('--corpus-pos-color')).toBe('')
  })

  it('点击单词触发 onWordClick，携带小写词名', () => {
    const props = makeProps()
    const { container } = render(<ColorizedText {...props} />)

    fireEvent.click(container.querySelectorAll('.word-clickable')[0])
    expect(props.onWordClick).toHaveBeenCalledTimes(1)
    expect(props.onWordClick.mock.calls[0][0]).toBe('hello')
  })

  it('空文本渲染 null', () => {
    const { container } = render(<ColorizedText {...makeProps({ text: '' })} />)
    expect(container.innerHTML).toBe('')
  })
})

describe('cloze 空白', () => {
  it('clozeIndices 命中的 token 渲染为空白块，点击揭示原文', () => {
    // 'Hello, world!' tokens: 0=Hello 1=', ' 2=world 3='!' → 挖空 world（索引 2）
    const props = makeProps({ clozeIndices: new Set([2]) })
    const { container } = render(<ColorizedText {...props} />)

    const blank = container.querySelector('.corpus-cloze-blank')
    expect(blank).toBeTruthy()
    expect(blank.textContent).not.toContain('world') // 未揭示

    fireEvent.click(blank)
    expect(container.querySelector('.corpus-cloze-blank').textContent).toBe('world')

    fireEvent.click(container.querySelector('.corpus-cloze-blank'))
    expect(container.querySelector('.corpus-cloze-blank').textContent).not.toContain('world')
  })
})

describe('渲染热路径（memo + 分词缓存）', () => {
  it('props 不变的重渲染不重复分词（timeupdate 高频重渲染场景）', () => {
    const props = makeProps()
    const { rerender } = render(<ColorizedText {...props} />)

    // 模拟父组件 4Hz 重渲染传回完全相同的 props
    rerender(<ColorizedText {...props} />)
    rerender(<ColorizedText {...props} />)

    expect(tokenizeEnglish).toHaveBeenCalledTimes(1)
  })

  it('文本变化时重新分词', () => {
    const { rerender } = render(<ColorizedText {...makeProps({ text: 'one two' })} />)
    rerender(<ColorizedText {...makeProps({ text: 'three four' })} />)
    expect(tokenizeEnglish).toHaveBeenCalledTimes(2)
  })
})
