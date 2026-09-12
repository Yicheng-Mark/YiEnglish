#!/usr/bin/env node
/**
 * 生成 public/dictionaries/word-index.json —— 跨词典去重合并的紧凑词索引。
 *
 * 背景：语料播放器（CorpusPlayerContext.ensureDictLoaded）、共享词表构建器
 * （utils/dictWordMap.buildDictWordMap）、首页搜索（useWordSearchIndex）与阅读
 * 详情页（ArticleDetail）各自在首次进入时全量下载 15~25 部词典（合计 ~18MB 原始
 * JSON）并在主线程 parse + 建 Map。本脚本把全部词典去重合并成单个索引文件，
 * 运行时一次请求即可建表，旧全量路径保留为 fallback。
 *
 * 条目结构：{ [小写词名]: { name?, usphone?, ukphone?, us?, uk?, trans, pos, dictIds, locs, alt? } }
 * - name：原始大小写词名；与小写 key 相同时省略（运行时回落用 key）
 * - trans：首个包含该词的词典（dictIds[0]）的释义原值；pos 由 parsePosFromTrans 预计算
 *   （与 src/modules/corpus/utils/wordColorMap.js 同一函数，脚本直接 import 复用），
 *   'unknown' 省略（运行时缺省即 unknown）
 * - 优先级逐比特复刻旧运行时行为：wordMap/posMap 首个包含该词的词典胜出，
 *   迭代序 = 下方 INDEX_DICT_IDS（与 src/dictionaries/meta.js 注册序一致）
 * - dictIds：包含该词的全部词典 id 并集，按上述迭代序排列
 * - locs：与 dictIds 对齐，记录该词在各词典扁平词序中的首次出现位置
 *   [chapterId, wordIndex]——与 loadDictionary.js 运行时 rechunkDictionary 的
 *   25 词分章一致（同样保持词序、floor(pos/25) 与 pos%25），供首页搜索结果
 *   跳转 /typing/:dictId/:chapterId?wordIndex=N 使用
 * - alt：仅当「按 meta 序首个含词词典是 postgraduateCore，且该词也在 programmer 中」
 *   时写入——此时语料播放器（17 部，无 postgraduateCore）与阅读页（15 部）的
 *   首个含词词典是 programmer，alt 保存 programmer 侧词条字段，运行时按消费方
 *   语义取用（dictWordMap 取主条目，语料/阅读取 alt），保证各消费方行为不变
 *
 * 幂等：可重复运行，产物只由词典 JSON 决定。
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { parsePosFromTrans } from '../src/modules/corpus/utils/wordColorMap.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DICT_DIR = path.join(ROOT, 'public', 'dictionaries')
const OUT_FILE = path.join(DICT_DIR, 'word-index.json')

// 与运行时 loadDictionary.js 的 CHAPTER_SIZE 一致（25 词一章，locs 由此换算）
const CHAPTER_SIZE = 25

// 与 src/dictionaries/meta.js 的注册顺序保持一致（首个包含该词的词典胜出）
export const INDEX_DICT_IDS = [
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
  'postgraduateCore',
  'programmer',
  'nautical',
  'marine_engineering',
  'automotive',
  'electrician',
  'business',
  'foreign_trade',
  'chef',
]

// 词条 → 索引条目的字段投影（稀疏存字段：空值不写，控制体积）
function toEntryFields(word) {
  const entry = { trans: word.trans }
  if (word.name) entry.name = word.name
  if (word.usphone) entry.usphone = word.usphone
  if (word.ukphone) entry.ukphone = word.ukphone
  if (word.us) entry.us = word.us
  if (word.uk) entry.uk = word.uk
  return entry
}

/**
 * 纯函数：由已解析的词典数据构建索引对象（供生成 CLI 与等价性测试共用）。
 * @param {Record<string, object>} dictsById 词典 id → 解析后的 JSON
 * @returns {{ index: object, stats: object }} 索引与统计信息
 */
