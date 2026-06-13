import { lazy } from 'react'

/**
 * 包裹 React.lazy：当动态 import 失败时自动刷新一次。
 *
 * 常见场景：站点发版后，Safari 仍持有旧 index.html 缓存，旧 html 引用的
 * chunk hash 在新服务器上 404 → 该 lazy 模块加载失败 → 若不处理会卡在
 * Suspense 或白屏。这里在失败时刷新一次页面拿到最新 index.html；
 * 用 window.__chunkReloaded 守卫防止死循环；刷新后仍失败则抛出，
 * 交给 ErrorBoundary 兜底显示。
 */
export function lazyRetry(dynamicImport) {
  return lazy(() =>
    dynamicImport().catch((err) => {
      try {
        if (!window.__chunkReloaded) {
          window.__chunkReloaded = true
          window.location.reload()
          // reload 不会立即中断 JS，返回一个永不 resolve 的 Promise 阻止本次抛错
          return new Promise(() => {})
        }
      } catch (e) {
        /* ignore */
      }
      throw err
    })
  )
}

export default lazyRetry
