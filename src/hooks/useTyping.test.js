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
      resetKey,
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
        onError,
        resetKey
      ),
    {
      initialProps: {
        words,
        soundEnabled: overrides.soundEnabled ?? false,
        wordRepeatCount: overrides.wordRepeatCount ?? 1,
        isErrorBookMode: true,
        onWordComplete,
        onAutoRemove,
        onError,
        resetKey: overrides.resetKey ?? null,
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

  it('重复模式首次拼对不自动移除，整轮无错完成后才移除', () => {
    const { result, callbacks } = renderTyping({ wordRepeatCount: 2 })

    act(() => {
      result.current.handleInput('c')
      result.current.handleInput('a')
      result.current.handleInput('t')
    })
    expect(callbacks.onAutoRemove).not.toHaveBeenCalled()
    expect(result.current.wordIndex).toBe(0)

    act(() => {
      result.current.handleInput('c')
      result.current.handleInput('a')
      result.current.handleInput('t')
    })
    expect(callbacks.onAutoRemove).toHaveBeenCalledTimes(1)
    expect(callbacks.onAutoRemove).toHaveBeenCalledWith('cat')
    expect(result.current.wordIndex).toBe(1)
  })

  it('重复模式后续轮次出错，即使最终拼对也不自动移除', () => {
    const { result, callbacks } = renderTyping({ wordRepeatCount: 2 })

    act(() => {
      result.current.handleInput('c')
      result.current.handleInput('a')
      result.current.handleInput('t')
    })
    expect(callbacks.onAutoRemove).not.toHaveBeenCalled()

    act(() => {
      result.current.handleInput('c')
      result.current.handleInput('a')
      result.current.handleInput('x')
    })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    act(() => {
      result.current.handleInput('c')
      result.current.handleInput('a')
      result.current.handleInput('t')
    })

    expect(callbacks.onAutoRemove).not.toHaveBeenCalled()
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

describe('useTyping — 音频缓存清理时机', () => {
  it('词表变化（删词）不暂停缓存音频；卸载时才统一清理（回归：修复前清理挂在 [words] 上，删词会掐断正在播放的发音）', () => {
    const pauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    const playSpy = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockImplementation(() => Promise.resolve())
    const loadSpy = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})

    const words = makeWords()
    // soundEnabled=true：挂载即朗读首词并预加载下一词，音频进入缓存
    const { result, rerender, unmount, callbacks } = renderTyping({ soundEnabled: true, words })
    expect(result.current.currentWord.name).toBe('cat')
    const pausesAfterMount = pauseSpy.mock.calls.length

    // 删词：词表变化不应暂停任何缓存音频
    act(() => {
      rerender({
        words: [words[0]],
        soundEnabled: true,
        wordRepeatCount: 1,
        isErrorBookMode: true,
        onWordComplete: callbacks.onWordComplete,
        onAutoRemove: callbacks.onAutoRemove,
        onError: callbacks.onError,
      })
    })
    expect(pauseSpy.mock.calls.length).toBe(pausesAfterMount)

    // 卸载才统一清理缓存音频
    unmount()
    expect(pauseSpy.mock.calls.length).toBeGreaterThan(pausesAfterMount)

    pauseSpy.mockRestore()
    playSpy.mockRestore()
    loadSpy.mockRestore()
  })
})

describe('useTyping — resetKey 换章语义（A1 回归）', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  // 8 词长章 + 1 词短章，模拟 cet4 末章(24 词) → cet4freq 末章(8 词) 的切章场景
  function makeLongWords() {
    return Array.from({ length: 8 }, (_, i) => ({ name: `w${i}`, trans: [], notation: '' }))
  }

  it('resetKey 变化且新词表更短 → 完整重置，不误判为删词（修复前开局即已完成）', () => {
    const long = makeLongWords()
    const short = [{ name: 'hi', trans: [], notation: '' }]
    const { result, rerender } = renderTyping({ words: long, resetKey: 'cet4:9:0' })

    // 跳到长章最后一词并打完 → isFinished、startTime 就位
    act(() => {
      result.current.jumpTo(7)
    })
    act(() => {
      for (const ch of 'w7') result.current.handleInput(ch)
    })
    expect(result.current.isFinished).toBe(true)
    expect(result.current.startTime).not.toBeNull()

    act(() => {
      rerender({ words: short, resetKey: 'cet4freq:9:0' })
    })
    expect(result.current.isFinished).toBe(false)
    expect(result.current.wordIndex).toBe(0)
    expect(result.current.currentWord.name).toBe('hi')
    expect(result.current.startTime).toBeNull()
    expect(result.current.stats).toEqual({
      time: 0,
      inputCount: 0,
      correctCount: 0,
      wpm: 0,
      accuracy: 0,
    })
  })

  it('resetKey 先变、words 后替换（Typing 切章的两步渲染序列）→ 新章更短仍走完整重置', () => {
    const long = makeLongWords()
    const short = [{ name: 'hi', trans: [], notation: '' }]
    const { result, rerender } = renderTyping({ words: long, resetKey: 'd:1:0' })

    act(() => {
      result.current.jumpTo(7)
    })
    act(() => {
      for (const ch of 'w7') result.current.handleInput(ch)
    })
    expect(result.current.isFinished).toBe(true)

    // 第一步：URL 变化 resetKey 先变，词表还是旧章（loading 中）
    act(() => {
      rerender({ words: long, resetKey: 'd:2:0' })
    })
    expect(result.current.isFinished).toBe(false)
    // 第二步：新章词表到达，比旧章短
    act(() => {
      rerender({ words: short, resetKey: 'd:2:0' })
    })
    expect(result.current.isFinished).toBe(false)
    expect(result.current.currentWord.name).toBe('hi')
    expect(result.current.wordIndex).toBe(0)
    expect(result.current.startTime).toBeNull()
  })

  it('同 resetKey 下词表缩短 → 删词语义保留（保留统计，仅清输入）', () => {
    const words = makeWords()
    const { result, rerender } = renderTyping({ words, resetKey: 'd:1:0' })

    act(() => {
      result.current.handleInput('c')
    })
    expect(result.current.startTime).not.toBeNull()

    act(() => {
      rerender({ words: [words[0]], resetKey: 'd:1:0' })
    })
    // 删词分支：startTime/stats 保留（完整重置会把 startTime 打回 null）
    expect(result.current.startTime).not.toBeNull()
    expect(result.current.isFinished).toBe(false)
    expect(result.current.currentInput).toBe('')
    expect(result.current.currentWord.name).toBe('cat')
  })
})

describe('useTyping — 音频分支', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function spyMedia() {
    const pauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    const playSpy = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockImplementation(() => Promise.resolve())
    const loadSpy = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
    return { pauseSpy, playSpy, loadSpy }
  }

  it('soundEnabled=true 开局朗读首词且仅一次；首词打错 300ms 自动清空后不重播（A2 回归）', () => {
    const { playSpy } = spyMedia()
    const { result } = renderTyping({ soundEnabled: true })
    expect(playSpy).toHaveBeenCalledTimes(1) // 挂载朗读 cat

    act(() => {
      result.current.handleInput('x') // 打错 → 启动 300ms 自动清空
    })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(result.current.currentInput).toBe('')
    // 修复前：currentInput 被清空会触发朗读 effect 重跑 → 发音重播
    expect(playSpy).toHaveBeenCalledTimes(1)
  })

  it('开局预加载下一词（load），完成后朗读下一词', () => {
    const { playSpy, loadSpy } = spyMedia()
    const { result } = renderTyping({ soundEnabled: true })
    expect(loadSpy).toHaveBeenCalledTimes(1) // 预加载 words[1] = dog

    act(() => {
      result.current.handleInput('c')
      result.current.handleInput('a')
      result.current.handleInput('t')
    })
    expect(result.current.wordIndex).toBe(1)
    expect(playSpy).toHaveBeenCalledTimes(2) // cat + dog
    // words[2] 不存在 → 不再触发新的 preload
    expect(loadSpy).toHaveBeenCalledTimes(1)
  })

  it('playMediaSafe 被拒（autoplay 拦截）不影响输入推进', () => {
    const { playSpy } = spyMedia()
    playSpy.mockImplementation(() => Promise.reject(new Error('NotAllowedError')))
    const { result, callbacks, unmount } = renderTyping({ soundEnabled: true })

    act(() => {
      result.current.handleInput('c')
      result.current.handleInput('a')
      result.current.handleInput('t')
    })
    // play 拒绝被 playMediaSafe 吞掉，打字推进不受影响
    expect(callbacks.onWordComplete).toHaveBeenCalledWith('cat')
    expect(result.current.wordIndex).toBe(1)
    unmount()
  })
})

