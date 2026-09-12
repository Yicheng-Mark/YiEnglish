import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useWindowVirtualizer } from '@tanstack/react-virtual'

function getColumns(width) {
  if (width < 768) return 1
  if (width < 1024) return 2
  return 3
}

export const VirtualGrid = forwardRef(function VirtualGrid(
  { items, renderItem, estimateRowSize = 200, overscan = 3, className = '', gapClass = 'gap-5' },
  ref
) {
  const parentRef = useRef(null)
  const [columns, setColumns] = useState(() =>
    typeof window !== 'undefined' ? getColumns(window.innerWidth) : 3
  )
  const [scrollMargin, setScrollMargin] = useState(0)

  useEffect(() => {
    function onResize() {
      setColumns(getColumns(window.innerWidth))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useLayoutEffect(() => {
    const update = () => {
      if (parentRef.current) {
        setScrollMargin(parentRef.current.offsetTop)
      }
    }
    update()
    // items/columns 变化时筛选结果重排，内容上方区域（标题/筛选栏）高度可能随之变化，
    // 仅监听 resize 会拿到过期的 scrollMargin，这里一并重测
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [items, columns])

  const rows = useMemo(() => {
    const r = []
    for (let i = 0; i < items.length; i += columns) {
      r.push(items.slice(i, i + columns))
    }
    return r
  }, [items, columns])

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    // 初估值仅用于首帧；行节点上挂 measureElement（见下方渲染）后按实测行高纠正
    estimateSize: () => estimateRowSize,
    overscan,
    scrollMargin,
  })

  useImperativeHandle(
    ref,
    () => ({
      scrollToIndex: (index, options) =>
        virtualizer.scrollToIndex(Math.floor(index / columns), options),
      scrollToOffset: (offset, options) =>
        window.scrollTo({
          top: offset,
          behavior: options?.behavior ?? 'auto',
        }),
      getScrollOffset: () => (typeof window !== 'undefined' ? window.scrollY : 0),
    }),
    [virtualizer, columns]
  )

  const virtualItems = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()

  return (
    <div ref={parentRef} className={className}>
      <div
        style={{
          height: `${totalSize}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualRow) => {
          const row = rows[virtualRow.index]
          if (!row) return null
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start - scrollMargin}px)`,
              }}
            >
              <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 ${gapClass} pb-5`}>
                {row.map((item, colIdx) => {
                  const flatIndex = virtualRow.index * columns + colIdx
                  return (
                    <div key={flatIndex} className="h-full">
                      {renderItem(item, flatIndex)}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
})

export default VirtualGrid
