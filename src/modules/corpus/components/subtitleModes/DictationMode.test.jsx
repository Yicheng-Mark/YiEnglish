// @vitest-environment jsdom
// DictationMode 组件回归测试。
//
// 钉住的修复（commit 2025392「听写模式接入虚拟化列表」）：
// 1. 行渲染改由 virtualizer.getVirtualItems() 的窗口决定，不再全量
//    subtitles.map —— 300+ 句的期数切换不再一次性挂载数千 DOM 节点；
//    行以 data-index + translateY 绝对定位挂在总高度占位容器内。
// 2. 听写/跟读切换栏移出滚动容器常驻（虚拟列表的滚动偏移以列表容器为基准），
//    旧实现的切换栏嵌在滚动容器内，会随列表一起滚走。
// 输入 → 提交对比 → 反馈切走保留 → 重写的交互闭环经虚拟化路径一并锁定。
// 视频与词典链路与本组件无关：useCorpusContext 与 useSubtitleVirtualList 均以
// vi.mock 替换（假虚拟化器窗口可控，便于断言「窗口外的行不挂载」）。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'

vi.mock('../../context/CorpusPlayerContext.jsx', () => ({
  useCorpusContext: vi.fn(),
}))

vi.mock('./useSubtitleVirtualList.js', () => ({
  useSubtitleVirtualList: vi.fn(),
}))

import { useCorpusContext } from '../../context/CorpusPlayerContext.jsx'
import { useSubtitleVirtualList } from './useSubtitleVirtualList.js'
import DictationMode from './DictationMode.jsx'

const SUBS = [
  { id: 1, start: 0, end: 3, en: 'hello world', zh: '你好世界' },
  { id: 2, start: 3, end: 6, en: 'good morning', zh: '早上好' },
  { id: 3, start: 6, end: 9, en: 'see you', zh: '再见' },
]

// 假虚拟化器的可见窗口 [0, windowEnd]：默认 Infinity（小列表全渲染，交互测试用），
// 单测可收窄验证「窗口外的行不挂载」
let windowEnd
// 最近一次渲染的假虚拟化器返回值（scrollParentRef.current 即滚动容器 DOM）
let lastList

function makeCtx(overrides = {}) {
  return {
    subtitles: SUBS,
    player: { activeId: 1, jumpToCue: vi.fn() },
    posMap: new Map(),
    handleWordClick: vi.fn(),
    settings: { dictationFollowMode: 'dictation', posHighlight: false },
    updateSetting: vi.fn(),
    ...overrides,
  }
}

function renderMode(ctx) {
  useCorpusContext.mockImplementation(() => ctx)
  return render(<DictationMode />)
}

// 字幕行以 data-index 定位；虚拟窗口外的行不存在于 DOM
const rowAt = (container, i) => container.querySelector(`[data-index="${i}"]`)
const rowEls = (container) => container.querySelectorAll('[data-index]')
const findButton = (root, text) =>
  [...root.querySelectorAll('button')].find((b) => b.textContent === text)

beforeEach(() => {
  windowEnd = Infinity
  lastList = null
  useCorpusContext.mockReset()
  useSubtitleVirtualList.mockReset()
  useSubtitleVirtualList.mockImplementation(({ items }) => {
    const list = {
      scrollParentRef: { current: null },
      virtualizer: {
        getVirtualItems: () => {
          const end = Math.min(windowEnd, items.length - 1)
          const out = []
          for (let i = 0; i <= end; i++) out.push({ index: i, start: i * 96 })
          return out
        },
        getTotalSize: () => items.length * 96,
      },
      setRowRef: () => () => undefined,
      containerProps: {},
    }
    lastList = list
    return list
  })
})

describe('虚拟化渲染（2025392 回归）', () => {
  it('只挂载虚拟窗口内的行：窗口外的行不渲染，行按 translateY 定位（旧实现全量 subtitles.map）', () => {
    const subs = Array.from({ length: 120 }, (_, i) => ({
      id: i + 1,
      start: i * 5,
      end: i * 5 + 5,
      en: `row ${i + 1}`,
      zh: `第${i + 1}句`,
    }))
    windowEnd = 9
    const { container } = renderMode(
      makeCtx({ subtitles: subs, player: { activeId: null, jumpToCue: vi.fn() } })
    )

    // 120 句只挂窗口内 10 行（旧实现一次性挂 120 行）
    expect([...rowEls(container)].map((r) => r.getAttribute('data-index'))).toEqual([
      '0',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
    ])
    // 窗口外（第 50 句）的文本不出现在 DOM
    expect(container.textContent).not.toContain('第50句')
    // 行按虚拟偏移绝对定位（3 × estimateSize 96）
    expect(rowAt(container, 3).style.transform).toBe('translateY(288px)')
  })

  it('虚拟化接线：items / activeId / 动态行高估值传给 useSubtitleVirtualList', () => {
    renderMode(makeCtx())
    expect(useSubtitleVirtualList).toHaveBeenCalledWith(
      expect.objectContaining({ items: SUBS, activeId: 1, estimateSize: 96 })
    )
  })

  it('听写/跟读切换栏在滚动容器外常驻（旧实现嵌在滚动容器内随列表滚走）', () => {
    const { container } = renderMode(makeCtx())
    const scrollEl = lastList.scrollParentRef.current
    expect(scrollEl).toBeTruthy()

    const toggle = findButton(container, '听写')
    expect(toggle).toBeTruthy()
    // 修复点：切换栏不在滚动容器内
    expect(scrollEl.contains(toggle)).toBe(false)
    // 但仍常驻在组件头部
    expect(container.contains(toggle)).toBe(true)
    // 滚动容器只承载字幕行
    expect(scrollEl.querySelectorAll('[data-index]')).toHaveLength(SUBS.length)
  })
})

