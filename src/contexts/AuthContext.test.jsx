// @vitest-environment jsdom
// AuthContext 测试：会话自检（/me → /refresh 兜底链）、login/logout 状态流转、
// auth:unauthorized 全局登出广播（导航回调）、updateProfile 走 apiFetch、
// Provider 外使用 hook 的报错契约。
// fetch / apiFetch / getDeviceId 全部 mock；VITE_AUTH_ENABLED 未设置 → AUTH_ENABLED=true。
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import React from 'react'

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn(), getDeviceId: vi.fn() }))
vi.mock('../lib/api', () => ({ apiFetch: mocks.apiFetch }))
vi.mock('../utils/getDeviceId', () => ({ getDeviceId: mocks.getDeviceId }))

// 登出必须断开各本地缓存的内存态（跨账号串数据防护）：六个 reset 全 mock，只验证接线
// 登录/会话恢复的五个词本 sync 同理：mock 后只验证接线时机，同步行为在各 util 自己的测试里
const resets = vi.hoisted(() => ({
  resetErrorBookCache: vi.fn(),
  resetReviewCardsCache: vi.fn(),
  resetFavoriteWordsCache: vi.fn(),
  resetReadingWordBookCache: vi.fn(),
  resetCorpusWordBookCache: vi.fn(),
  resetLocalProgressCache: vi.fn(),
  syncErrorBookFromServer: vi.fn(),
  syncReviewCardsFromServer: vi.fn(),
  syncFavoriteWordsFromServer: vi.fn(),
  syncReadingWordBookFromServer: vi.fn(),
  syncCorpusWordBookFromServer: vi.fn(),
}))
vi.mock('../utils/errorBook', () => ({
  resetErrorBookCache: resets.resetErrorBookCache,
  syncErrorBookFromServer: resets.syncErrorBookFromServer,
}))
vi.mock('../utils/reviewCards', () => ({
  resetReviewCardsCache: resets.resetReviewCardsCache,
  syncReviewCardsFromServer: resets.syncReviewCardsFromServer,
}))
vi.mock('../utils/favoriteWords', () => ({
  resetFavoriteWordsCache: resets.resetFavoriteWordsCache,
  syncFavoriteWordsFromServer: resets.syncFavoriteWordsFromServer,
}))
vi.mock('../utils/readingWordBook', () => ({
  resetReadingWordBookCache: resets.resetReadingWordBookCache,
  syncReadingWordBookFromServer: resets.syncReadingWordBookFromServer,
}))
vi.mock('../utils/corpusWordBook', () => ({
  resetCorpusWordBookCache: resets.resetCorpusWordBookCache,
  syncCorpusWordBookFromServer: resets.syncCorpusWordBookFromServer,
}))
vi.mock('../utils/localProgress', () => ({
  resetLocalProgressCache: resets.resetLocalProgressCache,
}))

// 登录/会话恢复后的服务端设置同步（B2）：mock 掉并只验证接线时机，
// 同步本身的行为在 useUserConfig.test.js 覆盖
const sync = vi.hoisted(() => ({ syncSettingsFromServer: vi.fn() }))
vi.mock('../hooks/useUserConfig', () => ({
  syncSettingsFromServer: sync.syncSettingsFromServer,
}))

// 注意：本仓库 .env.local 在本地开发时可能带 VITE_AUTH_ENABLED=false（免登录模式），
// vitest 会加载它；本文件针对「鉴权启用」路径，先强制开启再动态加载被测模块，
// 保证 AUTH_ENABLED 模块常量按 true 求值。
import.meta.env.VITE_AUTH_ENABLED = 'true'
const { AuthProvider, useAuth } = await import('./AuthContext.jsx')

const USER = { id: 7, username: 'alice', nickname: 'Alice' }

function jsonResponse(data, ok = true, status = 200) {
  return { ok, status, json: async () => data }
}

// 网关 502 等场景返回 HTML 正文：res.json() 抛 SyntaxError
function htmlResponse(ok = false, status = 502) {
  return {
    ok,
    status,
    json: async () => {
      throw new SyntaxError(`Unexpected token '<', "<html>..." is not valid JSON`)
    },
  }
}

