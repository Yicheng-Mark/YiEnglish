import { useCallback, useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useAutoScrollList } from '../../hooks/useAutoScrollList.js'

// 桌面字幕模式的共享虚拟化骨架（从 BilingualMode 抽出）：
// - items 的 id → 行号映射（自动滚动兜底定位用）
// - useVirtualizer 滚动容器 + measureElement 动态测量（展开/收起等行高变化即时回填）
// - useAutoScrollList 的 setItemRef 与 measureElement 合并为单个行 ref 回调
// 无自动滚动诉求的列表（如 VocabCardMode 词条）传 activeId: null、自定义 getId 即可。
//
// options:
//   - items: 列表数据（字幕数组或词条数组）
//   - activeId: 当前活跃项 id（null 表示不需要自动滚动）
//   - deps: 自动滚动 effect 的额外依赖（BilingualMode 传 [subtitles]）
//   - estimateSize: 行高初估值（measureElement 会实测纠正）
//   - overscan: 视口外预渲染行数
//   - getId: 行 id 取值函数（默认 item.id，词条列表可传 (item) => item.word）
export function useSubtitleVirtualList({
  items,
  activeId = null,
  deps = [],
  estimateSize = 120,
  overscan = 6,
  getId,
}) {
  const resolveId = getId ?? ((item) => item?.id)

  // id → index 查找表（虚拟化兜底滚动用）
  const idToIndex = useMemo(() => {
    const m = new Map()
    items?.forEach((item, i) => m.set(resolveId(item), i))
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  const scrollParentRef = useRef(null)
  const virtualizer = useVirtualizer({
    count: items?.length || 0,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => estimateSize,
    overscan,
  })

  const scrollToVirtualIndex = useCallback(
    (idx, opts) => virtualizer.scrollToIndex(idx, opts),
    [virtualizer]
  )

  const { setItemRef, containerProps } = useAutoScrollList(activeId, deps, {
    getVirtualIndex: (id) => (idToIndex.has(id) ? idToIndex.get(id) : null),
    scrollToVirtualIndex,
  })

  // 行 ref：注册自动滚动目标 + 动态测量。data-index 必须由调用方同步写在同一元素上。
  const setRowRef = useCallback(
    (id) => (el) => {
      setItemRef(id)(el)
      if (el) virtualizer.measureElement(el)
    },
    [setItemRef, virtualizer]
  )

  return { scrollParentRef, virtualizer, setRowRef, containerProps }
}
