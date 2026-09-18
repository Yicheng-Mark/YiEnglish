// @vitest-environment jsdom
// ArticleDetail 阅读页查词链路回归测试（对应 commit 2025392 / 2dd2ab4）：
// 1) 查词 Map 模块级缓存：列表↔文章往返不再每次同步重建 3 万词条 Map
//    （回归锚点：loadWordIndex 在重复进入文章页时只拉取一次）；
// 2) 索引失败回退旧全量逐词典路径，回退结果同样缓存；
// 3) 词库白名单复用 dictWordMap.DICT_IDS（25 部全集）：只收录于专业词典的词
//    在阅读页查词能取到释义——修复前本地手抄 15 部白名单，专业词弹空释义。
// 文章库/词典加载/词弹窗 mock 到最小；useReadingStore、分词与查词纯函数保持真实。
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const mocks = vi.hoisted(() => ({
  loadWordIndex: vi.fn(),
  loadDictionary: vi.fn(),
}))

// 文章 fixture：正文包含 anchor / ocean 两个可点击词
const ARTICLE = vi.hoisted(() => ({
  id: 'a1',
  title: '锚与海',
  enTitle: 'Anchor and Sea',
  cnTitle: '锚与海',
  category: '科技',
  year: 2026,
  region: '测试海域',
  wordCount: 9,
  description: '一篇用于查词链路测试的短文。',
  paragraphs: [{ en: 'The captain dropped the anchor into the ocean.', zh: '船长把锚沉入大海。' }],
}))

vi.mock('../../../utils/dictWordMap.js', async (importOriginal) => {
  const actual = await importOriginal()
  // 只替换数据源 loadWordIndex；DICT_IDS / indexEntryToWord 保持真实实现，
  // 白名单回归才有意义（真实 25 部全集 vs 旧的本地手抄 15 部）
  return { ...actual, loadWordIndex: mocks.loadWordIndex }
})
vi.mock('../../../utils/loadDictionary.js', () => ({ loadDictionary: mocks.loadDictionary }))
vi.mock('../data/mockArticles', () => ({ mockArticles: [ARTICLE] }))
vi.mock('../hooks/useStudyTracker', () => ({ default: () => {} }))
vi.mock('../../../utils/readingWordBook.js', () => ({
  addToReadingWordBook: vi.fn(),
  isInReadingWordBook: vi.fn(() => false),
  removeFromReadingWordBook: vi.fn(),
}))
// 词弹窗 stub：暴露查词结果（词名 + 释义）作为断言点
vi.mock('../../../components/WordPopup.jsx', () => ({
  default: ({ wordData }) => (
    <div data-testid="word-popup">
      {wordData.name}|
      {Array.isArray(wordData.trans) ? wordData.trans.join(';') : String(wordData.trans ?? '')}
    </div>
  ),
}))

// 合并索引 fixture：anchor 只收录于专业词典（nautical），ocean 在主词典（junior）。
// 修复前的本地 15 部白名单不含 nautical → anchor 被过滤、查词拿到空释义
function makeIndex() {
  return {
    anchor: { name: 'anchor', dictIds: ['nautical'], trans: ['[n] 锚；使停泊'] },
    ocean: { name: 'ocean', dictIds: ['junior'], trans: ['[n] 海洋'] },
  }
}

async function renderArticle() {
  // 每个用例重新走模块求值：ArticleDetail 的 articleWordMapCache 是模块级状态，
  // 用例间必须重置（与 useReadingStore.test.js 的 resetModules 惯例一致）
  const { default: ArticleDetail } = await import('./ArticleDetail')
  const utils = render(
    <MemoryRouter initialEntries={['/reading/article/a1']}>
      <Routes>
        <Route path="/reading/article/:id" element={<ArticleDetail />} />
      </Routes>
    </MemoryRouter>
  )
  // 文章库动态 import 就绪（h1 渲染），再冲一把微任务让查词 Map effect 落定
  await screen.findByRole('heading', { level: 1 })
  await act(async () => {})
  return utils
}

function lookup(word) {
  fireEvent.click(screen.getByTitle(word))
  return screen.getByTestId('word-popup').textContent
}

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
  vi.clearAllMocks()
  window.scrollTo = vi.fn() // jsdom 未实现 smooth scroll，静音化
})

describe('ArticleDetail · 查词数据源', () => {
  it('专业词典词（仅 nautical 收录）查词能取到释义（回归：手抄白名单漏专业词典）', async () => {
    mocks.loadWordIndex.mockResolvedValue(makeIndex())
    await renderArticle()

    expect(lookup('anchor')).toContain('[n] 锚')
    expect(lookup('ocean')).toContain('[n] 海洋')
  })

  it('查词 Map 模块级缓存：重进文章页复用，loadWordIndex 只拉一次（回归：每次进入同步重建）', async () => {
    mocks.loadWordIndex.mockResolvedValue(makeIndex())
    const first = await renderArticle()
    // 用主词典词（junior 收录，新旧白名单都覆盖）断言查词，隔离出缓存这一个变量
    expect(lookup('ocean')).toContain('[n] 海洋') // 首次进入构建并缓存
    first.unmount()

    const second = await renderArticle()
    expect(lookup('ocean')).toContain('[n] 海洋') // 二次进入仍可查（缓存命中）
    second.unmount()

    expect(mocks.loadWordIndex).toHaveBeenCalledTimes(1)
  })

  it('索引失败回退全量词典路径，回退结果同样缓存：二次进入不再重拉词典', async () => {
    mocks.loadWordIndex.mockRejectedValue(new Error('word-index 不可用'))
    mocks.loadDictionary.mockResolvedValue({
      chapters: [{ id: 0, words: [{ name: 'ocean', trans: ['[n] 海洋'] }] }],
    })
    const first = await renderArticle()
    expect(lookup('ocean')).toContain('[n] 海洋') // 回退路径查词成功
    const callsAfterFirstMount = mocks.loadDictionary.mock.calls.length
    expect(callsAfterFirstMount).toBeGreaterThan(0)
    first.unmount()

    const second = await renderArticle()
    expect(lookup('ocean')).toContain('[n] 海洋') // 缓存命中，未重拉词典
    second.unmount()

    expect(mocks.loadDictionary.mock.calls.length).toBe(callsAfterFirstMount)
  })
})
