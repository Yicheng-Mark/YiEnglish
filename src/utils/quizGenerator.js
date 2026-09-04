// @ts-check
// 测验题目生成的纯逻辑（从 src/hooks/useQuiz.js 抽出，行为保持一致）。
// 仅依赖词性解析，不依赖 React / AudioContext / DOM，便于单元测试。
//
// 本文件开启 // @ts-check 作为渐进类型化的示范点：用 JSDoc 标注类型，
// 在装有 TypeScript 的编辑器中获得类型检查与补全；项目整体仍是纯 JS，
// 不强制全量 checkJs（避免噪音），新写的纯函数模块可参照此模式补充 JSDoc。

import { parsePosFromTrans } from '../modules/corpus/utils/wordColorMap.js'

/**
 * @typedef {Object} Word 单词条目
 * @property {string} name 英文单词
 * @property {string} trans 中文释义（含词性标记，如 "[n] 苹果"）
 */

/**
 * @typedef {'en2cn' | 'cn2en' | 'listening'} QuestionType 题型
 */

/**
 * @typedef {Object} QuestionOption 单个选项
 * @property {string} label 选项展示文本
 * @property {boolean} isCorrect 是否为正确选项
 */

/**
 * @typedef {Object} Question 一道题目
 * @property {QuestionType} type 题型
 * @property {Word} stem 题干单词
 * @property {QuestionOption[]} options 打乱后的选项列表
 * @property {number} correctIndex 正确选项在 options 中的下标
 */

// ========== Levenshtein 编辑距离 ==========

/**
 * 计算两个字符串的 Levenshtein 编辑距离。
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function levenshtein(a, b) {
  const m = a.length,
    n = b.length
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] !== b[j - 1] ? 1 : 0)
      )
  return dp[m][n]
}

// ========== 工具函数 ==========

/**
 * Fisher–Yates 洗牌，返回新数组（不改原数组）。
 * @template T
 * @param {T[]} arr
 * @returns {T[]}
 */
