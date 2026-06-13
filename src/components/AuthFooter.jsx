import { useState, useEffect } from 'react'
import SocialLinks from './SocialLinks'

// 只认「会弹起软键盘的表单控件」
function isFormInput(el) {
  if (!el) return false
  if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return false
  if (el.tagName === 'INPUT' && ['button', 'submit', 'reset', 'checkbox', 'radio', 'image', 'file'].includes(el.type)) return false
  return true
}

export default function AuthFooter() {
  const [pushDown, setPushDown] = useState(0)

  useEffect(() => {
    let baseHeight = window.innerHeight // 键盘未弹起时的布局视口高度

    const update = () => {
      // 没有表单控件聚焦 → 键盘是关的，把当前高度当作基准（也顺带自纠横屏 / 地址栏伸缩）
      if (!isFormInput(document.activeElement)) baseHeight = window.innerHeight
      // 布局视口收缩了多少 = 键盘把 fixed 外壳顶上去多少；向下补回同样的量，footer 回到屏幕物理最底部（被键盘盖住）
      setPushDown(Math.max(0, baseHeight - window.innerHeight))
    }
    const onFocusOut = () => setTimeout(update, 0) // 等焦点切换后 activeElement 更新再判断

    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    window.addEventListener('focusin', update)
    window.addEventListener('focusout', onFocusOut)
    if (window.visualViewport) window.visualViewport.addEventListener('resize', update)
    update()

    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
      window.removeEventListener('focusin', update)
      window.removeEventListener('focusout', onFocusOut)
      if (window.visualViewport) window.visualViewport.removeEventListener('resize', update)
    }
  }, [])

  const offset = pushDown > 0 ? { transform: `translateY(${pushDown}px)` } : undefined

  return (
    <>
      <SocialLinks className="absolute bottom-12 left-0 right-0" style={offset} />
      <a
        href="https://beian.miit.gov.cn/"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-4 left-0 right-0 text-center text-xs text-white/40 hover:text-white/60 transition-colors"
        style={offset}
      >
        闽ICP备2026017084号-1
      </a>
    </>
  )
}
