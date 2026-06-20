// 安全复制到剪贴板：优先 Clipboard API，不可用或失败时回退到 execCommand。
// 解决 iOS<13.4 / 非 HTTPS（缺 Secure Context）下 navigator.clipboard 抛错的问题。
// 返回 true/false 表示是否成功，调用方据此决定提示文案。
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // 落到 legacy 方案
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.top = '-9999px'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