export function shuffle(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 备用干扰词池——词本词数不足时自动补充，确保选择题始终有 4 个选项
/** @type {Word[]} */
export const FALLBACK_DISTRACTORS = [
  { name: 'apple', trans: '[n] 苹果' },
  { name: 'book', trans: '[n] 书籍；[v] 预订' },
  { name: 'cat', trans: '[n] 猫' },
  { name: 'dog', trans: '[n] 狗' },
  { name: 'water', trans: '[n] 水；[v] 浇水' },
  { name: 'house', trans: '[n] 房屋' },
  { name: 'time', trans: '[n] 时间；[v] 计时' },
  { name: 'people', trans: '[n] 人们' },
  { name: 'good', trans: '[adj] 好的' },
  { name: 'think', trans: '[v] 想；认为' },
  { name: 'world', trans: '[n] 世界' },
  { name: 'hand', trans: '[n] 手；[v] 递' },
  { name: 'place', trans: '[n] 地方；[v] 放置' },
  { name: 'great', trans: '[adj] 伟大的；很好的' },
  { name: 'small', trans: '[adj] 小的' },
  { name: 'begin', trans: '[v] 开始' },
  { name: 'number', trans: '[n] 数字；号码' },
  { name: 'story', trans: '[n] 故事' },
  { name: 'music', trans: '[n] 音乐' },
  { name: 'green', trans: '[adj] 绿色的；[n] 绿色' },
  { name: 'table', trans: '[n] 桌子' },
  { name: 'child', trans: '[n] 孩子' },
  { name: 'power', trans: '[n] 力量；权力' },
  { name: 'light', trans: '[n] 光；[adj] 轻的' },
  { name: 'grow', trans: '[v] 生长；增长' },
  { name: 'learn', trans: '[v] 学习' },
  { name: 'dream', trans: '[n] 梦；[v] 做梦' },
  { name: 'ocean', trans: '[n] 海洋' },
  { name: 'smile', trans: '[n] 微笑；[v] 微笑' },
  { name: 'brave', trans: '[adj] 勇敢的' },
]

/**
 * 生成干扰项
 * 1. 排除当前单词
 * 2. 优先同词性
 * 3. 排除形近词（编辑距离 ≤ 2）
 * 4. 随机取 count 个
 * 5. 词本词数不足时从备用池补充
 *
 * @param {Word} word 目标单词
 * @param {Word[]} allWords 全词本（干扰项候选池）
 * @param {QuestionType} type 题型
 * @param {number} [count=3] 需要的干扰项数量
 * @returns {Word[]}
 */
export function getDistractors(word, allWords, type, count = 3) {
  const candidates = allWords.filter((w) => w.name !== word.name)

  // 根据题型决定用哪个字段比较词性
  const pos = parsePosFromTrans(word.trans)

  // 排除形近词（编辑距离 ≤ 2），硬性规则不可放松
  const targetName = word.name.toLowerCase()
  const notSimilar = candidates.filter((w) => {
    return levenshtein(targetName, w.name.toLowerCase()) > 2
  })

  // 优先同词性 + 非形近
  let pool = notSimilar.filter((w) => parsePosFromTrans(w.trans) === pos)
  // 不够则降级为任意词性（形近词排除仍然生效）
  if (pool.length < count) pool = notSimilar

  let result = shuffle(pool).slice(0, count)

  // 词本词数不足时，从备用池补充干扰项
  if (result.length < count) {
    const existingNames = new Set([
      word.name.toLowerCase(),
      ...result.map((w) => w.name.toLowerCase()),
    ])
    const fallback = FALLBACK_DISTRACTORS.filter(
      (w) =>
        !existingNames.has(w.name.toLowerCase()) &&
        levenshtein(targetName, w.name.toLowerCase()) > 2
    )
    result = [...result, ...shuffle(fallback).slice(0, count - result.length)]
  }

  return result
}

/**
 * 生成单道题目
 * @param {Word} word 目标单词
 * @param {Word[]} allWords 全词本
 * @param {QuestionType} type 题型
 * @returns {Question}
 */
export function generateQuestion(word, allWords, type) {
  const distractors = getDistractors(word, allWords, type)

  let correctLabel
  if (type === 'en2cn' || type === 'listening') {
    // 选项是中文释义
    correctLabel = word.trans
  } else {
    // cn2en：选项是英文单词
    correctLabel = word.name
  }

  const correctOption = { label: correctLabel, isCorrect: true }
  const wrongOptions = distractors.map((w) => {
    const label = type === 'en2cn' || type === 'listening' ? w.trans : w.name
    return { label, isCorrect: false }
  })

  // 如果干扰项不足 3 个，有多少放多少
  const allOptions = [correctOption, ...wrongOptions]
  const shuffled = shuffle(allOptions)
  const correctIndex = shuffled.findIndex((o) => o.isCorrect)

  return {
    type,
    stem: word,
    options: shuffled,
    correctIndex,
  }
}

/**
 * 批量生成题目
 * @param {Word[]} words 本次出题的单词范围
 * @param {Word[]} allWords 全词本（干扰项候选池）
 * @param {QuestionType[]} questionTypes 题型池（每题随机取一种）
 * @param {number} count 题目数量
 * @returns {Question[]}
 */
export function generateQuestions(words, allWords, questionTypes, count) {
  // 题型池为空时随机取样会得到 undefined 并静默落入 cn2en，这里回退到默认题型
  /** @type {QuestionType[]} */
  const types = Array.isArray(questionTypes) && questionTypes.length > 0 ? questionTypes : ['en2cn']
  const sampled = shuffle(words).slice(0, count)
  return sampled.map((word) => {
    const type = types[Math.floor(Math.random() * types.length)]
    return generateQuestion(word, allWords, type)
  })
}
