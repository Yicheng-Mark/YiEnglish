import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { loadDictionary } from '../../../utils/loadDictionary.js'
import {
  addToCorpusWordBook,
  isInCorpusWordBook,
  removeFromCorpusWordBook,
} from '../../../utils/corpusWordBook.js'
import { findWordInMap } from '../../../utils/readingWordBook.js'
import { useCorpusPlayer } from '../hooks/useCorpusPlayer.js'
import { useCorpusSettings } from '../hooks/useCorpusSettings.js'
import { useWordExtractor } from '../hooks/useWordExtractor.js'
import { parsePosFromTrans } from '../utils/wordColorMap.js'

const DICT_IDS = [
  'junior', 'zhongkao', 'senior', 'gaokao',
  'cet4', 'cet4freq', 'cet6', 'cet6freq',
  'tem4', 'tem8', 'ielts', 'toefl', 'sat',
  'postgraduate', 'programmer',
]

// 模块级缓存：避免页面切换时重复加载词典（约 15 个 JSON）
let DICT_CACHE = null
let DICT_LOADING = null

async function ensureDictLoaded() {
  if (DICT_CACHE) return DICT_CACHE
  if (DICT_LOADING) return DICT_LOADING
  DICT_LOADING = (async () => {
    const dicts = await Promise.all(
      DICT_IDS.map((id) => loadDictionary(id).catch(() => null))
    )
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

const CorpusPlayerContext = createContext(null)

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
      const cleanWord = word.toLowerCase().trim().replace(/[^a-z'-]/g, '')
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

  const value = useMemo(
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
      // 播放器
      player,
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
      subtitles,
      loadError,
      wordMap,
      posMap,
      dictSourcesMap,
      extractedWords,
      player,
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

  return <CorpusPlayerContext.Provider value={value}>{children}</CorpusPlayerContext.Provider>
}

export function useCorpusContext() {
  const ctx = useContext(CorpusPlayerContext)
  if (!ctx) {
    throw new Error('useCorpusContext must be used within CorpusPlayerProvider')
  }
  return ctx
}
