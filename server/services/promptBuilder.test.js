// buildSystemPrompt 单元测试：分层拼装（基础身份 + 风格 + 记忆 + 用户上下文）、
// 风格缓存 TTL 内免查库、custom 风格的自定义 prompt 优先、未知风格兜底文案。
// pool 由调用方传入，直接给 fake 对象，无需 require.cache 注入；
// 模块内有 styleCache 模块级状态，每个用例前删除 require.cache 以重置。

import { describe, it, expect, beforeEach, vi } from 'vitest'

const STYLE_ROWS = [
  { style_key: 'friendly', system_prompt: '你是友好导师。' },
  { style_key: 'strict', system_prompt: '你是严格教练。' },
]

function freshBuilder() {
  delete require.cache[require.resolve('./promptBuilder')]
  return require('./promptBuilder')
}

function makePool(rows = STYLE_ROWS) {
  return { execute: vi.fn().mockResolvedValue([rows, []]) }
}

let buildSystemPrompt
beforeEach(() => {
  ;({ buildSystemPrompt } = freshBuilder())
})

describe('buildSystemPrompt', () => {
  it('基础身份 + 风格 prompt 拼装，风格来自 style_modes 表', async () => {
    const out = await buildSystemPrompt(makePool(), { styleKey: 'friendly' })
    expect(out).toContain('智能英语学习助手')
    expect(out).toContain('你是友好导师。')
  })

  it('未知风格 key → 兜底默认文案', async () => {
    const out = await buildSystemPrompt(makePool(), { styleKey: 'nope' })
    expect(out).toContain('你是一位友好的英语学习助手。')
  })

  it('custom 风格 + 非空 customPrompt → 使用 customPrompt 覆盖表内风格', async () => {
    const out = await buildSystemPrompt(makePool(), {
      styleKey: 'custom',
      customPrompt: '  你是海盗英语教练。 ',
    })
    expect(out).toContain('你是海盗英语教练。')
  })

  it('custom 风格但 customPrompt 为空白 → 回退表内风格', async () => {
    const out = await buildSystemPrompt(makePool(), { styleKey: 'custom', customPrompt: '   ' })
    expect(out).toContain('你是一位友好的英语学习助手。')
  })

  it('memories → 追加「已知信息」分节，每条带 (category)', async () => {
    const out = await buildSystemPrompt(makePool(), {
      styleKey: 'friendly',
      memories: [
        { category: 'preference', content: '喜欢简洁回复' },
        { category: 'name', content: '名字是 Alice' },
      ],
    })
    expect(out).toContain('以下是关于这个用户的已知信息')
    expect(out).toContain('- (preference) 喜欢简洁回复')
    expect(out).toContain('- (name) 名字是 Alice')
  })

  it('用户上下文：昵称/性别/自定义名字按序追加', async () => {
    const out = await buildSystemPrompt(makePool(), {
      styleKey: 'friendly',
      userNickname: '小明',
      gender: 'female',
      customName: 'Luna',
    })
    expect(out).toContain('用户昵称：小明')
    expect(out).toContain('你的性别设定：女性')
    expect(out).toContain('你的名字是「Luna」')
  })

  it('未知性别原样透传', async () => {
    const out = await buildSystemPrompt(makePool(), {
      styleKey: 'friendly',
      gender: 'robot',
    })
    expect(out).toContain('你的性别设定：robot')
  })

  it('风格缓存：TTL 内多次构建只查一次库', async () => {
    const pool = makePool()
    await buildSystemPrompt(pool, { styleKey: 'friendly' })
    await buildSystemPrompt(pool, { styleKey: 'strict' })
    expect(pool.execute).toHaveBeenCalledTimes(1)
  })

  it('TTL 过期后重新加载风格表', async () => {
    vi.useFakeTimers()
    try {
      const pool = makePool()
      await buildSystemPrompt(pool, { styleKey: 'friendly' })
      vi.advanceTimersByTime(5 * 60 * 1000 + 1)
      await buildSystemPrompt(pool, { styleKey: 'friendly' })
      expect(pool.execute).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })
})
