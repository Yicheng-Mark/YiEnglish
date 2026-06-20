import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { loadDictionary } from '../../../utils/loadDictionary.js'
import {
  addToCorpusWordBook,
  isInCorpusWordBook,
  removeFromCorpusWordBook,
} from '../../../utils/corpusWordBook.js'
import { findWordInMap } from '../../../utils/wordLookup.js'
import { useCorpusPlayer } from '../hooks/useCorpusPlayer.js'
import { useCorpusSettings } from '../hooks/useCorpusSettings.js'
import { useWordExtractor } from '../hooks/useWordExtractor.js'
import { parsePosFromTrans } from '../utils/wordColorMap.js'

const DICT_IDS = [
  'junior',
  'zhongkao',
  'senior',
  'gaokao',
  'cet4',
  'cet4freq',
  'cet6',
  'cet6freq',
  'tem4',
  'tem8',
  'ielts',
  'toefl',
  'sat',
  'postgraduate',
  'programmer',
]

// 模块级缓存：避免页面切换时重复加载词典（约 15 个 JSON）
let DICT_CACHE = null
let DICT_LOADING = null

async function ensureDictLoaded() {
  if (DICT_CACHE) return DICT_CACHE
  if (DICT_LOADING) return DICT_LOADING
  DICT_LOADING = (async () => {
    const dicts = await Promise.all(DICT_IDS.map((id) => loadDictionary(id).catch(() => null)))
    const wordMap = new Map()
    const posMap = new Map()
    const dictSourcesMap = new Map()
    dicts.forEach((dict, i) => {
      const dictId = DICT_IDS[i]
      if (!dict?.chapters) return
      dict.chapters.forEach((ch) => {
        if (!ch?.words) return
        ch.words.forEach((w) => {
          if (!w?.name) return
          const key = w.name.toLowerCase()
          if (!wordMap.has(key)) {
            wordMap.set(key, w)
            posMap.set(key, parsePosFromTrans(w.trans))
          }
          let set = dictSourcesMap.get(key)
          if (!set) {
            set = new Set()
            dictSourcesMap.set(key, set)
          }
          set.add(dictId)
        })
      })
    })
    DICT_CACHE = { wordMap, posMap, dictSourcesMap }
    DICT_LOADING = null
    return DICT_CACHE
  })()
  return DICT_LOADING
}

// 方案A：拆成两个 context。
// - 稳定/低频 context：模式、视频引用、字幕、词典、设置、弹窗相关（不含 player）。
//   变化来源只有字幕加载完成、模式切换、设置切换、弹窗开关——都是用户显式动作，频率低。
// - player context：仅 player 对象（含 currentTime / activeId / isPlaying 等 timeupdate 高频字段）。
//   这样不读 player 的消费者（ModeTabs / SettingsPanel / SubtitlePanel / 各字幕模式的稳定部分）
//   不再随 timeupdate 全局重渲染。
//
// useCorpusContext() 仍返回扁平对象，签名完全兼容，消费方零改动。
const CorpusStableContext = createContext(null)
const CorpusPlayerOnlyContext = createContext(null)

const MODES = ['bilingual', 'english', 'chinese', 'dictation', 'cloze', 'translate', 'vocab']

