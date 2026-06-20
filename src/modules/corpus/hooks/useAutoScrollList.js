import { useEffect, useRef, useCallback } from 'react'

// 共享：字幕列表项 ref 注册 + 用户滚动检测 + 自动滚动当前活跃项到视图中央
// options:
//   - scrollAlign: 'center' | 'start' | ...
//   - getVirtualIndex: (id) => number | null  —— 虚拟化列表的 id→index 映射
//   - scrollToVirtualIndex: (index, { align }) => void  —— 虚拟化器的 scrollToIndex
// 虚拟化模式下：若活跃项不在 DOM（未渲染），先用 scrollToVirtualIndex 滚到它，
// 等待一帧让 ref 注册后再 scrollIntoView 微调对齐。
export function useAutoScrollList(
  activeId,
  deps = [],
  { scrollAlign = 'center', getVirtualIndex, scrollToVirtualIndex } = {}
) {
  const itemRefs = useRef(new Map())
  const userScrolledAtRef = useRef(0)

  useEffect(() => {
    if (activeId == null) return
    const sinceManual = Date.now() - userScrolledAtRef.current
    if (sinceManual < 2000) return

    const el = itemRefs.current.get(activeId)
    if (el) {
      el.scrollIntoView({ block: scrollAlign, behavior: 'smooth' })
      return
    }

    // 虚拟化兜底：活跃项未渲染时，先滚动到它的 index
    if (typeof getVirtualIndex === 'function' && typeof scrollToVirtualIndex === 'function') {
      const idx = getVirtualIndex(activeId)
      if (idx == null) return
      scrollToVirtualIndex(idx, { align: scrollAlign, behavior: 'smooth' })
      // 一帧后再尝试 scrollIntoView 微调（此时 ref 通常已注册）
      requestAnimationFrame(() => {
        const el2 = itemRefs.current.get(activeId)
        if (el2) el2.scrollIntoView({ block: scrollAlign, behavior: 'smooth' })
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, ...deps])

  const handleScroll = useCallback(() => {
    userScrolledAtRef.current = Date.now()
  }, [])

  const setItemRef = useCallback(
    (id) => (el) => {
      if (el) itemRefs.current.set(id, el)
      else itemRefs.current.delete(id)
    },
    []
  )

  const containerProps = {
    onScroll: handleScroll,
    onWheel: handleScroll,
    onTouchMove: handleScroll,
  }

  return { setItemRef, handleScroll, containerProps }
}
