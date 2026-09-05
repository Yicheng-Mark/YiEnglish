// copyText 测试：Clipboard API 优先（需 secure context），不可用或失败时回退
// execCommand 的 textarea 方案；两条路都失败返回 false 而非抛错（调用方据此决定提示文案）。
// vitest 全局为 node 环境，手动 stub navigator/window/document。
import { describe, it, expect, afterEach, vi } from 'vitest'
import { copyText } from './clipboard.js'

function makeDocumentStub({ execCommandImpl } = {}) {
  const textarea = { value: '', style: {}, focus: vi.fn(), select: vi.fn() }
  const doc = {
    createElement: vi.fn(() => textarea),
    body: { appendChild: vi.fn(), removeChild: vi.fn() },
    execCommand: vi.fn(execCommandImpl),
  }
  return { textarea, doc }
}

function stubEnv({ clipboard, isSecureContext = true, doc }) {
  vi.stubGlobal('navigator', { clipboard })
  vi.stubGlobal('window', { isSecureContext })
  vi.stubGlobal('document', doc)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Clipboard API 成功路径', () => {
  it('secure context + clipboard 可用 → writeText 成功返回 true，不走 legacy 方案', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const { doc } = makeDocumentStub()
    stubEnv({ clipboard: { writeText }, doc })

    await expect(copyText('hello')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('hello')
    expect(doc.createElement).not.toHaveBeenCalled()
    expect(doc.execCommand).not.toHaveBeenCalled()
  })
})

describe('回退 execCommand', () => {
  it('navigator.clipboard 不存在 → 建 textarea 并 execCommand 成功', async () => {
    const { textarea, doc } = makeDocumentStub({ execCommandImpl: () => true })
    stubEnv({ clipboard: undefined, doc })

    await expect(copyText('hi')).resolves.toBe(true)
    expect(textarea.value).toBe('hi')
    expect(textarea.focus).toHaveBeenCalled()
    expect(textarea.select).toHaveBeenCalled()
    expect(doc.body.appendChild).toHaveBeenCalledWith(textarea)
    expect(doc.body.removeChild).toHaveBeenCalledWith(textarea)
    expect(doc.execCommand).toHaveBeenCalledWith('copy')
  })

  it('非 secure context（window.isSecureContext=false）→ 即使 clipboard 存在也回退', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const { doc } = makeDocumentStub({ execCommandImpl: () => true })
    stubEnv({ clipboard: { writeText }, isSecureContext: false, doc })

    await expect(copyText('hi')).resolves.toBe(true)
    expect(writeText).not.toHaveBeenCalled()
    expect(doc.execCommand).toHaveBeenCalledWith('copy')
  })

  it('writeText reject（iOS<13.4 等）→ 落到 legacy 方案成功', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('NotAllowedError'))
    const { doc } = makeDocumentStub({ execCommandImpl: () => true })
    stubEnv({ clipboard: { writeText }, doc })

    await expect(copyText('hi')).resolves.toBe(true)
    expect(doc.execCommand).toHaveBeenCalledWith('copy')
  })
})

describe('两条路都失败', () => {
  it('execCommand 返回 false（浏览器不支持）→ 返回 false 且清理 textarea', async () => {
    const { textarea, doc } = makeDocumentStub({ execCommandImpl: () => false })
    stubEnv({ clipboard: undefined, doc })

    await expect(copyText('hi')).resolves.toBe(false)
    expect(doc.body.removeChild).toHaveBeenCalledWith(textarea)
  })

  it('execCommand 抛错 → 被吞掉返回 false（绝不向上抛）', async () => {
    const { doc } = makeDocumentStub({
      execCommandImpl: () => {
        throw new Error('not supported')
      },
    })
    stubEnv({ clipboard: undefined, doc })

    await expect(copyText('hi')).resolves.toBe(false)
  })

  it('writeText reject + execCommand 也抛错 → 返回 false 而非 reject', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('no api'))
    const { doc } = makeDocumentStub({
      execCommandImpl: () => {
        throw new Error('no cmd')
      },
    })
    stubEnv({ clipboard: { writeText }, doc })

    await expect(copyText('hi')).resolves.toBe(false)
  })
})
