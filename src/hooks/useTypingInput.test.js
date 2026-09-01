// @vitest-environment jsdom
// useTypingInput（IME 合成处理与输入代理）契约测试：
// 追加/替换/退格三路 diff、IME 提交隔离、非 ASCII 污染清理、isFinished 熔断。
// unlockAudio mock 掉以避开 WebAudio。
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ unlockAudio: vi.fn() }))
vi.mock('../utils/audioContext.js', () => ({ unlockAudio: mocks.unlockAudio }))

import useTypingInput from './useTypingInput.js'

function renderInput(overrides = {}) {
  const input = document.createElement('input')
  const hiddenInputRef = { current: input }
  const handleInput = overrides.handleInput ?? vi.fn()
  const result = renderHook(
    ({ isFinished, handleInput }) => useTypingInput({ isFinished, handleInput, hiddenInputRef }),
    { initialProps: { isFinished: overrides.isFinished ?? false, handleInput } }
  )
  return { ...result, handleInput, hiddenInputRef, input }
}

// 构造 onChange 事件（inputType 可选）
function changeEvent(value, inputType) {
  const e = { target: { value }, nativeEvent: inputType ? { inputType } : undefined }
  return e
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('handleCharacterInput / handleBackspace', () => {
  it('正常输入 → unlockAudio + 转发单字符', () => {
    const { result, handleInput } = renderInput()
    act(() => result.current.handleCharacterInput('a'))
    expect(mocks.unlockAudio).toHaveBeenCalled()
    expect(handleInput).toHaveBeenCalledWith('a')
  })

  it('isFinished → 输入与退格均熔断', () => {
    const { result, handleInput } = renderInput({ isFinished: true })
    act(() => result.current.handleCharacterInput('a'))
    act(() => result.current.handleBackspace())
    expect(handleInput).not.toHaveBeenCalled()
  })

  it('handleBackspace → 转发 "Backspace"', () => {
    const { result, handleInput } = renderInput()
    act(() => result.current.handleBackspace())
    expect(handleInput).toHaveBeenCalledWith('Backspace')
  })
})

describe('handleInputChange · diff 三路', () => {
  it('追加模式：拼音增长，逐字转发新增后缀', () => {
    const { result, handleInput } = renderInput()
    act(() => result.current.handleInputChange(changeEvent('ab')))
    expect(handleInput).toHaveBeenCalledTimes(2)
    expect(handleInput).toHaveBeenNthCalledWith(1, 'a')
    expect(handleInput).toHaveBeenNthCalledWith(2, 'b')
  })

  it('追加后缀含中文 → 仅英文字母（含空格）通过', () => {
    const { result, handleInput } = renderInput()
    // old='' new='中a b'：后缀 '中a b' → 过滤为 'a b'
    act(() => result.current.handleInputChange(changeEvent('中a b')))
    expect(handleInput).toHaveBeenCalledTimes(3)
    expect(handleInput).toHaveBeenNthCalledWith(1, 'a')
    expect(handleInput).toHaveBeenNthCalledWith(2, ' ')
    expect(handleInput).toHaveBeenNthCalledWith(3, 'b')
  })

  it('替换模式：中文被全字母新值替换 → 处理整个新值', () => {
    const { result, handleInput } = renderInput()
    act(() => result.current.handleInputChange(changeEvent('个'))) // 追踪值变为 '个'
    handleInput.mockClear()
    act(() => result.current.handleInputChange(changeEvent('l')))
    expect(handleInput).toHaveBeenCalledWith('l')
  })

  it('退格模式：新值是旧值前缀 → 触发一次退格', () => {
    const { result, handleInput } = renderInput()
    act(() => result.current.handleInputChange(changeEvent('abc')))
    handleInput.mockClear()
    act(() => result.current.handleInputChange(changeEvent('ab')))
    expect(handleInput).toHaveBeenCalledTimes(1)
    expect(handleInput).toHaveBeenCalledWith('Backspace')
  })

  it('缩短但非前缀（IME 提交形态）→ 不触发退格', () => {
    const { result, handleInput } = renderInput()
    act(() => result.current.handleInputChange(changeEvent('abc')))
    handleInput.mockClear()
    act(() => result.current.handleInputChange(changeEvent('xyz')))
    expect(handleInput).not.toHaveBeenCalled()
  })

  it('IME 合成中缩短 → 不触发退格', () => {
    const { result, handleInput } = renderInput()
    act(() => result.current.handleInputChange(changeEvent('abc')))
    handleInput.mockClear()
    act(() => result.current.handleCompositionStart())
    act(() => result.current.handleInputChange(changeEvent('ab', 'insertCompositionText')))
    expect(handleInput).not.toHaveBeenCalled()
  })
})

describe('IME 提交隔离与污染清理', () => {
  it('compositionEnd 提交字母串 → 直接逐字处理，后续 onChange 被隔离', () => {
    const { result, handleInput } = renderInput()
    act(() => {
      result.current.handleCompositionEnd({ data: 'ok' })
    })
    expect(handleInput).toHaveBeenCalledTimes(2)
    handleInput.mockClear()

    // 提交后的 onChange（携带中文提交字符）→ 隔离：不 diff、清空 input
    act(() => {
      result.current.handleInputChange(changeEvent('个'))
    })
    expect(handleInput).not.toHaveBeenCalled()
    expect(result.current.inputValueRef.current).toBe('')
  })

  it('compositionEnd 提交中文 → 不处理字符，仅置隔离标记', () => {
    const { result, handleInput } = renderInput()
    act(() => {
      result.current.handleCompositionEnd({ data: '个' })
    })
    expect(handleInput).not.toHaveBeenCalled()
    expect(result.current.justCommittedRef.current).toBe(true)
  })

  it('compositionStart 清除过期的提交标记', () => {
    const { result } = renderInput()
    result.current.justCommittedRef.current = true
    act(() => result.current.handleCompositionStart())
    expect(result.current.isComposingRef.current).toBe(true)
    expect(result.current.justCommittedRef.current).toBe(false)
  })

  it('追踪值被中文污染（非合成中）→ 重置输入框', () => {
    const { result, input } = renderInput()
    input.value = '你好'
    act(() => result.current.handleInputChange(changeEvent('你好')))
    // 追加模式下中文后缀无字母可转发，随后污染清理重置
    expect(result.current.inputValueRef.current).toBe('')
    expect(input.value).toBe('')
  })
})

describe('handleInputRef 与 isFinished 动态切换', () => {
  it('rerender 后 ref 指向最新 handleInput', () => {
    const { result, rerender } = renderInput()
    const newHandle = vi.fn()
    act(() => rerender({ isFinished: false, handleInput: newHandle }))
    act(() => result.current.handleCharacterInput('z'))
    expect(newHandle).toHaveBeenCalledWith('z')
  })

  it('isFinished 由 false → true 后熔断', () => {
    const { result, rerender, handleInput } = renderInput()
    act(() => rerender({ isFinished: true, handleInput }))
    act(() => result.current.handleCharacterInput('a'))
    act(() => result.current.handleInputChange(changeEvent('ab')))
    expect(handleInput).not.toHaveBeenCalled()
  })
})
