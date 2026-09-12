// @vitest-environment jsdom
// Typing 页面 smoke 测试：依赖重（路由/词典加载/7 个 hook/8 个组件），全部 mock 到能跑通
// 渲染与输入链路即可，不求全覆盖。useTyping 保持真实实现，验证「空词表不崩、
// 完成后服务端进度恰好上报一次、词表缩短不越界」三条主干路径。
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const mocks = vi.hoisted(() => ({
  loadDictionary: vi.fn(),
  saveProgress: vi.fn(),
  removeFromErrorBook: vi.fn(),
}))

vi.mock('../utils/loadDictionary.js', () => ({ loadDictionary: mocks.loadDictionary }))
vi.mock('../lib/api.js', () => ({ saveProgress: mocks.saveProgress }))
vi.mock('../utils/playMediaSafe.js', () => ({ playMediaSafe: vi.fn() }))
vi.mock('../utils/errorBook.js', () => ({
  addToErrorBook: vi.fn(),
  getErrorBookCount: vi.fn(() => 0),
  removeFromErrorBook: mocks.removeFromErrorBook,
}))
vi.mock('../utils/readingWordBook.js', () => ({
  getReadingWordBookCount: vi.fn(() => 0),
  removeFromReadingWordBook: vi.fn(),
}))
vi.mock('../utils/corpusWordBook.js', () => ({
  getCorpusWordBookCount: vi.fn(() => 0),
  removeFromCorpusWordBook: vi.fn(),
}))
vi.mock('../utils/favoriteWords.js', () => ({
  getFavoriteWordsCount: vi.fn(() => 0),
  removeFromFavoriteWords: vi.fn(),
}))
vi.mock('../utils/localProgress.js', () => ({ saveLocalProgress: vi.fn() }))
vi.mock('../utils/reviewCards.js', () => ({
  addWordToReview: vi.fn(),
  updateReviewCard: vi.fn(),
}))
vi.mock('../dictionaries/meta.js', () => ({ getMeta: vi.fn((id) => ({ name: id })) }))

vi.mock('../hooks/useUserConfig.js', () => ({
  useUserConfig: () => ({
    config: {
      soundEnabled: false,
      wordRepeatCount: 1,
      autoRemoveErrorWord: true,
      showPhonetic: false,
      showTranslation: false,
      hideEnglish: false,
    },
    toggleConfig: vi.fn(),
    updateConfig: vi.fn(),
    theme: 'light',
    setTheme: vi.fn(),
  }),
}))
vi.mock('../hooks/useErrorTracking.js', () => ({ default: () => ({ onError: vi.fn() }) }))
vi.mock('../hooks/useIsMobile.js', () => ({ default: () => false }))
vi.mock('../hooks/useVirtualKeyboard.js', () => ({
  default: () => ({ keyboardHeight: 0, viewportHeight: null }),
}))
// 输入代理直通真实 useTyping.handleInput，保留完整输入判定链路
vi.mock('../hooks/useTypingInput.js', () => ({
  default: ({ handleInput }) => ({
    isComposingRef: { current: false },
    justCommittedRef: { current: false },
    inputValueRef: { current: '' },
    handleCharacterInput: (key) => handleInput(key),
    handleBackspace: () => handleInput('Backspace'),
    handleInputChange: () => {},
    handleCompositionStart: () => {},
    handleCompositionEnd: () => {},
  }),
}))
vi.mock('../hooks/useTypingGestures.js', () => ({
  default: () => ({
    touchStartRef: { current: null },
    suppressClickRef: { current: false },
    handleTouchStart: vi.fn(),
    handleTouchEnd: vi.fn(),
  }),
}))
vi.mock('../hooks/useProgressSync.js', () => ({
  default: () => ({ isCurrentWordFavorited: false, handleToggleFavorite: vi.fn() }),
}))
vi.mock('../modules/reading/hooks/useReadingStore.js', () => ({
  getReadingStoreActions: () => ({ addTypingSeconds: vi.fn() }),
}))
vi.mock('../contexts/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { id: 1, username: 'tester' } }),
}))