describe('useTyping — 完成统计的时间口径（回归 2025392）', () => {
  beforeEach(() => {
    // 显式把 Date 一并 fake（vitest 2 默认 toFake 不含 Date）：
    // 固定系统时钟后 advanceTimersByTime 才能推进 Date.now()，断言值可精确推导
    vi.useFakeTimers({
      toFake: [
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'setImmediate',
        'clearImmediate',
        'Date',
      ],
    })
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  })

  it('跳词直达章尾后单键完成整章：stats.time 走 startTimeRef（0s 兜底为 1），不再算成 Unix 纪元秒数（修复前闭包 startTime 为 null，Date.now()-null ≈ 17.6 亿秒）', () => {
    const long = [
      ...Array.from({ length: 7 }, (_, i) => ({ name: `w${i}`, trans: [], notation: '' })),
      { name: 'x', trans: [], notation: '' }, // 末词单字符：首键即完成整章
    ]
    const { result } = renderTyping({ words: long, resetKey: 'd:9:0' })

    act(() => {
      result.current.jumpTo(7)
    })
    // 唯一的一键：首键 setStartTime 尚未重渲染，完成分支读到的闭包 startTime
    // 还是 null——恰是线上触发「单键完成整章统计天文数字」的序列。
    // 时钟钉死在 2026-01-01，修复前 elapsed = floor(Date.now()/1000) = 1767225600
    act(() => {
      result.current.handleInput('x')
    })
    expect(result.current.isFinished).toBe(true)
    expect(result.current.stats.time).toBe(1) // 修复前：1767225600
    expect(result.current.stats.wpm).toBe(60) // 1 字符 / 1s；修复前：0
  })

  it('单章单词在同一 act 内打完：完成统计读 startTimeRef，不读闭包旧 null（回归）', () => {
    const words = [{ name: 'hi', trans: [], notation: '' }]
    const { result } = renderTyping({ words })

    act(() => {
      result.current.handleInput('h')
      result.current.handleInput('i') // 同一批更新内完成整章，闭包 startTime 仍为 null
    })
    expect(result.current.isFinished).toBe(true)
    // 整章 0s 完成 → 兜底 1；修复前同样是闭包旧 null → 1767225600
    expect(result.current.stats.time).toBe(1)
    expect(result.current.stats.wpm).toBe(120) // 2 字符 / 1s；修复前：0
  })
})

