import { useEffect, useRef, useState } from 'react'

/**
 * 统一的虚拟键盘高度检测 hook。
 *
 * 监听 visualViewport.resize（不支持时 fallback 到 window.resize），
 * 通过对比「键盘未弹起的布局视口高度」与「当前视口高度」算出键盘把布局视口顶上去多少。
 *
 * @param {object} [options]
 * @param {number} [options.threshold=0] 高度差超过该值才视为键盘弹起（用于过滤地址栏伸缩等噪声）。
 *        - 0：只要有收缩就计入（Typing.jsx 旧行为）
 *        - 150：MobileCorpusPlayer 旧行为
 * @param {boolean} [options.active=true] 是否启用监听。Typing.jsx 仅在 isMobile 时启用，
 *        可传 false 以便 SSR / 桌面端直接跳过。
 * @returns {{
 *   keyboardHeight: number,
 *   viewportHeight: number|null
 * }}
 *   - keyboardHeight：键盘高度（px），键盘未弹起为 0
 *   - viewportHeight：键盘弹起时为键盘上方的可视区域高度（即 vv.height），
 *     键盘未弹起为 null（调用方可据此恢复 dvh / 100% 等默认高度）
 */
export default function useVirtualKeyboard({ threshold = 0, active = true } = {}) {
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(null)
  // 键盘未弹起时的布局视口高度（捕获基准），用 ref 避免重渲染丢失
  const baseHeightRef = useRef(typeof window !== 'undefined' ? window.innerHeight : 0)

  useEffect(() => {
    if (!active) return undefined

    baseHeightRef.current = window.innerHeight

    const vv = window.visualViewport
    const handleResize = () => {
      const currentHeight = vv ? vv.height : window.innerHeight
      const kbdHeight = Math.max(0, baseHeightRef.current - currentHeight)
      const effective = kbdHeight > threshold ? kbdHeight : 0
      setKeyboardHeight(effective)
      // 键盘弹起时，vv.height 就是键盘上方的可视区域，直接用即可；
      // 不要再减 safe-area（部分安卓机会把手势条/键盘高度算进 safe-area，导致下方留白）
      setViewportHeight(effective > 0 ? currentHeight : null)
    }

    if (vv) {
      vv.addEventListener('resize', handleResize)
      handleResize()
      return () => vv.removeEventListener('resize', handleResize)
    }

    // 不支持 visualViewport 的浏览器 fallback 到 window.innerHeight
    window.addEventListener('resize', handleResize)
    handleResize()
    return () => window.removeEventListener('resize', handleResize)
  }, [active, threshold])

  return { keyboardHeight, viewportHeight }
}
