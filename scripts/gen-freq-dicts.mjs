/**
 * 生成高频词书：从完整词书中按 ECDICT 考试标签 + BNC/COCA 词频排名筛选核心子集。
 *
 * 数据源: ECDICT (https://github.com/skywind3000/ECDICT, MIT License)
 * 从其 SQLite 全量库导出的精简 TSV（仅含源词书涉及词条），列:
 *   word / tag(空格分隔考试标签，如 "cet4 toefl ielts gre") / bnc(BNC语料库词频排名)
 *   / frq(当代语料库词频排名) / oxford(牛津3000标注) / collins(柯林斯星级)
 *
 * 筛选规则: 考试大纲标签优先，再按语料库词频排名升序，取前 LIMIT 词，
 * 按频率从高到低分章（第 1 章即最高频词）。
 * 剔除「中考大纲词且词频排名前 500」的超基础词（in/on/go 等义务教育阶段
 * 已覆盖的词），避免它们挤占高频词书名额。
 *
 * 用法: node scripts/gen-freq-dicts.mjs <ecdict-slim.tsv 路径>
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DICTS_DIR = path.join(__dirname, '..', 'public', 'dictionaries')
const LIMIT = 1500
const CHAPTER_SIZE = 25
const CATEGORY = '留学英语'
// 词频排名不低于此值才视为非超基础词（前 500 大多为功能词与小学初中词汇）
const BASIC_RANK_THRESHOLD = 500

const TARGETS = [
  {
    id: 'ieltsfreq',
    source: 'ielts',
    tag: 'ielts',
    name: '雅思高频',
    description: '雅思高频核心词汇，依据 ECDICT 考试大纲标签与 BNC/COCA 词频筛选',
  },
  {
    id: 'toeflfreq',
    source: 'toefl',
    tag: 'toefl',
    name: '托福高频',
    description: '托福高频核心词汇，依据 ECDICT 考试大纲标签与 BNC/COCA 词频筛选',
  },
]

function loadEcdict(tsvPath) {
  const map = new Map()
  const lines = fs.readFileSync(tsvPath, 'utf-8').split(/\r?\n/)
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue
    const [word, tag, bnc, frq, oxford, collins] = line.split('\t')
    map.set(word.toLowerCase(), {
      tags: new Set((tag || '').split(/\s+/)),
      bnc: Number(bnc) || 0,
      frq: Number(frq) || 0,
      oxford: Number(oxford) || 0,
      collins: Number(collins) || 0,
    })
  }
  return map
}

// 词频排名取 BNC/COCA 中较优（数值小）者，两者皆缺视为最大
function freqRank(info) {
  const vals = [info.bnc, info.frq].filter((v) => v > 0)
  return vals.length ? Math.min(...vals) : 99999
}

function flattenWords(data) {
  return data.chapters.flatMap((c) => c.words)
}

function buildFreqDict(source, target, ecdict) {
  const words = flattenWords(source)
  const seen = new Set()
  const unique = []
  for (const w of words) {
    const key = w.name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(w)
  }

  const scored = unique.map((w) => {
    const info = ecdict.get(w.name.toLowerCase())
    const hasTag = info ? info.tags.has(target.tag) : false
    const rank = info ? freqRank(info) : 99999
    const isBasic = (info?.tags.has('zk') || false) && rank <= BASIC_RANK_THRESHOLD
    return {
      word: w,
      hasTag,
      rank,
      oxford: info?.oxford || 0,
      collins: info?.collins || 0,
      isBasic,
    }
  })

  scored.sort(
    (a, b) =>
      Number(b.hasTag) - Number(a.hasTag) ||
      a.rank - b.rank ||
      b.oxford - a.oxford ||
      b.collins - a.collins ||
      a.word.name.localeCompare(b.word.name)
  )

  const picked = scored.filter((s) => s.hasTag && !s.isBasic).slice(0, LIMIT)
  const chapters = []
  for (let i = 0; i < picked.length; i += CHAPTER_SIZE) {
    const chunk = picked.slice(i, i + CHAPTER_SIZE)
    chapters.push({
      id: chapters.length + 1,
      name: `第 ${chapters.length + 1} 章`,
      words: chunk.map((c) => c.word),
    })
  }

  return {
    data: {
      id: target.id,
      name: target.name,
      description: target.description,
      category: CATEGORY,
      totalChapters: chapters.length,
      chapters,
    },
    stats: {
      unique: unique.length,
      tagged: scored.filter((s) => s.hasTag).length,
      excludedBasic: scored.filter((s) => s.hasTag && s.isBasic).length,
      picked: picked.length,
      rankMax: picked[picked.length - 1].rank,
      rankMin: picked[0].rank,
    },
  }
}

const tsvPath = process.argv[2]
if (!tsvPath) {
  console.error('用法: node scripts/gen-freq-dicts.mjs <ecdict-slim.tsv 路径>')
  process.exit(1)
}

const ecdict = loadEcdict(tsvPath)
console.log(`ECDICT 精简数据: ${ecdict.size} 词条`)

for (const target of TARGETS) {
  const source = JSON.parse(fs.readFileSync(path.join(DICTS_DIR, `${target.source}.json`), 'utf-8'))
  const { data, stats } = buildFreqDict(source, target, ecdict)
  const outPath = path.join(DICTS_DIR, `${target.id}.json`)
  fs.writeFileSync(outPath, JSON.stringify(data), 'utf-8')
  console.log(
    `${target.id}: 源词书去重 ${stats.unique} 词，带 ${target.tag} 大纲标签 ${stats.tagged} 词` +
      `（剔除超基础词 ${stats.excludedBasic}），入选 ${stats.picked} 词` +
      `（词频排名 ${stats.rankMin}~${stats.rankMax}），${data.totalChapters} 章 -> ${path.basename(outPath)}`
  )
}