export function CorpusPlayerProvider({ video, children }) {
  const videoRef = useRef(null)
  const [videoEl, setVideoEl] = useState(null)
  const videoCallbackRef = useCallback((el) => {
    videoRef.current = el
    setVideoEl(el)
  }, [])
  const [mode, setMode] = useState('bilingual')
  const [subtitles, setSubtitles] = useState([])
  const [loadError, setLoadError] = useState(null)

  const [dicts, setDicts] = useState(DICT_CACHE)
  const [popup, setPopup] = useState(null)
  const activeTokenRef = useRef(null)

  const { settings, updateSetting, toggleSetting } = useCorpusSettings()
  const player = useCorpusPlayer({ videoRef, subtitles, videoEl })

  // 加载字幕
  useEffect(() => {
    if (!video?.subtitleUrl) return
    let cancelled = false
    setSubtitles([])
    setLoadError(null)
    fetch(video.subtitleUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data) => {
        if (!cancelled) setSubtitles(Array.isArray(data) ? data : [])
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err?.message || '字幕加载失败')
      })
    return () => {
      cancelled = true
    }
  }, [video?.subtitleUrl])

  // 加载所有词典（首次）
  useEffect(() => {
    let cancelled = false
    if (DICT_CACHE) {
      setDicts(DICT_CACHE)
      return
    }
    ensureDictLoaded().then((d) => {
      if (!cancelled) setDicts(d)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const wordMap = dicts?.wordMap ?? null
  const posMap = dicts?.posMap ?? null
  const dictSourcesMap = dicts?.dictSourcesMap ?? null

  const extractedWords = useWordExtractor({
    subtitles,
    wordMap,
    dictSourcesMap,
  })

  // 单词查询弹窗
  const handleWordClick = useCallback(
    (word, rect, tokenEl) => {
      if (!word) return
      const cleanWord = word
        .toLowerCase()
        .trim()
        .replace(/[^a-z'-]/g, '')
      if (!cleanWord) return
      if (activeTokenRef.current) {
        activeTokenRef.current.classList.remove('word-token-active')
      }
      if (tokenEl) {
        tokenEl.classList.add('word-token-active')
        activeTokenRef.current = tokenEl
      }
      const wordData = (wordMap && findWordInMap(cleanWord, wordMap)) || {
        name: cleanWord,
        usphone: '',
        ukphone: '',
        trans: [],
      }
      setPopup({
        wordData,
        rect,
        isSaved: isInCorpusWordBook(wordData.name),
      })
    },
    [wordMap]
  )

  const closePopup = useCallback(() => {
    if (activeTokenRef.current) {
      activeTokenRef.current.classList.remove('word-token-active')
      activeTokenRef.current = null
    }
    setPopup(null)
  }, [])

  const saveWord = useCallback(() => {
    if (!popup?.wordData) return
    addToCorpusWordBook({
      ...popup.wordData,
      sourceVideoId: video?.id,
    })
    setPopup((prev) => (prev ? { ...prev, isSaved: true } : null))
  }, [popup, video?.id])

  const removeWord = useCallback(() => {
    if (!popup?.wordData) return
    removeFromCorpusWordBook(popup.wordData.name)
    setPopup((prev) => (prev ? { ...prev, isSaved: false } : null))
  }, [popup])

  // 稳定/低频 context：不含 player。
  // 依赖项都是用户显式动作（切模式、切设置、字幕加载完成、弹窗开关、词典加载完成），频率低。
  const stableValue = useMemo(
    () => ({
      // 模式
      mode,
      setMode,
      modes: MODES,
      // 视频元素
      videoRef,
      videoCallbackRef,
      videoId: video?.id,
      video,
      // 字幕
      subtitles,
      loadError,
      // 字典
      wordMap,
      posMap,
      dictSourcesMap,
      extractedWords,
      // 设置
      settings,
      updateSetting,
      toggleSetting,
      // 单词弹窗
      popup,
      handleWordClick,
      closePopup,
      saveWord,
      removeWord,
    }),
    [
      mode,
      video,
      videoCallbackRef,
      subtitles,
      loadError,
      wordMap,
      posMap,
      dictSourcesMap,
      extractedWords,
      settings,
      updateSetting,
      toggleSetting,
      popup,
      handleWordClick,
      closePopup,
      saveWord,
      removeWord,
    ]
  )

  // player 单独成 context：依赖只有 player，timeupdate 高频变化只重建这个 value。
  const playerValue = useMemo(() => ({ player }), [player])

  return (
    <CorpusStableContext.Provider value={stableValue}>
      <CorpusPlayerOnlyContext.Provider value={playerValue}>
        {children}
      </CorpusPlayerOnlyContext.Provider>
    </CorpusStableContext.Provider>
  )
}

export function useCorpusContext() {
  const stable = useContext(CorpusStableContext)
  const playerCtx = useContext(CorpusPlayerOnlyContext)
  if (!stable || !playerCtx) {
    throw new Error('useCorpusContext must be used within CorpusPlayerProvider')
  }
  // 返回扁平结构，与改造前完全一致；消费方零改动。
  // 注：调用 useCorpusContext 的组件会在 stable 或 player 任一变化时重渲染，
  // 这与改造前等价；真正受益的是未来用细粒度 hook 的消费方（见下）。
  return useMemo(() => ({ ...stable, player: playerCtx.player }), [stable, playerCtx])
}

// 细粒度 hook（消费方未改动，但供未来优化使用）：
// - useCorpusStable()：只订阅低频 context，不含 player，不随 timeupdate 重渲染。
// - useCorpusPlayerState()：只订阅 player context。
export function useCorpusStable() {
  const ctx = useContext(CorpusStableContext)
  if (!ctx) {
    throw new Error('useCorpusStable must be used within CorpusPlayerProvider')
  }
  return ctx
}

export function useCorpusPlayerState() {
  const ctx = useContext(CorpusPlayerOnlyContext)
  if (!ctx) {
    throw new Error('useCorpusPlayerState must be used within CorpusPlayerProvider')
  }
  return ctx.player
}
