// @vitest-environment jsdom
// idb 包装层测试：open 失败后可重试（回归：rejected promise 曾被永久缓存，
// Safari 隐私模式下整个会话的所有 IDB 操作都会失败）、写入以事务提交为准。
// jsdom 不带 IndexedDB 实现，用手写的最小 fake 覆盖被测路径。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// 可编程的 indexedDB.open：每个用例自行设置行为
let openBehavior = null

function makeOpenRequest({ fail } = {}) {
  const req = { onupgradeneeded: null, onsuccess: null, onerror: null, result: null }
  queueMicrotask(() => {
    if (fail) {
      req.error = fail
      req.onerror && req.onerror({ target: req })
    } else {
      req.onsuccess && req.onsuccess({ target: req })
    }
  })
  return req
}

function makeFakeDb() {
  return {
    transaction() {
      const tx = {
        oncomplete: null,
        onerror: null,
        onabort: null,
        objectStore() {
          return {
            put() {},
            delete() {},
            clear() {},
          }
        },
      }
      // 默认行为：事务异步提交成功（个别用例按需覆盖 transaction 覆盖此行为）
      queueMicrotask(() => tx.oncomplete && tx.oncomplete())
      return tx
    },
  }
}

beforeEach(() => {
  vi.resetModules()
  openBehavior = null
  vi.stubGlobal('indexedDB', {
    open: () => openBehavior(),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getIDB / idbPut', () => {
  it('open 失败后缓存被清除，下次调用可重试成功（回归）', async () => {
    const { idbPut } = await import('./idb.js')

    // 第一次：open 失败（如 Safari 隐私模式）
    openBehavior = () => makeOpenRequest({ fail: new Error('IDB blocked') })
    await expect(idbPut('errorBook', { name: 'a' })).rejects.toThrow('IDB blocked')

    // 第二次：环境恢复后 open 成功 → 不再被 rejected promise 卡死
    const db = makeFakeDb()
    openBehavior = () => {
      const req = makeOpenRequest()
      req.result = db
      return req
    }
    await expect(idbPut('errorBook', { name: 'a' })).resolves.toBeUndefined()
  })

  it('idbPut 以事务提交（tx.oncomplete）为完成信号', async () => {
    const { idbPut } = await import('./idb.js')
    const db = makeFakeDb()
    openBehavior = () => {
      const req = makeOpenRequest()
      req.result = db
      return req
    }

    let fire
    db.transaction = () => {
      const tx = {
        oncomplete: null,
        onerror: null,
        onabort: null,
        objectStore: () => ({ put() {} }),
      }
      fire = () => tx.oncomplete && tx.oncomplete()
      return tx
    }

    let settled = false
    const p = idbPut('errorBook', { name: 'a' }).then(() => {
      settled = true
    })
    await new Promise((r) => setTimeout(r, 0))
    expect(settled).toBe(false) // 事务未提交前不算完成

    fire()
    await p
    expect(settled).toBe(true)
  })

  it('事务中止（onabort）时写入按失败处理', async () => {
    const { idbPut } = await import('./idb.js')
    const db = makeFakeDb()
    openBehavior = () => {
      const req = makeOpenRequest()
      req.result = db
      return req
    }

    db.transaction = () => {
      const tx = {
        oncomplete: null,
        onerror: null,
        onabort: null,
        error: new Error('quota'),
        objectStore: () => ({ put() {} }),
      }
      queueMicrotask(() => tx.onabort && tx.onabort())
      return tx
    }

    await expect(idbPut('errorBook', { name: 'a' })).rejects.toThrow('quota')
  })

  it('idbBulkPut 事务中止（onabort）时按失败处理（回归：修复前缺 onabort 回调，配额满时 promise 永不 settle）', async () => {
    const { idbBulkPut } = await import('./idb.js')
    const db = makeFakeDb()
    openBehavior = () => {
      const req = makeOpenRequest()
      req.result = db
      return req
    }

    db.transaction = () => {
      const tx = {
        oncomplete: null,
        onerror: null,
        onabort: null,
        error: new Error('QuotaExceededError'),
        objectStore: () => ({ put() {} }),
      }
      queueMicrotask(() => tx.onabort && tx.onabort())
      return tx
    }

    await expect(idbBulkPut('errorBook', [{ name: 'a' }, { name: 'b' }])).rejects.toThrow(
      'QuotaExceededError'
    )
  })
})