describe('听写交互闭环（经虚拟化路径）', () => {
  it('活跃句显示输入区，非活跃句折叠为省略号', () => {
    const { container } = renderMode(makeCtx())
    const r0 = rowAt(container, 0)
    const r1 = rowAt(container, 1)

    const ta = r0.querySelector('textarea')
    expect(ta).toBeTruthy()
    expect(ta.getAttribute('placeholder')).toBe('开始听写吧…（Ctrl+Enter 提交）')
    expect(r1.querySelector('textarea')).toBeNull()
    expect(r1.textContent).toContain('……')
    expect(r0.textContent).not.toContain('……')
  })

  it('输入并提交：逐词对比反馈（准确率 + 原文/你写）', () => {
    const { container } = renderMode(makeCtx())
    const r0 = rowAt(container, 0)

    fireEvent.change(r0.querySelector('textarea'), { target: { value: 'hello word' } })
    expect(r0.querySelector('textarea').value).toBe('hello word')

    fireEvent.click(findButton(r0, '提交对比'))
    expect(r0.textContent).toContain('准确率 50%（1/2）')
    expect(r0.textContent).toContain('world') // 原文提示漏写的词
    expect(r0.textContent).toContain('word') // 你写错词
    expect(r0.querySelector('textarea')).toBeNull() // 提交后输入区收起
  })

  it('Ctrl+Enter 快捷提交', () => {
    const { container } = renderMode(makeCtx())
    const r0 = rowAt(container, 0)

    fireEvent.change(r0.querySelector('textarea'), { target: { value: 'hello world' } })
    fireEvent.keyDown(r0.querySelector('textarea'), { key: 'Enter', ctrlKey: true })

    expect(r0.textContent).toContain('准确率 100%（2/2）')
  })

  it('提交后切走活跃句：反馈保留显示，新活跃句接管输入区', () => {
    const ctx = makeCtx()
    const { container, rerender } = renderMode(ctx)
    fireEvent.change(rowAt(container, 0).querySelector('textarea'), {
      target: { value: 'hello' },
    })
    fireEvent.click(findButton(rowAt(container, 0), '提交对比'))
    expect(rowAt(container, 0).textContent).toContain('准确率')

    ctx.player.activeId = 2
    rerender(<DictationMode />)

    // 旧句反馈保留（提交结果不随活跃句切换丢失）
    expect(rowAt(container, 0).textContent).toContain('准确率 50%（1/2）')
    expect(rowAt(container, 0).querySelector('textarea')).toBeNull()
    expect(rowAt(container, 1).querySelector('textarea')).toBeTruthy()
  })

  it('重写：清除反馈恢复输入区，输入清空', () => {
    const { container } = renderMode(makeCtx())
    const r0 = rowAt(container, 0)
    fireEvent.change(r0.querySelector('textarea'), { target: { value: 'hello word' } })
    fireEvent.click(findButton(r0, '提交对比'))

    fireEvent.click(findButton(r0, '重写'))

    expect(r0.textContent).not.toContain('准确率')
    const ta = r0.querySelector('textarea')
    expect(ta).toBeTruthy()
    expect(ta.value).toBe('')
  })

  it('点击行跳转该句：player.jumpToCue(id)', () => {
    const ctx = makeCtx()
    const { container } = renderMode(ctx)

    // onClick 在行组件根节点（wrapper 的 firstElementChild）上
    fireEvent.click(rowAt(container, 1).firstElementChild)

    expect(ctx.player.jumpToCue).toHaveBeenCalledWith(2)
  })

  it('查看原文开关：显示/隐藏当前句原文', () => {
    const { container } = renderMode(makeCtx())
    const r0 = rowAt(container, 0)
    expect(r0.textContent).not.toContain('hello world')

    fireEvent.click(findButton(r0, '查看原文'))
    expect(r0.textContent).toContain('hello world')
    expect(findButton(r0, '隐藏原文')).toBeTruthy()

    fireEvent.click(findButton(r0, '隐藏原文'))
    expect(r0.textContent).not.toContain('hello world')
  })
})

describe('跟读模式与空字幕', () => {
  it('跟读模式：直接显示原文，无输入区', () => {
    const { container } = renderMode(
      makeCtx({ settings: { dictationFollowMode: 'follow', posHighlight: false } })
    )

    expect(container.querySelector('textarea')).toBeNull()
    expect(rowAt(container, 0).textContent).toContain('hello world')
    expect(container.textContent).toContain('跟读模式：边听边读')
  })

  it('切换按钮调用 updateSetting（settings 归 context 持有）', () => {
    const ctx = makeCtx()
    const { container } = renderMode(ctx)

    fireEvent.click(findButton(container, '跟读'))
    fireEvent.click(findButton(container, '听写'))

    expect(ctx.updateSetting).toHaveBeenNthCalledWith(1, 'dictationFollowMode', 'follow')
    expect(ctx.updateSetting).toHaveBeenNthCalledWith(2, 'dictationFollowMode', 'dictation')
  })

  it('无字幕时渲染空', () => {
    const { container } = renderMode(makeCtx({ subtitles: [] }))
    expect(container.innerHTML).toBe('')
  })
})
