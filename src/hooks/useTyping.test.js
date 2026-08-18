// @vitest-environment jsdom
// useTyping hook 的输入判定 / 错误回调契约测试。
// hook 深度耦合 IME/AudioContext/setTimeout，难以整 hook 稳定测试；
// 这里聚焦可稳定驱动的核心交互：正确推进、错误回调契约、退格、完成判定。
// 全程关闭音效（soundEnabled=false）避开 WebAudio，并启用错题本模式跳过 localStorage/IDB。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import useTyping from './useTyping.js'

// 每个测试结束后恢复真实定时器并清理挂起的定时器，避免 setInterval/setTimeout 跨用例污染。
afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

// 工厂：构造最小可用单词列表
function makeWords() {
  return [
    { name: 'cat', trans: ['[n] 猫'], notation: '' },
    { name: 'dog', trans: ['[n] 狗'], notation: '' },
  ]
}

// 默认调用：soundEnabled=false、错题本模式=true（跳过 addToErrorBook 的 localStorage/IDB）
function renderTyping(overrides = {}) {
  const words = overrides.words ?? makeWords()
  const onWordComplete = overrides.onWordComplete ?? vi.fn()
  const onError = overrides.onError ?? vi.fn()
  const onAutoRemove = overrides.onAutoRemove ?? vi.fn()
  const result = renderHook(
    ({
      words,
      soundEnabled,
      wordRepeatCount,
      isErrorBookMode,
      onWordComplete,
      onAutoRemove,
      onError,
    }) =>
      useTyping(
        words,
        soundEnabled,
        wordRepeatCount,
        isErrorBookMode,
        '',
        true,
        onWordComplete,
        onAutoRemove,
        onError
      ),
    {
      initialProps: {
        words,
        soundEnabled: false,
        wordRepeatCount: 1,
        isErrorBookMode: true,
        onWordComplete,
        onAutoRemove,
        onError,
      },
    }
  )
  return { ...result, callbacks: { onWordComplete, onError, onAutoRemove } }
}

describe('useTyping — 输入判定', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('正确输入逐字累积 currentInput', () => {
    const { result } = renderTyping()
    act(() => {
      result.current.handleInput('c')
    })
    expect(result.current.currentInput).toBe('c')
    expect(result.current.isWrong).toBe(false)
  })

  it('完整正确输入当前词后推进到下一词，并触发 onWordComplete', () => {
    const { result, callbacks } = renderTyping()
    act(() => {
      result.current.handleInput('c')
      result.current.handleInput('a')
      result.current.handleInput('t')
    })
    expect(callbacks.onWordComplete).toHaveBeenCalledWith('cat')
    expect(result.current.wordIndex).toBe(1)
    expect(result.current.currentWord.name).toBe('dog')
    expect(result.current.currentInput).toBe('')
  })

  it('错误输入触发 isWrong 与 onError 回调契约（expected, inputChar, index）', () => {
    const { result, callbacks } = renderTyping()
    act(() => {
      result.current.handleInput('x') // 首字母就错
    })
    expect(result.current.isWrong).toBe(true)
    expect(callbacks.onError).toHaveBeenCalledTimes(1)
    const [word, expectedChar, inputChar, letterIndex] = callbacks.onError.mock.calls[0]
    expect(word.name).toBe('cat')
    expect(expectedChar).toBe('c') // target[0]
    expect(inputChar).toBe('x')
    expect(letterIndex).toBe(0)
  })

  it('onError 的 letterIndex 反映已输入位置（第 2 位错误）', () => {
    const { result, callbacks } = renderTyping()
    act(() => {
      result.current.handleInput('c')
      result.current.handleInput('a')
      result.current.handleInput('x') // 第 3 位（index 2）错
    })
    const args = callbacks.onError.mock.calls[0]
    expect(args[1]).toBe('t') // target[2]
    expect(args[2]).toBe('x')
    expect(args[3]).toBe(2)
  })

  it('Backspace 删除上一个字符并清除错误状态', () => {
    const { result } = renderTyping()
    act(() => {
      result.current.handleInput('c')
      result.current.handleInput('a')
      result.current.handleInput('Backspace')
    })
    expect(result.current.currentInput).toBe('c')
    expect(result.current.isWrong).toBe(false)
  })

  it('错误后 300ms 自动清空输入（定时器契约）', () => {
    const { result } = renderTyping()
    act(() => {
      result.current.handleInput('x')
    })
    expect(result.current.currentInput).toBe('x')
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(result.current.currentInput).toBe('')
    expect(result.current.isWrong).toBe(false)
  })

  it('错字后 300ms 内跳词 → 定时器被取消，不清空新词已敲的输入（回归：修复前定时器未登记，跳词后新输入被迟到的清空打断）', () => {
    const { result } = renderTyping()
    act(() => {
      result.current.handleInput('x') // cat 打错，启动 300ms 自动清空
    })
    act(() => {
      result.current.jumpTo(1) // 立即跳到 dog
    })
    act(() => {
      result.current.handleInput('d')
      result.current.handleInput('o')
    })
    expect(result.current.currentInput).toBe('do')
    act(() => {
      vi.advanceTimersByTime(400) // 修复前：旧定时器此刻把 'do' 清掉
    })
    expect(result.current.currentInput).toBe('do')
  })

  it('错字后 300ms 内退格 → 保留退格后的输入，可继续完成单词（回归）', () => {
    const { result, callbacks } = renderTyping()
    act(() => {
      result.current.handleInput('c')
      result.current.handleInput('a')
      result.current.handleInput('x') // 'cax' 错
    })
    act(() => {
      result.current.handleInput('Backspace') // 退掉错字 → 'ca'
    })
    expect(result.current.currentInput).toBe('ca')
    act(() => {
      vi.advanceTimersByTime(400) // 迟到的自动清空不应打断
    })
    expect(result.current.currentInput).toBe('ca')
    act(() => {
      result.current.handleInput('t') // 补完 cat
    })
    expect(callbacks.onWordComplete).toHaveBeenCalledWith('cat')
    expect(result.current.wordIndex).toBe(1)
  })
})

