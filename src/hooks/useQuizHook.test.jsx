// @vitest-environment jsdom
// useQuiz 状态机回归测试。纯出题逻辑在 useQuiz.test.js 覆盖；这里聚焦
// 答题、移词和自动推进之间的状态一致性。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import useQuiz from './useQuiz.js'

const WORDS = [
  { name: 'apple', trans: ['[n] 苹果'] },
  { name: 'banana', trans: ['[n] 香蕉'] },
]
const QUESTION_TYPES = ['en2cn']

function renderQuiz() {
  return renderHook(
    ({ words }) =>
      useQuiz(words, {
        questionTypes: QUESTION_TYPES,
        questionsPerSession: 2,
      }),
    { initialProps: { words: WORDS } }
  )
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('useQuiz · 移除当前词', () => {
  it('答对后、自动推进前移词时同步回退分数，正确率不会超过 100%', () => {
    const { result, rerender } = renderQuiz()
    const removedName = result.current.currentQuestion.stem.name

    act(() => {
      result.current.handleAnswer(result.current.currentQuestion.correctIndex)
    })
    expect(result.current.score).toBe(1)
    expect(result.current.isCorrect).toBe(true)

    act(() => {
      result.current.removeWord(removedName)
    })
    expect(result.current.totalQuestions).toBe(1)
    expect(result.current.score).toBe(0)

    // 模拟页面随后从词本状态中删除该词；hook 应保留已经过滤后的题目。
    act(() => {
      rerender({ words: WORDS.filter((word) => word.name !== removedName) })
    })
    expect(result.current.totalQuestions).toBe(1)

    act(() => {
      result.current.handleAnswer(result.current.currentQuestion.correctIndex)
    })
    act(() => {
      vi.advanceTimersByTime(1200)
    })

    expect(result.current.isFinished).toBe(true)
    expect(result.current.score).toBe(1)
    expect(result.current.score).toBeLessThanOrEqual(result.current.totalQuestions)
  })

  it('答错后移除当前词不会误减已有分数', () => {
    const { result } = renderQuiz()
    const question = result.current.currentQuestion
    const wrongIndex = question.options.findIndex((option) => !option.isCorrect)

    act(() => {
      result.current.handleAnswer(wrongIndex)
    })
    expect(result.current.score).toBe(0)

    act(() => {
      result.current.removeWord(question.stem.name)
    })

    expect(result.current.totalQuestions).toBe(1)
    expect(result.current.score).toBe(0)
  })
})