// 探针：暴露扁平 useAuth 值，并在按钮上挂 action 便于交互驱动
let captured
function Probe() {
  captured = useAuth()
  return (
    <div>
      <div data-testid="state">
        {JSON.stringify({ user: captured.user, loading: captured.loading })}
      </div>
      <button onClick={() => captured.login('alice', 'password1').catch(() => {})}>login</button>
      <button onClick={() => captured.logout()}>logout</button>
    </div>
  )
}

function renderProvider() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  )
}

function getState() {
  return JSON.parse(screen.getByTestId('state').textContent)
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getDeviceId.mockReturnValue('test-device')
  sync.syncSettingsFromServer.mockResolvedValue()
  for (const key of [
    'syncErrorBookFromServer',
    'syncReviewCardsFromServer',
    'syncFavoriteWordsFromServer',
    'syncReadingWordBookFromServer',
    'syncCorpusWordBookFromServer',
  ]) {
    resets[key].mockResolvedValue()
  }
})

describe('会话自检（挂载即拉 /api/auth/me）', () => {
  it('已登录 → user 就位、loading 结束，并触发一次服务端设置同步', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ user: USER }))
    renderProvider()
    await waitFor(() => expect(getState().loading).toBe(false))
    expect(getState().user).toEqual(USER)
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/auth/me', { credentials: 'include' })
    // 恢复会话后拉一次服务端设置（跨设备设置/主题同步）
    await waitFor(() => expect(sync.syncSettingsFromServer).toHaveBeenCalledTimes(1))
  })

  it('access 过期（401）→ 自动 refresh 成功 → 恢复会话并触发设置同步', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'expired' }, false, 401))
      .mockResolvedValueOnce(jsonResponse({ user: USER }))
    renderProvider()
    await waitFor(() => expect(getState().user).toEqual(USER))
    expect(globalThis.fetch).toHaveBeenNthCalledWith(2, '/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    })
    await waitFor(() => expect(sync.syncSettingsFromServer).toHaveBeenCalledTimes(1))
  })

  it('refresh 也失败 → 未登录态（user=null）', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'expired' }, false, 401))
      .mockResolvedValueOnce(jsonResponse({ error: 'no' }, false, 401))
    renderProvider()
    await waitFor(() => expect(getState().loading).toBe(false))
    expect(getState().user).toBeNull()
  })

  it('网络异常 → 不抛错，结束 loading', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network'))
    renderProvider()
    await waitFor(() => expect(getState().loading).toBe(false))
    expect(getState().user).toBeNull()
  })
})

describe('login / logout', () => {
  it('login 成功 → user 就位，body 携带 deviceId', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ user: USER }))
    renderProvider()
    await act(async () => {
      screen.getByText('login').click()
    })
    await waitFor(() => expect(getState().user).toEqual(USER))
    // mock.calls[0] 是挂载会话检查的 /me，login 调用按 URL 检索
    const loginCall = globalThis.fetch.mock.calls.find(([url]) => url === '/api/auth/login')
    const [url, init] = loginCall
    expect(url).toBe('/api/auth/login')
    expect(JSON.parse(init.body)).toMatchObject({ username: 'alice', deviceId: 'test-device' })
  })

  it('login 成功 → 触发服务端设置同步（跨设备设置/主题跟随）', async () => {
    // 挂载会话检查全程 401（未登录），保证 sync 计数只来自 login
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'no' }, false, 401)) // 挂载 /me
      .mockResolvedValueOnce(jsonResponse({ error: 'no' }, false, 401)) // 挂载 /refresh
      .mockResolvedValue(jsonResponse({ user: USER })) // login
    renderProvider()
    await waitFor(() => expect(getState().loading).toBe(false))
    expect(sync.syncSettingsFromServer).not.toHaveBeenCalled()
    await act(async () => {
      screen.getByText('login').click()
    })
    await waitFor(() => expect(getState().user).toEqual(USER))
    expect(sync.syncSettingsFromServer).toHaveBeenCalledTimes(1)
  })

  it('login 失败 → 抛出服务端错误文案，user 保持 null，不触发设置同步', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: '用户名或密码错误' }, false, 401))
    renderProvider()
    await act(async () => {
      screen.getByText('login').click()
    })
    await expect(captured.login('alice', 'wrong1')).rejects.toThrow('用户名或密码错误')
    expect(getState().user).toBeNull()
    expect(sync.syncSettingsFromServer).not.toHaveBeenCalled()
  })

  it('logout → 请求登出端点并清空 user（网络失败也照清）', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ user: USER }))
    renderProvider()
    await act(async () => {
      screen.getByText('login').click()
    })
    await waitFor(() => expect(getState().user).toEqual(USER))

    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network'))
    await act(async () => {
      screen.getByText('logout').click()
    })
    await waitFor(() => expect(getState().user).toBeNull())
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })
  })

  it('logout → 调用全部六个本地缓存 reset，断开旧账号内存态与待写队列（跨账号串数据防护）', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ user: USER }))
    renderProvider()
    await act(async () => {
      screen.getByText('login').click()
    })
    await waitFor(() => expect(getState().user).toEqual(USER))

    await act(async () => {
      screen.getByText('logout').click()
    })
    await waitFor(() => expect(getState().user).toBeNull())
    expect(resets.resetErrorBookCache).toHaveBeenCalledTimes(1)
    expect(resets.resetReviewCardsCache).toHaveBeenCalledTimes(1)
    expect(resets.resetFavoriteWordsCache).toHaveBeenCalledTimes(1)
    expect(resets.resetReadingWordBookCache).toHaveBeenCalledTimes(1)
    expect(resets.resetCorpusWordBookCache).toHaveBeenCalledTimes(1)
    expect(resets.resetLocalProgressCache).toHaveBeenCalledTimes(1)
  })

  it('网关 502 返回 HTML（json 解析失败）→ login 抛出兜底文案而非 SyntaxError', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(htmlResponse())
    renderProvider()
    await waitFor(() => expect(getState().loading).toBe(false))

    await expect(captured.login('alice', 'password1')).rejects.toThrow('登录失败')
    expect(getState().user).toBeNull()
  })
})

