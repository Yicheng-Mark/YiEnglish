import { useEffect, useRef, useCallback } from 'react'

// 共享：字幕列表项 ref 注册 + 用户滚动检测 + 自动滚动当前活跃项到视图中央
export function useAutoScrollList(activeId, deps = [], { scrollAlign = 'center' } = {}) {
  const itemRefs = useRef(new Map())
  const userScrolledAtRef = useRef(0)

  useEffect(() => {
    if (activeId == null) return
    const el = itemRefs.current.get(activeId)
    if (!el) return
    const sinceManual = Date.now() - userScrolledAtRef.current
    if (sinceManual < 2000) return
    el.scrollIntoView({ block: scrollAlign, behavior: 'smooth' })
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
