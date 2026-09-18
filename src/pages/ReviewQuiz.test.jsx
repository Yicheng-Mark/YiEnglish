// @vitest-environment jsdom
// ReviewQuiz 页面回归测试（对应 commit 81286b1「选择题答题接入 SM-2」）：
// 1) 复习计划词本（bookId=review）的选择题作答推进 SM-2——答对 q=5、答错 q=3，
//    与打字复习同口径；修复前页面直接透传 quiz.handleAnswer，选择题答完到期数不消；
// 2) 重复点击守卫：已答状态下再触发答题回调不双重推进；
// 3) 加载占位：词本数据就位前渲染 spinner，不再出现「第 1/0 题」的空卡片盒子
//    （词典覆盖缺口的出题面防御在 getDueReviewWords，见 reviewCards.test.js；
//    页面侧对应行为是空词本走空状态文案）。
// useQuiz 保持真实实现，验证页面包装器与真实状态机的接线；词本/词卡/音频 IO 全 mock。
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const mocks = vi.hoisted(() => ({
  loadDictionary: vi.fn(),
  updateReviewCard: vi.fn(),
  removeFromReviewCards: vi.fn(),
  removeFromErrorBook: vi.fn(),
}))

vi.mock('../utils/loadDictionary', () => ({ loadDictionary: mocks.loadDictionary }))
vi.mock('../utils/reviewCards', () => ({
  removeFromReviewCards: mocks.removeFromReviewCards,
  updateReviewCard: mocks.updateReviewCard,
}))
vi.mock('../utils/errorBook', () => ({ removeFromErrorBook: mocks.removeFromErrorBook }))
vi.mock('../utils/favoriteWords', () => ({ removeFromFavoriteWords: vi.fn() }))
vi.mock('../utils/readingWordBook', () => ({ removeFromReadingWordBook: vi.fn() }))
vi.mock('../utils/corpusWordBook', () => ({ removeFromCorpusWordBook: vi.fn() }))
// 音频链路 mock 成静音：getAudioContext 返回 null 时 playQuizSound 走
// new AudioContext() 抛错自吞，答题主流程不受影响
vi.mock('../utils/audioContext.js', () => ({
  unlockAudio: vi.fn(),
  getAudioContext: vi.fn(() => null),
}))
// QuizCard 轻量 stub：暴露题干与各选项的 correct 标记，作为断言与交互入口
vi.mock('../components/QuizCard', () => ({
  default: ({ question, onAnswer, selectedOption }) => (
    <div>
      <div data-testid="stem">{question ? question.stem.name : 'none'}</div>
      {(question ? question.options : []).map((opt, i) => (
        <button
          key={i}
          data-testid={`opt-${i}`}
          data-correct={opt.isCorrect ? '1' : '0'}
          disabled={selectedOption !== null}
          onClick={() => onAnswer(i)}
        >
          {Array.isArray(opt.label) ? opt.label.join(',') : String(opt.label)}
        </button>
      ))}
    </div>
  ),
}))

import ReviewQuiz from './ReviewQuiz'

// 9 个词：名字两两编辑距离 > 2（quizGenerator 排除形近干扰词的硬性规则），
// trans 用数组形态对齐复习词本数据源（getDueReviewWords 反查索引得到的 lookup.trans）
const WORDS = [
  { name: 'banana', trans: ['[n] 香蕉'] },
  { name: 'cherry', trans: ['[n] 樱桃'] },
  { name: 'elephant', trans: ['[n] 大象'] },
  { name: 'forest', trans: ['[n] 森林'] },
  { name: 'garden', trans: ['[n] 花园'] },
  { name: 'harbor', trans: ['[n] 港口'] },
  { name: 'island', trans: ['[n] 岛屿'] },
  { name: 'jungle', trans: ['[n] 丛林'] },
  { name: 'kitchen', trans: ['[n] 厨房'] },
]

