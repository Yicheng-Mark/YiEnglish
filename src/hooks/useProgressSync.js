import { useCallback, useEffect, useState } from 'react'
import {
  isInFavoriteWords,
  addToFavoriteWords,
  removeFromFavoriteWords,
} from '../utils/favoriteWords.js'

/**
 * useProgressSync —— 从 Typing.jsx 机械抽离的「进度刷新副作用 / 收藏」相关逻辑。
 *
 * 抽离自 Typing.jsx（原内联代码逐行对应，无业务逻辑改动）：
 *  - 章节完成时刷新进度到服务器的 useEffect
 *  - 组件卸载时刷新进度的 useEffect
 *  - 收藏状态同步 useEffect + handleToggleFavorite
 *
 * 说明：
 *  flushServerProgress / completedBufferRef / handleWordComplete / handleAutoRemove
 *  因与 useTyping 构成循环依赖（handleWordComplete 引用 useTyping 返回的 lastWordHadErrorRef），
 *  仍保留在 Typing.jsx（声明顺序与原代码一致），仅将不依赖 useTyping 输出的副作用与收藏
 *  逻辑抽离到本 hook，由调用方在 useTyping 之后调用并传入 flushServerProgress / isFinished / currentWord。
 *
 * @param {object} opts
 * @param {Function} opts.flushServerProgress
 * @param {boolean} opts.isFinished
 * @param {object} opts.currentWord 当前单词（用于收藏状态同步）
 */
export default function useProgressSync({ flushServerProgress, isFinished, currentWord }) {
  // 章节完成时刷新进度到服务器
  useEffect(() => {
    if (isFinished) flushServerProgress()
  }, [isFinished, flushServerProgress])

  // 卸载/切章时兜底 flush：<5 词的缓冲若不冲掉，普通返回导航会静默丢失这段服务端
  // 进度。cleanup 捕获的是旧版 flushServerProgress（含旧 dictId/chapterId），
  // 切章时恰好按旧章冲刷（Typing.jsx 不再另挂同款 effect，避免双份清理）
  useEffect(() => {
    return () => flushServerProgress()
  }, [flushServerProgress])

  // 收藏状态同步
  const [isCurrentWordFavorited, setIsCurrentWordFavorited] = useState(false)
  useEffect(() => {
    setIsCurrentWordFavorited(currentWord ? isInFavoriteWords(currentWord.name) : false)
  }, [currentWord?.name])

  const handleToggleFavorite = useCallback(
    (e) => {
      e.stopPropagation()
      if (!currentWord) return
      if (isInFavoriteWords(currentWord.name)) {
        removeFromFavoriteWords(currentWord.name)
        setIsCurrentWordFavorited(false)
      } else {
        addToFavoriteWords(currentWord)
        setIsCurrentWordFavorited(true)
      }
    },
    [currentWord]
  )

  return {
    isCurrentWordFavorited,
    handleToggleFavorite,
  }
}
