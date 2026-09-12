import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { loadDictionary } from '../../../utils/loadDictionary.js'
import { loadWordIndex, indexEntryToWord } from '../../../utils/dictWordMap.js'
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
  'ieltsfreq',
  'toefl',
  'toeflfreq',
  'sat',
  'postgraduate',
  'programmer',
]

// 模块级缓存：避免页面切换时重复加载词典（现为单个合并索引，旧实现约 17 个 JSON）
let DICT_CACHE = null
let DICT_LOADING = null

// 优先路径：单请求拉取预生成的合并索引（scripts/gen-word-index.mjs 产物），
// 按本播放器的 17 部词典过滤构建三张 Map。索引条目的主字段已是「首个含词词典胜出」
//（迭代序与 DICT_IDS 一致）；仅当主胜出词典不在本列表而 alt（programmer 侧词条）
// 在时取 alt——与旧全量路径的首个含词词典语义逐比特一致。
function buildDictsFromIndex(index) {
  const wordMap = new Map()
  const posMap = new Map()
  const dictSourcesMap = new Map()
  const dictIdSet = new Set(DICT_IDS)
  for (const key in index) {
    const entry = index[key]
    if (!entry || typeof entry !== 'object' || !Array.isArray(entry.dictIds)) continue
    const sourceIds = entry.dictIds.filter((id) => dictIdSet.has(id))
    if (sourceIds.length === 0) continue
    const winner = entry.alt || entry
    wordMap.set(key, indexEntryToWord(key, winner))
    posMap.set(key, winner.pos || 'unknown')
    dictSourcesMap.set(key, new Set(sourceIds))
  }
  return { wordMap, posMap, dictSourcesMap }
}

// 旧实现：全量拉 17 部词典主线程建三张 Map（保留作 word-index.json 不可用时的 fallback）
async function ensureDictLoadedFromDicts() {
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
  return { wordMap, posMap, dictSourcesMap }
}

async function ensureDictLoaded() {
  if (DICT_CACHE) return DICT_CACHE
  if (DICT_LOADING) return DICT_LOADING
  DICT_LOADING = (async () => {
    try {
      const index = await loadWordIndex()
      const result = buildDictsFromIndex(index)
      if (result.wordMap.size === 0) throw new Error('word-index 为空')
      DICT_CACHE = result
      DICT_LOADING = null
      return result
    } catch {
      // 索引缺失/损坏 → 回退旧全量路径
      const result = await ensureDictLoadedFromDicts()
      DICT_CACHE = result
      DICT_LOADING = null
      return result
    }
  })()
  // 虽然单个词典失败已被 .catch(() => null) 吸收，构造过程仍可能因其他异常 reject；
  // 失败时必须清掉 DICT_LOADING，否则 rejected promise 被永久缓存，之后再也进不了重试
  DICT_LOADING.catch(() => {
    DICT_LOADING = null
  })
  return DICT_LOADING
}

// 方案A：拆成三个 context。
// - 稳定/低频 context：模式、视频引用、字幕、词典、设置、弹窗相关（不含 player）。
//   变化来源只有字幕加载完成、模式切换、设置切换、弹窗开关——都是用户显式动作，频率低。
// - player context：player 对象（activeId/isPlaying 等按句/按操作变化的状态 + 稳定回调）。
//   不含 currentTime——那是唯一随 timeupdate(~4Hz) 高频变化的字段，放进来的话
//   player 身份每帧重建，所有消费者都会跟着全树重渲染（拆分等于没拆）。
// - time context：currentTime 原语按值下发，只有进度条类组件（桌面/移动进度条）订阅。
//   timeupdate 高频 tick 只重渲染这几个小组件。
//
// useCorpusContext() 仍返回扁平对象（不含 currentTime），签名兼容，消费方基本零改动。
const CorpusStableContext = createContext(null)
const CorpusPlayerOnlyContext = createContext(null)
const CorpusTimeContext = createContext(0)

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
  const { player, currentTime } = useCorpusPlayer({ videoRef, subtitles, videoEl })

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
    ensureDictLoaded()
      .then((d) => {
        if (!cancelled) setDicts(d)
      })
      .catch(() => {
        // 词典加载失败：置 null 走各消费端的降级路径，避免 unhandled rejection
        if (!cancelled) setDicts(null)
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

  // player 单独成 context：player 不含 currentTime，timeupdate 高频 tick 不改变其身份，
  // player 消费者只在 activeId/isPlaying/设置类状态实际变化时重渲染。
  const playerValue = useMemo(() => ({ player }), [player])

  return (
    <CorpusStableContext.Provider value={stableValue}>
      <CorpusPlayerOnlyContext.Provider value={playerValue}>
        <CorpusTimeContext.Provider value={currentTime}>{children}</CorpusTimeContext.Provider>
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
  // 返回扁平结构，与改造前一致（currentTime 不在此：需要它的组件用 useCorpusTime()）。
  // 调用 useCorpusContext 的组件在 stable 或 player 任一变化时重渲染；
  // timeupdate 高频 tick 已被隔离在 time context，不再波及这里。
  return useMemo(() => ({ ...stable, player: playerCtx.player }), [stable, playerCtx])
}

// 细粒度 hook：
// - useCorpusStable()：只订阅低频 context，不含 player，不随播放状态变化重渲染。
// - useCorpusPlayerState()：只订阅 player context（activeId/isPlaying/回调，不含 currentTime）。
// - useCorpusTime()：只订阅 currentTime（timeupdate ~4Hz 变化），进度条类组件专用。
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

export function useCorpusTime() {
  return useContext(CorpusTimeContext)
}
