// 词性 → CSS 变量名映射（变量在 src/index.css 中按主题定义）
export const POS_VAR = {
  verb: '--word-verb',
  noun: '--word-noun',
  adjective: '--word-adjective',
  adverb: '--word-adverb',
  preposition: '--word-preposition',
  conjunction: '--word-conjunction',
  pronoun: '--word-pronoun',
  interjection: '--word-interjection',
  phrase: '--word-phrase',
  unknown: '--word-default',
}

// 词性 → 中文标签（用于 tooltip）
export const POS_LABEL = {
  verb: '动词',
  noun: '名词',
  adjective: '形容词',
  adverb: '副词',
  preposition: '介词',
  conjunction: '连词',
  pronoun: '代词',
  interjection: '叹词',
  phrase: '短语',
  unknown: '',
}

// 词性 → 颜色标记配色（参考 TEco Lab，rgba 带透明度直接用于 inline backgroundColor）
export const POS_HIGHLIGHT_COLOR = {
  verb: 'rgba(255, 107, 157, 0.35)',
  phrase: 'rgba(255, 107, 157, 0.35)',
  noun: 'rgba(78, 205, 196, 0.35)',
  adjective: 'rgba(69, 183, 209, 0.35)',
  adverb: 'rgba(69, 183, 209, 0.35)',
  preposition: 'rgba(150, 206, 180, 0.35)',
  conjunction: 'rgba(255, 234, 167, 0.45)',
  pronoun: 'rgba(255, 234, 167, 0.45)',
  interjection: 'rgba(255, 234, 167, 0.45)',
  unknown: '',
}

export function getPosHighlightColor(pos) {
  return POS_HIGHLIGHT_COLOR[pos] || ''
}

// CSS 变量表达式（用于 inline style）
export function getPosColor(pos) {
  const key = pos && POS_VAR[pos] ? pos : 'unknown'
  return `var(${POS_VAR[key]})`
}

// 从 trans 字段（如 "[v] 完成" / "[adv] 突然地" / "[v] 获取; [n] 接近"）解析首个词性
// 词典里词性标记是 [v] / [n] / [adj] / [a] / [adv] / [ad] / [prep] / [p] / [conj] / [pron] / [int] / [phr]
const POS_PATTERNS = [
  { re: /\[\s*v(?:\.|t|i)?\s*\]/i, pos: 'verb' },
  { re: /\[\s*n(?:\.|s)?\s*\]/i, pos: 'noun' },
  { re: /\[\s*adj?\.?\s*\]|\[\s*a\.?\s*\]/i, pos: 'adjective' },
  { re: /\[\s*adv\.?\s*\]|\[\s*ad\.?\s*\]/i, pos: 'adverb' },
  { re: /\[\s*prep\.?\s*\]|\[\s*p\.?\s*\]/i, pos: 'preposition' },
  { re: /\[\s*conj\.?\s*\]/i, pos: 'conjunction' },
  { re: /\[\s*pron\.?\s*\]/i, pos: 'pronoun' },
  { re: /\[\s*int(?:erj)?\.?\s*\]/i, pos: 'interjection' },
  { re: /\[\s*phr(?:ase)?\.?\s*\]/i, pos: 'phrase' },
]

// 行内缩写词性标注（无方括号）：匹配以 POS 缩写开头的字符串
// 顺序关键：vt./vi. 在 v. 前，adj. 在 a. 前
const INLINE_POS_PATTERNS = [
  { re: /^\s*v[ti]\s*[.\/&]/i, pos: 'verb' },
  { re: /^\s*v\s*[.\/&]/i, pos: 'verb' },
  { re: /^\s*n\s*[.\/&]/i, pos: 'noun' },
  { re: /^\s*adj\s*[.\/&]/i, pos: 'adjective' },
  { re: /^\s*a\s*[.\/&]/i, pos: 'adjective' },
  { re: /^\s*adv\s*[.\/&]/i, pos: 'adverb' },
  { re: /^\s*ad\s*[.\/&]/i, pos: 'adverb' },
  { re: /^\s*prep\s*[.\/&]/i, pos: 'preposition' },
  { re: /^\s*conj\s*[.\/&]/i, pos: 'conjunction' },
  { re: /^\s*pron\s*[.\/&]/i, pos: 'pronoun' },
  { re: /^\s*int\s*[.\/&]/i, pos: 'interjection' },
]

export function parsePosFromTrans(trans) {
  let entries = trans
  if (typeof trans === 'string') entries = [trans]
  if (!Array.isArray(entries) || entries.length === 0) return 'unknown'
  const first = String(entries[0] || '')
  for (const { re, pos } of POS_PATTERNS) {
    if (re.test(first)) return pos
  }
  for (const { re, pos } of INLINE_POS_PATTERNS) {
    if (re.test(first)) return pos
  }
  return 'unknown'
}