describe('useTyping — 发音缓存上限逐出（回归 2025392）', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('跨章连打缓存达上限后按插入序逐出最旧条目：被逐条目 pause 且 src 置空，缓存内条目不被动（修复前缓存只增不减）', () => {
    // 用桩 Audio 记录每个实例：hook 内部缓存不导出，只能从实例行为观察逐出
    const created = []
    class FakeAudio {
      constructor(src) {
        this.src = src
        this.readyState = 0
        this.pauseCount = 0
        created.push(this)
      }
      load() {}
      pause() {
        this.pauseCount += 1
      }
      play() {
        return Promise.resolve()
      }
    }
    vi.stubGlobal('Audio', FakeAudio)

    // 每章 2 个新词：切章后朗读 words[0] + 预载 words[1]，各入缓存一条
    const chapterWords = (i) => [
      { name: `a${i}`, trans: [], notation: '' },
      { name: `b${i}`, trans: [], notation: '' },
    ]
    const { rerender, unmount, callbacks } = renderTyping({
      words: chapterWords(0),
      soundEnabled: true,
      resetKey: 'd:0:0',
    })
    for (let i = 1; i <= 50; i++) {
      act(() => {
        rerender({
          words: chapterWords(i),
          soundEnabled: true,
          wordRepeatCount: 1,
          isErrorBookMode: true,
          onWordComplete: callbacks.onWordComplete,
          onAutoRemove: callbacks.onAutoRemove,
          onError: callbacks.onError,
          resetKey: `d:${i}:0`,
        })
      })
    }

    // 挂载 2 条 + 50 次切章 × 2 条 = 102 个 Audio；上限 100 → 第 1 章的
    // 两条（最旧）在第 50 次切章时被逐出：pause 一次且 src 清空
    expect(created.length).toBe(102)
    expect(created[0].pauseCount).toBe(1)
    expect(created[0].src).toBe('')
    expect(created[1].pauseCount).toBe(1)
    expect(created[1].src).toBe('')
    // 其余 100 条仍在缓存内：卸载前不被逐出
    for (let i = 2; i < created.length; i++) {
      expect(created[i].pauseCount).toBe(0)
      expect(created[i].src).not.toBe('')
    }

    unmount()
    // 卸载才统一清理：缓存内剩余 100 条全部 pause 一次（被逐出的两条不重复清理）
    for (let i = 2; i < created.length; i++) {
      expect(created[i].pauseCount).toBe(1)
    }
    expect(created[0].pauseCount).toBe(1)
    expect(created[1].pauseCount).toBe(1)
  })
})
