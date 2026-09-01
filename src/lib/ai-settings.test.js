// @vitest-environment jsdom
// ai-settings 测试：悬浮球位置/隐藏态本地存取、风格 API 封装（成功/失败/降级缓存）、
// 聊天历史、每日额度 fetchChatUsage 的三态（ok/error/forbidden）、deriveUsageUI 派生。
// stylesCache 为模块级状态，相关用例用 vi.resetModules 取干净实例。
import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }))
vi.mock('./api', () => ({ apiFetch: mocks.apiFetch }))

async function loadModule() {
  vi.resetModules()
  return import('./ai-settings.js')
}

function jsonResponse(data, ok = true, status = 200) {
  return { ok, status, json: async () => data }
}

beforeEach(() => {
  localStorage.clear()
  mocks.apiFetch.mockReset()
})

describe('悬浮球本地状态', () => {
  it('getPosition 无存档 → 按视口右下角兜底', async () => {
    const m = await loadModule()
    const pos = m.getPosition()
    expect(pos).toEqual({ x: window.innerWidth - 80, y: window.innerHeight - 140 })
  })

  it('getPosition 有合法 JSON → 读取存档；损坏 JSON → 兜底', async () => {
    localStorage.setItem('lingoforge_ai_position', JSON.stringify({ x: 1, y: 2 }))
    const m = await loadModule()
    expect(m.getPosition()).toEqual({ x: 1, y: 2 })

    localStorage.setItem('lingoforge_ai_position', '{broken')
    expect(m.getPosition()).toEqual({ x: window.innerWidth - 80, y: window.innerHeight - 140 })
  })

  it('setAIAssistantHidden → 写入并广播 ai-visibility-change', async () => {
    const m = await loadModule()
    const listener = vi.fn()
    window.addEventListener('ai-visibility-change', listener)
    m.setAIAssistantHidden(false)
    expect(localStorage.getItem('lingoforge_ai_hidden')).toBe('false')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(m.isAIAssistantHidden()).toBe(false)

    m.setAIAssistantHidden(true)
    expect(localStorage.getItem('lingoforge_ai_hidden')).toBe('true')
    expect(m.isAIAssistantHidden()).toBe(true)
  })

  it('isAIAssistantHidden 默认隐藏（仅 "false" 视为显示）', async () => {
    const m = await loadModule()
    expect(m.isAIAssistantHidden()).toBe(true)
    localStorage.setItem('lingoforge_ai_hidden', 'false')
    expect(m.isAIAssistantHidden()).toBe(false)
  })
})

describe('fetchStyles', () => {
  it('成功 → 返回数据并缓存', async () => {
    mocks.apiFetch.mockResolvedValueOnce(
      jsonResponse({ current: { style_key: 'cute' }, all: [{ style_key: 'cute' }] })
    )
    const m = await loadModule()
    const data = await m.fetchStyles()
    expect(data.current.style_key).toBe('cute')
  })

  it('首次失败 → 内置默认风格兜底', async () => {
    mocks.apiFetch.mockRejectedValueOnce(new Error('network'))
    const m = await loadModule()
    const data = await m.fetchStyles()
    expect(data.current.style_key).toBe('teacher')
    expect(data.all.map((s) => s.style_key)).toEqual(['teacher', 'cute', 'gentle', 'custom'])
  })

  it('成功缓存后失败 → 返回缓存而非默认值', async () => {
    mocks.apiFetch.mockResolvedValueOnce(
      jsonResponse({ current: { style_key: 'cute' }, all: [{ style_key: 'cute' }] })
    )
    const m = await loadModule()
    await m.fetchStyles()
    mocks.apiFetch.mockRejectedValueOnce(new Error('network'))
    const data = await m.fetchStyles()
    expect(data.current.style_key).toBe('cute')
  })
})

describe('写操作封装（switchStyle 等）', () => {
  it.each([
    ['switchStyle', '/api/style', 'POST', { styleKey: 'cute' }],
    ['updateCustomName', '/api/style/name', 'PATCH', { customName: 'Luna' }],
    ['updateGender', '/api/style/gender', 'PATCH', { gender: 'female' }],
    ['updateCustomPrompt', '/api/style/custom-prompt', 'PATCH', { customPrompt: 'x' }],
    ['resetStyleSettings', '/api/style/reset', 'POST', undefined],
    ['resetPersonality', '/api/style/reset-personality', 'POST', undefined],
    ['clearMemory', '/api/chat/clear-memory', 'POST', undefined],
  ])('%s → 成功返回数据，失败抛服务端错误', async (fn, url, method, body) => {
    const m = await loadModule()
    mocks.apiFetch.mockResolvedValueOnce(jsonResponse({ success: true }))
    await expect(m[fn](body && Object.values(body)[0])).resolves.toEqual({ success: true })
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      url,
      expect.objectContaining({ method, ...(body ? { body: JSON.stringify(body) } : {}) })
    )

    mocks.apiFetch.mockResolvedValueOnce(jsonResponse({ error: '服务端拒绝' }, false, 400))
    await expect(m[fn](body && Object.values(body)[0])).rejects.toThrow('服务端拒绝')
  })

  it('失败且响应体非 JSON → 抛含状态码的通用错误', async () => {
    const m = await loadModule()
    mocks.apiFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('html')),
    })
    await expect(m.switchStyle('cute')).rejects.toThrow('切换失败 (500)')
  })
})