// 词典难度优先级（高到低）。用于词卡排序：靠前的视为更难/更重要
export const DICT_PRIORITY = [
  'postgraduate',
  'tem8',
  'tem4',
  'ielts',
  'toefl',
  'sat',
  'cet6',
  'cet6freq',
  'cet4',
  'cet4freq',
  'gaokao',
  'senior',
  'zhongkao',
  'junior',
  'programmer',
]

// 词卡过滤分组 → 涉及的词典 id 列表
export const VOCAB_FILTER_GROUPS = {
  全部: null, // null 代表不过滤
  六级: ['cet6', 'cet6freq'],
  考研: ['postgraduate'],
  雅思: ['ielts'],
  专四: ['tem4'],
  专八: ['tem8'],
}

export const VOCAB_FILTER_KEYS = ['全部', '六级', '考研', '雅思', '专四', '专八']

// 词典 id → 简短显示标签
export const DICT_BADGE_LABEL = {
  junior: '初中',
  zhongkao: '中考',
  senior: '高中',
  gaokao: '高考',
  cet4: '四级',
  cet4freq: '四级',
  cet6: '六级',
  cet6freq: '六级',
  tem4: '专四',
  tem8: '专八',
  ielts: '雅思',
  toefl: '托福',
  sat: 'SAT',
  postgraduate: '考研',
  programmer: '程序员',
}

// 词典 id → 徽章 tailwind class（必须用字面量字符串，tailwind 才能扫描到）
export const DICT_BADGE_CLASS = {
  junior:       'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  zhongkao:     'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  senior:       'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300',
  gaokao:       'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300',
  cet4:         'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  cet4freq:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  cet6:         'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  cet6freq:     'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  tem4:         'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  tem8:         'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  ielts:        'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  toefl:        'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300',
  sat:          'bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300',
  postgraduate: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  programmer:   'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300',
}

// 停用词 —— cloze 与词卡都过滤
export const STOP_WORDS = new Set([
  'a','an','the','and','or','but','if','then','else','of','to','in','on','at','by','for','with',
  'as','is','am','are','was','were','be','been','being','do','does','did','done','have','has','had',
  'i','you','he','she','it','we','they','me','him','her','us','them','my','your','his','its','our',
  'their','this','that','these','those','here','there','when','where','why','how','what','which',
  'who','whom','whose','not','no','yes','so','than','too','very','can','could','will','would','shall',
  'should','may','might','must','from','up','down','out','off','over','under','again','about',
  'into','through','before','after','above','below','between','any','all','some','more','most',
  'other','such','only','own','same','also','just','now','one','two','three','don','doesn',
  'didn','isn','aren','wasn','weren','haven','hasn','hadn','won','wouldn','shouldn','couldn',
  'mustn','let','lets','re','ve','ll','d','s','t','m','o',
])

// 简单 mulberry32 伪随机数（确定性 seed）—— 用于 cloze 选择
function mulberry32(seed) {
  let s = seed >>> 0
  return function () {
    s |= 0
    s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 从英文句子里提取适合挖空的 token 索引集合
// tokens: [{ raw, lower, isWord }] - 所有 token（含标点）
// posMap: Map<word, pos>
// density: 期望挖空比例（默认 0.25）
// 返回: Set<number> token 索引
export function pickClozeIndices(tokens, posMap, sub, density = 0.25) {
  if (!Array.isArray(tokens) || tokens.length === 0) return new Set()

  const candidates = []
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (!t.isWord) continue
    if (STOP_WORDS.has(t.lower)) continue
    if (t.lower.length < 3) continue
    const pos = posMap?.get(t.lower) || 'unknown'
    let score = 1
    if (pos === 'verb' || pos === 'noun') score = 3
    else if (pos === 'adjective' || pos === 'adverb') score = 2
    candidates.push({ index: i, score })
  }

  if (candidates.length === 0) return new Set()

  // 用 sub.id 作为种子，确保同一字幕 cloze 结果稳定
  const seed = (typeof sub?.id === 'number' ? sub.id : 0) * 9301 + 49297
  const rng = mulberry32(seed)
  // 加入扰动后按分数+随机数排序，取前 N 个
  const ranked = candidates
    .map((c) => ({ ...c, rand: c.score + rng() }))
    .sort((a, b) => b.rand - a.rand)

  const target = Math.max(1, Math.floor(candidates.length * density))
  const picked = new Set()
  for (let i = 0; i < ranked.length && picked.size < target; i++) {
    picked.add(ranked[i].index)
  }
  return picked
}

// 把英文句子拆成 token，保留标点位置
const TOKEN_REGEX = /[a-zA-Z]+(?:['-][a-zA-Z0-9]+)*|[^a-zA-Z]+/g

export function tokenizeEnglish(text) {
  if (!text) return []
  const out = []
  const re = new RegExp(TOKEN_REGEX.source, 'g')
  let m
  while ((m = re.exec(text)) !== null) {
    const raw = m[0]
    const isWord = /^[a-zA-Z]/.test(raw)
    out.push({
      raw,
      lower: isWord ? raw.toLowerCase().replace(/[^a-z'-]/g, '') : '',
      isWord,
      offset: m.index,
    })
  }
  return out
}
