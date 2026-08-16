import React, { useEffect, useRef, useCallback, memo } from 'react'
import { Volume2, Check, X } from 'lucide-react'
import { VirtualList } from './virtual/VirtualList'

const WordListItem = memo(function WordListItem({
  word,
  idx,
  currentIndex,
  onPlaySound,
  onJumpTo,
}) {
  const isActive = idx === currentIndex
  const isDone = idx < currentIndex

  return (
    <div
      onClick={() => onJumpTo?.(idx)}
      className={`
        group mx-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all
        flex items-start justify-between gap-2
        ${
          isActive
            ? 'bg-indigo-50 dark:bg-indigo-500/15 border-l-2 border-indigo-500 dark:border-indigo-400'
            : 'hover:bg-slate-50 dark:hover:bg-slate-700/30 border-l-2 border-transparent'
        }
        ${isDone ? 'opacity-40' : ''}
      `}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={`
            font-mono text-sm font-medium truncate
            ${isActive ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}
          `}
          >
            {word.name}
          </span>
          {isDone && <Check className="w-3 h-3 text-emerald-500 shrink-0" />}
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5 leading-relaxed">
          {Array.isArray(word.trans) ? word.trans.join('；') : word.trans}
        </p>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation()
          onPlaySound?.(word.name)
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-slate-200 dark:hover:bg-white/[0.08] shrink-0"
      >
        <Volume2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-400" />
      </button>
    </div>
  )
})

const WordListPanel = memo(function WordListPanel({
  words,
  currentIndex,
  onPlaySound,
  onJumpTo,
  onClose,
}) {
  const listRef = useRef(null)

  // 用 ref 持有最新的 currentIndex，让 renderWord 回调引用稳定（不再随每次按键重建）。
  // currentIndex 仍作为 prop 透传给 WordListItem，保证“当前词高亮 / 已完成置灰”正常更新——
  // 由于 VirtualList 只渲染可视区的项，重渲染仅限可视区，不再被回调重建放大。
  const currentIndexRef = useRef(currentIndex)
  currentIndexRef.current = currentIndex

  useEffect(() => {
    if (listRef.current && currentIndex >= 0) {
      listRef.current.scrollToIndex(currentIndex, { align: 'center', behavior: 'smooth' })
    }
  }, [currentIndex])

  // 用 ref 保存可能变化的回调引用，使 renderWord 依赖数组为空、引用永久稳定。
  const callbacksRef = useRef({ onPlaySound, onJumpTo })
  callbacksRef.current.onPlaySound = onPlaySound
  callbacksRef.current.onJumpTo = onJumpTo

  const renderWord = useCallback(
    (word, idx) => (
      <WordListItem
        word={word}
        idx={idx}
        currentIndex={currentIndexRef.current}
        onPlaySound={callbacksRef.current.onPlaySound}
        onJumpTo={callbacksRef.current.onJumpTo}
      />
    ),
    []
  )

  if (!words || words.length === 0) return null

  return (
    <div className="flex flex-col w-full h-full bg-white dark:bg-surface-dark backdrop-blur-sm border-r border-slate-200 dark:border-white/[0.06]">
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-white/[0.06]">
        <div>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">本章单词</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            {currentIndex + 1} / {words.length}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <X className="w-4 h-4 text-slate-500 dark:text-slate-400" />
        </button>
      </div>

      {/* 单词列表 - 虚拟滚动 */}
      <div className="flex-1 overflow-hidden">
        <VirtualList
          ref={listRef}
          items={words}
          estimateSize={60}
          overscan={10}
          className="h-full py-2 pb-6 custom-scrollbar"
          renderItem={renderWord}
        />
      </div>
    </div>
  )
})

export default WordListPanel
