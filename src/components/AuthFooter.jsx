import { useState, useEffect } from 'react'
import SocialLinks from './SocialLinks'
import useVirtualKeyboard from '../hooks/useVirtualKeyboard.js'

// 只认「会弹起软键盘的表单控件」
function isFormInput(el) {
  if (!el) return false
  if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return false
  if (
    el.tagName === 'INPUT' &&
    ['button', 'submit', 'reset', 'checkbox', 'radio', 'image', 'file'].includes(el.type)
  )
    return false
  return true
}

export default function AuthFooter() {
  const { keyboardHeight } = useVirtualKeyboard()
  const [pushDown, setPushDown] = useState(0)

  useEffect(() => {
    const update = () => {
      // 焦点不在表单控件上 → 键盘应处于关闭状态，offset 清零
      // （顺带兜底横屏 / 地址栏伸缩期间的噪声读数）
      setPushDown(isFormInput(document.activeElement) ? keyboardHeight : 0)
    }
    const onFocusOut = () => setTimeout(update, 0) // 等焦点切换后 activeElement 更新再判断

    window.addEventListener('focusin', update)
    window.addEventListener('focusout', onFocusOut)
    update()

    return () => {
      window.removeEventListener('focusin', update)
      window.removeEventListener('focusout', onFocusOut)
    }
  }, [keyboardHeight])

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