const REVIEW_DICT = {
  name: '复习计划',
  description: '间隔重复复习',
  chapters: [{ id: 0, name: '第 1 章', words: WORDS }],
}

function renderQuiz(bookId = 'review') {
  return render(
    <MemoryRouter initialEntries={[`/review/quiz/${bookId}?type=en2cn`]}>
      <Routes>
        <Route path="/review/quiz/:bookId" element={<ReviewQuiz />} />
      </Routes>
    </MemoryRouter>
  )
}

async function waitForQuestion() {
  await screen.findByTestId('stem')
  return screen.getByTestId('stem').textContent
}

function optionButton(correct) {
  const btn = screen
    .getAllByTestId(/^opt-/)
    .find((el) => el.dataset.correct === (correct ? '1' : '0'))
  if (!btn) throw new Error(`找不到 ${correct ? '正确' : '错误'}选项`)
  return btn
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.loadDictionary.mockResolvedValue(REVIEW_DICT)
})

describe('ReviewQuiz · 复习词本选择题推进 SM-2', () => {
  it('答对 q=5、答错 q=3（回归：修复前选择题作答不推进记忆曲线）', async () => {
    renderQuiz('review')
    const stem1 = await waitForQuestion()

    fireEvent.click(optionButton(true))
    expect(mocks.updateReviewCard).toHaveBeenCalledTimes(1)
    expect(mocks.updateReviewCard).toHaveBeenCalledWith(stem1, 5)

    // 「跳过」立即切下一题（不依赖 1.2s 自动推进定时器）
    fireEvent.click(screen.getByText('跳过'))
    const stem2 = screen.getByTestId('stem').textContent
    expect(stem2).not.toBe(stem1)

    fireEvent.click(optionButton(false))
    expect(mocks.updateReviewCard).toHaveBeenCalledTimes(2)
    expect(mocks.updateReviewCard).toHaveBeenLastCalledWith(stem2, 3)
  })

  it('同一题已答后重复点击不双重推进（守卫与 useQuiz.handleAnswer 早退条件一致）', async () => {
    renderQuiz('review')
    await waitForQuestion()

    fireEvent.click(optionButton(true))
    // 选项已禁用仍模拟重复事件派发（jsdom 不拦截 disabled 上的程序化 click）
    fireEvent.click(optionButton(true))

    expect(mocks.updateReviewCard).toHaveBeenCalledTimes(1)
    expect(mocks.updateReviewCard).toHaveBeenCalledWith(expect.any(String), 5)
  })

  it('非 review 词本作答不推进 SM-2', async () => {
    renderQuiz('error-book')
    await waitForQuestion()

    fireEvent.click(optionButton(true))
    expect(mocks.updateReviewCard).not.toHaveBeenCalled()
  })
})

describe('ReviewQuiz · 加载与空状态（空卡片防御）', () => {
  it('词本就位前渲染加载占位，不渲染「第 1/0 题」空卡片（回归）', async () => {
    let resolveDict
    mocks.loadDictionary.mockReturnValue(
      new Promise((resolve) => {
        resolveDict = resolve
      })
    )
    renderQuiz('review')

    // 修复前加载期直接渲染题目壳（含跳过按钮），没有占位文案
    expect(screen.getByText('正在加载词汇…')).toBeTruthy()
    expect(screen.queryByText('跳过')).toBeNull()

    await act(async () => {
      resolveDict(REVIEW_DICT)
    })
    expect(await screen.findByTestId('stem')).toBeTruthy()
    expect(screen.getByText('跳过')).toBeTruthy()
  })

  it('词本为空 → 空状态文案而非空白题目', async () => {
    mocks.loadDictionary.mockResolvedValue({
      name: '复习计划',
      description: '间隔重复复习',
      chapters: [],
    })
    renderQuiz('review')

    expect(await screen.findByText('暂无词汇可练习')).toBeTruthy()
    expect(mocks.updateReviewCard).not.toHaveBeenCalled()
  })
})
