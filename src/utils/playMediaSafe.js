// iOS WebKit（Safari/Quark 等）偶尔让 HTMLMediaElement.play() 返回 undefined 而非 Promise，
// 直接 .catch() 会抛 "undefined is not an object"，并在 React 副作用阶段冒泡到错误边界，
// 导致整页崩溃（音频/视频播放均适用）。统一在此兜底：play() 自身异常 + 非 Promise 返回值
// + 播放被拒绝（如自动播放被拦截）都静默吞掉，绝不让"播放失败"拖垮页面。
export function playMediaSafe(media) {
  if (!media) return
  let result
  try {
    result = media.play()
  } catch {
    return
  }
  if (result && typeof result.catch === 'function') {
    result.catch(() => {})
  }
}