describe('auth:unauthorized 全局广播', () => {
  it('事件 → 清空 user 并导航到 /login（replace）', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ user: USER }))
    renderProvider()
    await waitFor(() => expect(getState().user).toEqual(USER))

    const nav = vi.fn()
    act(() => captured.setNavigator(nav))
    act(() => {
      window.dispatchEvent(new Event('auth:unauthorized'))
    })
    await waitFor(() => expect(getState().user).toBeNull())
    expect(nav).toHaveBeenCalledWith('/login', { replace: true })
  })

  it('未注册 navigator → 事件不炸（可选链兜底）', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ user: USER }))
    renderProvider()
    await waitFor(() => expect(getState().user).toEqual(USER))
    await act(async () => {
      expect(() => window.dispatchEvent(new Event('auth:unauthorized'))).not.toThrow()
    })
    await waitFor(() => expect(getState().user).toBeNull())
  })

  it('事件 → 六个本地缓存 reset 全部被调（A3 回归：修复前 401 登出只清 user 不清缓存）', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ user: USER }))
    renderProvider()
    await waitFor(() => expect(getState().user).toEqual(USER))

    act(() => {
      window.dispatchEvent(new Event('auth:unauthorized'))
    })
    await waitFor(() => expect(getState().user).toBeNull())
    expect(resets.resetErrorBookCache).toHaveBeenCalledTimes(1)
    expect(resets.resetReviewCardsCache).toHaveBeenCalledTimes(1)
    expect(resets.resetFavoriteWordsCache).toHaveBeenCalledTimes(1)
    expect(resets.resetReadingWordBookCache).toHaveBeenCalledTimes(1)
    expect(resets.resetCorpusWordBookCache).toHaveBeenCalledTimes(1)
    expect(resets.resetLocalProgressCache).toHaveBeenCalledTimes(1)
  })
})