describe('fetchChatHistory', () => {
  it('成功 → 返回消息数组', async () => {
    mocks.apiFetch.mockResolvedValueOnce(jsonResponse({ messages: [{ role: 'user' }] }))
    const m = await loadModule()
    expect(await m.fetchChatHistory()).toEqual([{ role: 'user' }])
    expect(mocks.apiFetch).toHaveBeenCalledWith('/api/chat/history?limit=50')
  })

  it('失败 → 返回空数组', async () => {
    mocks.apiFetch.mockRejectedValueOnce(new Error('network'))
    const m = await loadModule()
    expect(await m.fetchChatHistory()).toEqual([])
  })
})

describe('fetchChatUsage（三态语义，回归：失败不得伪装成 0/0 用完）', () => {
  it('正常 → ok 且透传 used/limit/remaining', async () => {
    mocks.apiFetch.mockResolvedValueOnce(jsonResponse({ used: 3, limit: 10, remaining: 7 }))
    const m = await loadModule()
    expect(await m.fetchChatUsage()).toEqual({ status: 'ok', used: 3, limit: 10, remaining: 7 })
  })

  it('网络/刷新失败 → error（不锁死 UI）', async () => {
    mocks.apiFetch.mockRejectedValueOnce(new Error('network'))
    const m = await loadModule()
    expect(await m.fetchChatUsage()).toEqual({ status: 'error' })
  })

  it('403 TRIAL_FORBIDDEN → forbidden', async () => {
    mocks.apiFetch.mockResolvedValueOnce(jsonResponse({ code: 'TRIAL_FORBIDDEN' }, false, 403))
    const m = await loadModule()
    expect(await m.fetchChatUsage()).toEqual({ status: 'forbidden' })
  })

  it('其他 4xx/5xx → error', async () => {
    mocks.apiFetch.mockResolvedValueOnce(jsonResponse({ error: 'x' }, false, 500))
    const m = await loadModule()
    expect(await m.fetchChatUsage()).toEqual({ status: 'error' })
  })

  it('响应体为 HTML（json 解析失败）或字段缺失 → error', async () => {
    const m = await loadModule()
    mocks.apiFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.reject(new Error('html')),
    })
    expect(await m.fetchChatUsage()).toEqual({ status: 'error' })

    mocks.apiFetch.mockResolvedValueOnce(jsonResponse({ used: 1 })) // 缺 limit/remaining
    expect(await m.fetchChatUsage()).toEqual({ status: 'error' })
  })
})

describe('deriveUsageUI', () => {
  it('ok 有余量 → 可输入，提示剩余次数', async () => {
    const m = await loadModule()
    const ui = m.deriveUsageUI({ status: 'ok', remaining: 5, limit: 10 }, '小雅')
    expect(ui).toMatchObject({
      placeholder: '和 小雅 对话...',
      hint: '剩余 5/10 次',
      inputDisabled: false,
      sendDisabled: false,
      retryable: false,
    })
  })

  it('ok 余量 0 → 禁用输入', async () => {
    const m = await loadModule()
    const ui = m.deriveUsageUI({ status: 'ok', remaining: 0, limit: 10 })
    expect(ui.inputDisabled).toBe(true)
    expect(ui.placeholder).toBe('今日对话次数已用完')
  })

  it('forbidden → 禁用并提示正式账号功能', async () => {
    const m = await loadModule()
    const ui = m.deriveUsageUI({ status: 'forbidden' })
    expect(ui.inputDisabled).toBe(true)
    expect(ui.hint).toBe('正式账号功能')
  })

  it('error → 不禁用但可重试', async () => {
    const m = await loadModule()
    const ui = m.deriveUsageUI({ status: 'error' })
    expect(ui.inputDisabled).toBe(false)
    expect(ui.retryable).toBe(true)
    expect(ui.hint).toBe('次数加载失败 · 点击重试')
  })

  it('loading/缺省 → 可输入、hint 加载中', async () => {
    const m = await loadModule()
    expect(m.deriveUsageUI(null)).toMatchObject({ inputDisabled: false, hint: '加载中…' })
    expect(m.deriveUsageUI({})).toMatchObject({ hint: '加载中…' })
  })
})