// 组件全部换轻量 stub：WordDisplay/ResultModal/TypingToolbar 暴露断言点与交互入口
vi.mock('../components/WordDisplay.jsx', () => ({
  default: ({ word }) => <div>{word ? `WORD:${word.name}` : 'no-word'}</div>,
}))
vi.mock('../components/ResultModal.jsx', () => ({
  default: () => <div>RESULT-MODAL</div>,
}))
vi.mock('../components/TypingToolbar.jsx', () => ({
  default: ({ onDeleteCurrentWord }) => (
    <button onClick={onDeleteCurrentWord}>delete-current</button>
  ),
}))
vi.mock('../components/StatsPanel.jsx', () => ({ default: () => null }))
vi.mock('../components/WrongBookModal.jsx', () => ({ default: () => null }))
vi.mock('../components/WordListPanel.jsx', () => ({ default: () => null }))
vi.mock('../components/NextWordPreview.jsx', () => ({ default: () => null }))
vi.mock('../components/EmptyState.jsx', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

import Typing from './Typing.jsx'

function makeDict(chapters) {
  return { chapters }
}

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/typing/:dictId/:chapterId" element={<Typing />} />
      </Routes>
    </MemoryRouter>
  )
}

// 桌面端 window keydown → useTypingInput → handleInput 直通链
function typeKeys(keys) {
  for (const key of keys) {
    fireEvent.keyDown(window, { key })
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.saveProgress.mockResolvedValue()
})

describe('Typing 页面 smoke', () => {
  it('章节不存在/词表为空 → 显示错误态，不崩溃', async () => {
    mocks.loadDictionary.mockResolvedValue(makeDict([]))
    renderAt('/typing/cet4/99')
    await waitFor(() => expect(screen.getByText('章节不存在或为空')).toBeTruthy())
  })

  it('loadDictionary 返回 null → 显示加载失败，不崩溃', async () => {
    mocks.loadDictionary.mockResolvedValue(null)
    renderAt('/typing/cet4/0')
    await waitFor(() => expect(screen.getByText('加载失败')).toBeTruthy())
  })

  it('打完一章 → flushServerProgress 恰好触发一次服务端进度上报（有下一章的完成路径）', async () => {
    mocks.loadDictionary.mockResolvedValue(
      makeDict([
        { id: 1, words: [{ name: 'cat', trans: ['猫'] }] },
        { id: 2, words: [{ name: 'dog', trans: ['狗'] }] },
      ])
    )
    const { unmount } = renderAt('/typing/cet4/1')
    await waitFor(() => expect(screen.getByText('WORD:cat')).toBeTruthy())

    typeKeys(['c', 'a', 't'])
    // 完成后（有下一章 → 不弹结算，头部显示已完成），缓冲的 1 个词由完成 effect
    // 兜底冲刷上报一次
    await waitFor(() => expect(mocks.saveProgress).toHaveBeenCalledWith('cet4', 1, ['cat']))
    // 卸载兜底 flush 时缓冲已空，不再二次上报
    unmount()
    expect(mocks.saveProgress).toHaveBeenCalledTimes(1)
  })

  it('词本打字中删词 → 词表缩短不越界，自动落到剩余词（A1 删词语义经真实组件链路）', async () => {
    mocks.loadDictionary.mockResolvedValue(
      makeDict([
        {
          id: 0,
          words: [
            { name: 'cat', trans: ['猫'] },
            { name: 'dog', trans: ['狗'] },
          ],
        },
      ])
    )
    renderAt('/typing/error-book/0')
    await waitFor(() => expect(screen.getByText('WORD:cat')).toBeTruthy())

    typeKeys(['c', 'a', 't']) // 完成 cat → 推进到 dog
    await waitFor(() => expect(screen.getByText('WORD:dog')).toBeTruthy())

    fireEvent.click(screen.getByText('delete-current')) // 删除当前词 dog
    await waitFor(() => expect(screen.getByText('WORD:cat')).toBeTruthy())
    expect(mocks.removeFromErrorBook).toHaveBeenCalledWith('dog')
  })
})
