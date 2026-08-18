let audioCtx = null
let unlockPromise = null

export function getAudioContext() {
  return audioCtx
}

export async function unlockAudio() {
  if (audioCtx?.state === 'running') return audioCtx
  if (unlockPromise) return unlockPromise

  unlockPromise = (async () => {
    try {
      // 已有 suspended 的 context 优先原地 resume，避免无谓重建
      if (audioCtx && audioCtx.state === 'suspended') {
        try {
          await audioCtx.resume()
        } catch {
          /* resume 失败则走重建 */
        }
      }
      if (audioCtx?.state === 'running') return audioCtx

      // 重建前必须关闭旧 context：浏览器对并发 AudioContext 有硬上限（约 6 个），
      // 反复 new 而不 close 会耗尽配额，之后所有音效静音
      if (audioCtx && audioCtx.state !== 'closed') {
        try {
          await audioCtx.close()
        } catch {
          /* already closing */
        }
      }
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      audioCtx = ctx
      await ctx.resume()
      return ctx
    } catch {
      return null
    } finally {
      unlockPromise = null
    }
  })()

  return unlockPromise
}
