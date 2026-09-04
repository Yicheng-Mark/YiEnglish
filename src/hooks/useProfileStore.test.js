// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: {
    user: null,
    updateProfile: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mocks.auth,
}))

// 测试服务端资料同步契约；测试环境默认关闭鉴权，需要在加载模块前显式开启。
import.meta.env.VITE_AUTH_ENABLED = 'true'
const { useProfileStore } = await import('./useProfileStore.js')

beforeEach(() => {
  localStorage.clear()
  mocks.auth.user = null
  mocks.auth.updateProfile.mockClear().mockResolvedValue({})
})

describe('useProfileStore · 头像同步契约', () => {
  it('上传时发送 avatarUrl，并允许服务端 null 清除本地旧头像', async () => {
    const { result, rerender } = renderHook(() => useProfileStore())
    const avatar = 'data:image/jpeg;base64,/9j/2Q=='

    await act(async () => {
      await result.current.setAvatar(avatar)
    })

    expect(result.current.avatar).toBe(avatar)
    expect(JSON.parse(localStorage.getItem('lingoforge_profile')).avatar).toBe(avatar)
    expect(mocks.auth.updateProfile).toHaveBeenCalledWith({ avatarUrl: avatar })

    // 登录/注册的兼容响应若暂时不带头像字段，不应把已有头像误清空。
    mocks.auth.user = { id: 2, nickname: 'Bob' }
    act(() => rerender())
    expect(result.current.avatar).toBe(avatar)

    // 完整资料响应明确返回 null 时才清除，防止 A 的头像泄漏到无头像的 B。
    mocks.auth.user = { avatar: null }
    act(() => rerender())

    expect(result.current.avatar).toBe('')
    expect(JSON.parse(localStorage.getItem('lingoforge_profile')).avatar).toBe('')
  })

  it('昵称与签名一次提交，避免两个完整 user 响应互相覆盖', async () => {
    const { result } = renderHook(() => useProfileStore())

    await act(async () => {
      await result.current.setProfile(' Alice ', 'Keep going')
    })

    expect(mocks.auth.updateProfile).toHaveBeenCalledTimes(1)
    expect(mocks.auth.updateProfile).toHaveBeenCalledWith({
      nickname: 'Alice',
      signature: 'Keep going',
    })
    expect(result.current.nickname).toBe('Alice')
    expect(result.current.signature).toBe('Keep going')
  })

  it('服务端保存失败时拒绝 Promise，且不写入虚假的本地成功状态', async () => {
    mocks.auth.user = { avatar: null }
    mocks.auth.updateProfile.mockRejectedValueOnce(new Error('network'))
    const { result } = renderHook(() => useProfileStore())
    const previousAvatar = result.current.avatar

    await act(async () => {
      await expect(result.current.setAvatar('data:image/jpeg;base64,/9j/2Q==')).rejects.toThrow(
        'network'
      )
    })

    expect(result.current.avatar).toBe(previousAvatar)
  })
})