export function buildWordIndexData(dictsById) {
  const index = Object.create(null)
  let totalWords = 0
  // 各消费方首个含词词典与 meta 序首个不一致的词数（alt 覆盖情况）
  let altCount = 0

  for (const dictId of INDEX_DICT_IDS) {
    const dict = dictsById[dictId]
    if (!dict) continue
    let flatPos = 0 // 词典内扁平词序（含无名词条也占位，与 rechunk 分章口径一致）
    for (const chapter of dict.chapters ?? []) {
      for (const word of chapter?.words ?? []) {
        const pos = flatPos++
        if (!word?.name) continue
        totalWords++
        const key = word.name.toLowerCase()
        let entry = index[key]
        if (!entry) {
          entry = index[key] = toEntryFields(word)
          entry.pos = parsePosFromTrans(word.trans)
          entry.dictIds = [dictId]
          entry.locs = [[Math.floor(pos / CHAPTER_SIZE), pos % CHAPTER_SIZE]]
          if (entry.pos === 'unknown') delete entry.pos
        } else if (!entry.dictIds.includes(dictId)) {
          entry.dictIds.push(dictId)
          entry.locs.push([Math.floor(pos / CHAPTER_SIZE), pos % CHAPTER_SIZE])
        }
      }
    }
  }

  // alt 修补：首个含词词典是 postgraduateCore 且 programmer 也含该词时，
  // 语料/阅读消费方的胜出条目是 programmer 侧（它们的词典列表不含 postgraduateCore）
  const pgCore = dictsById.postgraduateCore
  if (pgCore) {
    const programmerWords = new Set()
    for (const chapter of dictsById.programmer?.chapters ?? []) {
      for (const w of chapter?.words ?? []) {
        if (w?.name) programmerWords.add(w.name.toLowerCase())
      }
    }
    for (const chapter of pgCore.chapters ?? []) {
      for (const w of chapter?.words ?? []) {
        if (!w?.name) continue
        const key = w.name.toLowerCase()
        if (!programmerWords.has(key)) continue
        const entry = index[key]
        if (!entry || entry.dictIds[0] !== 'postgraduateCore') continue
        entry.alt = toEntryFields(dictsById.programmer && findWord(dictsById.programmer, key))
        altCount++
      }
    }
  }

  return { index, stats: { totalWords, uniqueWords: Object.keys(index).length, altCount } }
}

// 在单部词典里按小写词名找首个词条（alt 字段取原文用）
function findWord(dict, lowerKey) {
  for (const chapter of dict.chapters ?? []) {
    for (const w of chapter?.words ?? []) {
      if (w?.name && w.name.toLowerCase() === lowerKey) return w
    }
  }
  return null
}

function main() {
  const dictsById = {}
  let sourceBytes = 0
  for (const id of INDEX_DICT_IDS) {
    const file = path.join(DICT_DIR, `${id}.json`)
    if (!fs.existsSync(file)) {
      console.error(`[gen-word-index] 缺少词典文件: ${id}.json`)
      process.exitCode = 1
      return
    }
    const raw = fs.readFileSync(file, 'utf8')
    sourceBytes += Buffer.byteLength(raw)
    dictsById[id] = JSON.parse(raw)
  }

  const { index, stats } = buildWordIndexData(dictsById)
  const json = JSON.stringify(index)
  fs.writeFileSync(OUT_FILE, json + '\n')

  const rawBytes = Buffer.byteLength(json)
  const gzipBytes = zlib.gzipSync(json, { level: 9 }).length
  const kb = (n) => (n / 1024).toFixed(1)
  console.log(
    `[gen-word-index] 词 ${stats.totalWords} 条（去重后 ${stats.uniqueWords} 条，alt 修补 ${stats.altCount} 条）` +
      ` → ${OUT_FILE}`
  )
  console.log(
    `[gen-word-index] 源词典 ${kb(sourceBytes)}KB → 索引原始 ${kb(rawBytes)}KB / gzip ${kb(gzipBytes)}KB`
  )
}

// 被 import 时（等价性测试）不执行 CLI 写盘
import { pathToFileURL } from 'node:url'
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main()
}