describe('useTyping — 完成判定', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('完成最后一个词后 isFinished=true，并保留最终统计字段', () => {
    const { result, callbacks } = renderTyping()
    // 完成 cat -> dog -> 全部结束
    act(() => {
      result.current.handleInput('c')
      result.current.handleInput('a')
      result.current.handleInput('t')
    })
    expect(callbacks.onWordComplete).toHaveBeenCalledWith('cat')
    act(() => {
      result.current.handleInput('d')
      result.current.handleInput('o')
      result.current.handleInput('g')
    })
    expect(callbacks.onWordComplete).toHaveBeenCalledWith('dog')
    expect(result.current.isFinished).toBe(true)
    // stats 结构完整
    expect(result.current.stats).toHaveProperty('time')
    expect(result.current.stats).toHaveProperty('inputCount')
    expect(result.current.stats).toHaveProperty('correctCount')
    expect(result.current.stats).toHaveProperty('wpm')
    expect(result.current.stats).toHaveProperty('accuracy')
    // 正确输入 6 个字符
    expect(result.current.stats.correctCount).toBe(6)
    expect(result.current.stats.inputCount).toBe(6)
    expect(result.current.stats.accuracy).toBe(1)
  })

  it('isFinished 后 handleInput 不再响应', () => {
    const { result } = renderTyping()
    // 分批 act：每次完成一词后 hook 重新渲染、currentWord/wordIndex 才会刷新，
    // 单次 act 内连续输入会命中旧闭包，故按"完成一词 -> 下一词"分批驱动。
    act(() => {
      result.current.handleInput('c')
      result.current.handleInput('a')
      result.current.handleInput('t')
    })
    act(() => {
      result.current.handleInput('d')
      result.current.handleInput('o')
      result.current.handleInput('g')
    })
    expect(result.current.isFinished).toBe(true)
    const inputBefore = result.current.currentInput
    act(() => {
      result.current.handleInput('z')
    })
    expect(result.current.currentInput).toBe(inputBefore)
  })
})

describe('useTyping — 连字符规范化', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('复合词连字符规范化为空格后可用于比对', () => {
    // pencil-box -> 规范化为 "pencil box"，输入空格而非连字符
    const words = [{ name: 'pencil-box', trans: ['[n] 铅笔盒'], notation: '' }]
    const { result } = renderTyping({ words })
    act(() => {
      result.current.handleInput('p')
      result.current.handleInput('e')
      result.current.handleInput('n')
      result.current.handleInput('c')
      result.current.handleInput('i')
      result.current.handleInput('l')
      result.current.handleInput(' ')
      result.current.handleInput('b')
      result.current.handleInput('o')
      result.current.handleInput('x')
    })
    // 该词无下一词、wordRepeatCount=1 -> 完成 -> isFinished
    expect(result.current.isFinished).toBe(true)
  })
})