describe('词本服务端同步接线（A4）', () => {
  it('login 成功 → 五个词本 sync 各触发一次', async () => {
    // 挂载会话检查全程 401（未登录），保证 sync 计数只来自 login
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'no' }, false, 401)) // 挂载 /me
      .mockResolvedValueOnce(jsonResponse({ error: 'no' }, false, 401)) // 挂载 /refresh
      .mockResolvedValue(jsonResponse({ user: USER })) // login
    renderProvider()
    await waitFor(() => expect(getState().loading).toBe(false))

    await act(async () => {
      screen.getByText('login').click()
    })
    await waitFor(() => expect(getState().user).toEqual(USER))
    expect(resets.syncErrorBookFromServer).toHaveBeenCalledTimes(1)
    expect(resets.syncReviewCardsFromServer).toHaveBeenCalledTimes(1)
    expect(resets.syncFavoriteWordsFromServer).toHaveBeenCalledTimes(1)
    expect(resets.syncReadingWordBookFromServer).toHaveBeenCalledTimes(1)
    expect(resets.syncCorpusWordBookFromServer).toHaveBeenCalledTimes(1)
  })

  it('恢复会话成功 → 五个词本 sync 触发一次', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ user: USER }))
    renderProvider()
    await waitFor(() => expect(getState().user).toEqual(USER))
    expect(resets.syncErrorBookFromServer).toHaveBeenCalledTimes(1)
    expect(resets.syncReviewCardsFromServer).toHaveBeenCalledTimes(1)
    expect(resets.syncFavoriteWordsFromServer).toHaveBeenCalledTimes(1)
    expect(resets.syncReadingWordBookFromServer).toHaveBeenCalledTimes(1)
    expect(resets.syncCorpusWordBookFromServer).toHaveBeenCalledTimes(1)
  })

  it('词本 sync 失败 → 静默吞掉，不阻塞登录流程', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'no' }, false, 401))
      .mockResolvedValueOnce(jsonResponse({ error: 'no' }, false, 401))
      .mockResolvedValue(jsonResponse({ user: USER }))
    for (const key of [
      'syncErrorBookFromServer',
      'syncReviewCardsFromServer',
      'syncFavoriteWordsFromServer',
      'syncReadingWordBookFromServer',
      'syncCorpusWordBookFromServer',
    ]) {
      resets[key].mockRejectedValue(new Error('sync down'))
    }
    renderProvider()
    await waitFor(() => expect(getState().loading).toBe(false))

    await act(async () => {
      screen.getByText('login').click()
    })
    await waitFor(() => expect(getState().user).toEqual(USER))
    // allSettled 已吸收 rejection，登录态正常就位
    expect(resets.syncErrorBookFromServer).toHaveBeenCalledTimes(1)
  })

  it('login 失败 → 不触发词本 sync', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'no' }, false, 401))
      .mockResolvedValueOnce(jsonResponse({ error: 'no' }, false, 401))
      .mockResolvedValue(jsonResponse({ error: '用户名或密码错误' }, false, 401))
    renderProvider()
    await waitFor(() => expect(getState().loading).toBe(false))

    await act(async () => {
      await expect(captured.login('alice', 'wrong1')).rejects.toThrow('用户名或密码错误')
    })
    expect(getState().user).toBeNull()
    expect(resets.syncErrorBookFromServer).not.toHaveBeenCalled()
  })
})

describe('apiFetch 通道的方法', () => {
  it('updateProfile 成功 → 更新 user', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ user: USER }))
    mocks.apiFetch.mockResolvedValue(jsonResponse({ user: { ...USER, nickname: '新名' } }))
    renderProvider()
    await waitFor(() => expect(getState().user).toEqual(USER))
    await act(async () => {
      await captured.updateProfile({ nickname: '新名' })
    })
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      '/api/auth/profile',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ nickname: '新名' }) })
    )
    expect(getState().user.nickname).toBe('新名')
  })

  it('updateProfile 失败 → 抛错且 user 不变', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ user: USER }))
    mocks.apiFetch.mockResolvedValue(jsonResponse({ error: '更新失败' }, false, 400))
    renderProvider()
    await waitFor(() => expect(getState().user).toEqual(USER))
    await expect(captured.updateProfile({ nickname: 'x' })).rejects.toThrow('更新失败')
    expect(getState().user).toEqual(USER)
  })

  it('changePassword 失败 → 抛服务端文案', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ user: USER }))
    mocks.apiFetch.mockResolvedValue(jsonResponse({ error: '原密码不正确' }, false, 400))
    renderProvider()
    await waitFor(() => expect(getState().user).toEqual(USER))
    await expect(captured.changePassword('old12345', 'new12345')).rejects.toThrow('原密码不正确')
  })
})

describe('hook 使用契约', () => {
  it('Provider 外使用 useAuth → 抛错', () => {
    // 屏蔽 React 对渲染期异常的报错噪音
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(() => render(<Probe />)).toThrow(/AuthProvider/)
    } finally {
      spy.mockRestore()
    }
  })
})
