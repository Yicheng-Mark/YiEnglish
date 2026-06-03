/**
 * SAT & 考研词库数据质量修复脚本
 *
 * 用法：
 *   node scripts/fix-sat-postgrad.mjs           # 修复两个词库
 *   node scripts/fix-sat-postgrad.mjs --sat      # 只修复 SAT
 *   node scripts/fix-sat-postgrad.mjs --postgrad # 只修复考研
 *   node scripts/fix-sat-postgrad.mjs --dry-run  # 只输出报告，不写入文件
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DICT_DIR = resolve(ROOT, 'src/dictionaries')

// ─── CLI 参数 ────────────────────────────────────────────────
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const DO_SAT = args.includes('--sat') || (!args.includes('--postgraduate') && !args.includes('--postgrad'))
const DO_POSTGRAD = args.includes('--postgrad') || args.includes('--postgraduate') || (!args.includes('--sat'))

// ─── 日志 ────────────────────────────────────────────────────
const log = []
const manualReview = []

function report(stage, word, action, detail) {
  log.push({ stage, word, action, detail })
}

function review(stage, word, detail) {
  manualReview.push({ stage, word, detail })
}

function printReport() {
  console.log('\n' + '='.repeat(60))
  console.log('修复报告')
  console.log('='.repeat(60))

  // 按阶段分组统计
  const byStage = {}
  for (const entry of log) {
    if (!byStage[entry.stage]) byStage[entry.stage] = []
    byStage[entry.stage].push(entry)
  }

  for (const [stage, entries] of Object.entries(byStage)) {
    console.log(`\n── ${stage} (${entries.length} 条) ──`)
    for (const e of entries.slice(0, 30)) {
      console.log(`  ${e.word}: ${e.action}${e.detail ? ' → ' + e.detail : ''}`)
    }
    if (entries.length > 30) {
      console.log(`  ... 还有 ${entries.length - 30} 条`)
    }
  }

  if (manualReview.length > 0) {
    console.log('\n' + '='.repeat(60))
    console.log(`需要人工审核 (${manualReview.length} 条)`)
    console.log('='.repeat(60))
    for (const e of manualReview) {
      console.log(`  [${e.stage}] ${e.word}: ${e.detail}`)
    }
  }

  console.log(`\n总计自动修复: ${log.length} 条`)
  console.log(`待人工审核: ${manualReview.length} 条`)
  console.log(`模式: ${DRY_RUN ? 'dry-run (未写入文件)' : '已写入文件'}`)
}

// ─── 工具函数 ────────────────────────────────────────────────
function loadDict(filename) {
  const path = resolve(DICT_DIR, filename)
  return JSON.parse(readFileSync(path, 'utf-8'))
}

function saveDict(filename, data) {
  const path = resolve(DICT_DIR, filename)
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8')
}

function getAllWords(dict) {
  return dict.chapters.flatMap(c => c.words)
}

function countWords(dict) {
  return dict.chapters.reduce((sum, c) => sum + c.words.length, 0)
}

// 从其他词库构建音标查找表
function buildPhoneticMap() {
  const map = new Map()
  const otherDicts = ['cet4.json', 'cet6.json', 'ielts.json', 'toefl.json', 'tem4.json', 'tem8.json',
    'junior.json', 'senior.json', 'gaokao.json']
  for (const f of otherDicts) {
    try {
      const dict = loadDict(f)
      const words = getAllWords(dict)
      for (const w of words) {
        const key = w.name.toLowerCase()
        if (!map.has(key)) {
          map.set(key, {
            usphone: w.usphone || w.us || '',
            ukphone: w.ukphone || w.uk || ''
          })
        }
      }
    } catch (e) {
      // 跳过不存在的文件
    }
  }
  return map
}

// ──────────────────────────────────────────────────────────────
// SAT 词库修复
// ──────────────────────────────────────────────────────────────

function fixSAT() {
  console.log('\n' + '─'.repeat(40))
  console.log('修复 SAT 词库')
  console.log('─'.repeat(40))

  const dict = loadDict('sat.json')
  const beforeCount = countWords(dict)
  const words = getAllWords(dict)

  // ═══ S1: 清理乱码/OCR 错误字符 ═══
  const garbledMap = [
    ['吸弓丨', '吸引'],
    ['达至ij', '达到'],
    ['达至IJ', '达到'],
    ['女昏女因', '婚姻'],
    ['女昏', '婚'],
    ['女因', '姻'],
    ['臣卜', '卧'],
    ['明谋', '阴谋'],
    ['力卩', '加'],
    ['力大无t匕', '力大无比'],
    ['无t匕', '无比'],
    ['不规贝', '不规则的'],
    ['育旨', '能'],
    ['會旨', '智'],
    ['意夕卜', '意外'],
    ['岑匕仪', '礼节'],
    ['bankr叩', ''],
    ['If 巳', ''],
    ['If巳', ''],
  ]

  // `丄` 是 OCR 乱码前缀，删除它
  const garbledPrefixes = ['丄']

  for (const w of words) {
    let changed = false
    const newTrans = w.trans.map(t => {
      let s = t
      for (const [garbled, correct] of garbledMap) {
        if (s.includes(garbled)) {
          s = s.replaceAll(garbled, correct)
          changed = true
        }
      }
      for (const prefix of garbledPrefixes) {
        if (s.includes(prefix)) {
          s = s.replaceAll(prefix, '')
          changed = true
        }
      }
      return s
    })
    if (changed) {
      report('S1-乱码修复', w.name, '替换乱码字符', `"${w.trans}" → "${newTrans}"`)
      w.trans = newTrans
    }
  }

  // ═══ S2: 修复残缺领域标签 ═══
  // 匹配 "法] xxx" 但前面没有 "[" 的情况 → 改为 "[法]"
  // 用简单字符串替换代替正则，避免特殊字符转义问题
  const domainTagPatterns = [
    { search: '物化]', replace: '[物化]' },
    { search: '物][生化]', replace: '[物][生化]' },
    { search: '金融]', replace: '[金融]' },
    { search: '法]', replace: '[法]' },
    { search: '医]', replace: '[医]' },
    { search: '数]', replace: '[数]' },
    { search: '植]', replace: '[植]' },
    { search: '航]', replace: '[航]' },
    { search: '军]', replace: '[军]' },
    { search: '地]', replace: '[地]' },
    { search: '宗]', replace: '[宗]' },
    { search: '天]', replace: '[天]' },
    { search: '乐]', replace: '[乐]' },
    { search: '建]', replace: '[建]' },
    { search: '动]', replace: '[动]' },
    { search: '史]', replace: '[史]' },
    { search: '政]', replace: '[政]' },
    { search: '文]', replace: '[文]' },
    { search: '商]', replace: '[商]' },
    { search: '体]', replace: '[体]' },
    // 短标签放后面，避免被先匹配
    { search: '物]', replace: '[物]' },
    { search: '化]', replace: '[化]' },
    { search: '生]', replace: '[生]' },
  ]

  for (const w of words) {
    let changed = false
    const newTrans = w.trans.map(t => {
      let s = t
      for (const { search, replace: repl } of domainTagPatterns) {
        // 只有前面不是 [ 时才替换
        let idx
        while ((idx = s.indexOf(search)) !== -1) {
          // 检查前面一个字符是否是 [
          if (idx > 0 && s[idx - 1] === '[') {
            break // 已经正确，跳过
          }
          s = s.substring(0, idx) + repl + s.substring(idx + search.length)
          changed = true
        }
      }
      return s
    })
    if (changed) {
      report('S2-领域标签', w.name, '修复残缺标签', `"${w.trans}" → "${newTrans}"`)
      w.trans = newTrans
    }
  }

  // ═══ S3: 删除"人名"类释义 ═══
  for (const w of words) {
    const before = w.trans.length
    w.trans = w.trans.filter(t => !t.includes('人名'))
    if (w.trans.length < before) {
      report('S3-删除人名', w.name, `移除 ${before - w.trans.length} 条人名释义`)
      if (w.trans.length === 0) {
        review('S3', w.name, '所有人名释义已移除，无剩余释义，需补充')
      }
    }
  }

  // ═══ S4: 修剪截断的释义尾部 ═══
  // 只裁剪最后一个分号后的截断片段（1-2字的孤立项），保留前面有意义的部分
  // 例如 "吸收；吸引；承受；理解；使" → "吸收；吸引；承受；理解"
  const truncateChars = new Set(['使', '对', '把', '用', '给', '受', '将', '让', '被', '向'])
  for (const w of words) {
    let changed = false
    const newTrans = w.trans.map(t => {
      // 按中文/英文分号拆分，看最后一个片段
      const parts = t.split(/[；;]/)
      if (parts.length < 2) return t // 只有一个片段，不过滤
      const lastPart = parts[parts.length - 1].trim()
      // 如果最后一个片段只有 1-2 个字符且是截断词，裁掉它
      if (lastPart.length <= 2 && truncateChars.has(lastPart)) {
        changed = true
        const result = parts.slice(0, -1).join('；')
        report('S4-截断裁剪', w.name, `裁掉尾部 "${lastPart}"`, `"${t}" → "${result}"`)
        return result
      }
      return t
    })
    if (changed) {
      w.trans = newTrans
    }
  }

  // ═══ S5: 清理英文混入 ═══
  for (const w of words) {
    let changed = false
    const newTrans = w.trans.map(t => {
      let s = t
      // 移除中文括号中的英文语法注释，如 （celebrate的过去式和过去分词）
      s = s.replace(/[（(][^）)]*[a-zA-Z]{4,}[^）)]*[）)]/g, '')
      // 移除末尾的英文残余，如 "foolish; idiotic. If"
      s = s.replace(/[;；]\s*[a-zA-Z][a-zA-Z\s;,.]+$/
        , '')
      // 移除 "名词xxx，副词xxx" 这类语法注释尾巴
      s = s.replace(/[,，]\s*名词[^,，;；]+$/,'')
      s = s.replace(/[,，]\s*副词[^,，;；]+$/,'')
      return s.trim()
    }).filter(t => t.length > 0)
    if (newTrans.length !== w.trans.length || newTrans.some((t, i) => t !== w.trans[i])) {
      report('S5-英文清理', w.name, '清理英文混入')
      w.trans = newTrans
    }
  }

  // ═══ S6: 去重 ═══
  for (const w of words) {
    const before = w.trans.length
    const seen = new Set()
    w.trans = w.trans.filter(t => {
      const key = t.trim()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    if (w.trans.length < before) {
      report('S6-去重', w.name, `移除 ${before - w.trans.length} 条重复释义`)
    }
  }

  // ═══ S7: 词性标注修正 ═══
  // 已知的 POS 不匹配条目（POS 与实际释义内容不符）
  const posFixes = {
    'aboriginal': { 1: 'n' },       // adj. 土著居民 → n. 土著居民
    'academic': { 1: 'n' },          // adj. 大学生 → n. 大学生
    'accessory': { 0: 'adj' },       // n. 副的 → adj. 副的
    'adept': { 1: 'n' },             // adj. 内行 → n. 内行
    'adulterate': { 0: 'adj' },      // v. 通奸的 → adj. 通奸的
    'ancillary': { 1: 'n' },         // adj. 助手 → n. 助手
    'anesthetic': { 1: 'adj' },      // n. 麻醉的 → adj. 麻醉的
    'antiseptic': { 1: 'adj' },      // n. 防腐的 → adj. 防腐的
    'appropriate': { 1: 'adj' },     // v. 适当的 → adj. 适当的
    'ascetic': { 1: 'n' },           // adj. 苦行者 → n. 苦行者
    'badger': { 1: 'n' },            // v. 獾 → n. 獾
    'balk': { 1: 'n' },              // v. 障碍 → n. 障碍
    'burgeon': { 1: 'n' },           // v. 芽 → n. 芽
    'cardinal': { 1: 'n' },          // adj. 红衣主教 → n. 红衣主教
    'celibate': { 1: 'n' },          // adj. 独身者 → n. 独身者
    'champion': { 1: 'n' },          // v. 冠军 → n. 冠军
    'cognate': { 1: 'n' },           // adj. 同族 → n. 同族
    'complement': { 1: 'n' },        // v. 补语 → n. 补语
    'component': { 1: 'adj' },       // n. 组成的 → adj. 组成的
    'wanton': { 1: 'n' },            // adj. 荡妇 → n. 荡妇
  }

  for (const w of words) {
    const fixes = posFixes[w.name.toLowerCase()]
    if (!fixes) continue
    for (const [idx, newPOS] of Object.entries(fixes)) {
      const i = parseInt(idx)
      if (i >= w.trans.length) continue
      const old = w.trans[i]
      // 替换开头的 POS 标签 (v. / n. / adj. / adv.)
      const newT = old.replace(/^(v|n|adj|adv|prep|conj|pron|art|vt|vi)\.\s*/, `${newPOS}. `)
      if (newT !== old) {
        report('S7-词性修正', w.name, `"${old}" → "${newT}"`)
        w.trans[i] = newT
      }
    }
  }

  // ═══ S8: 修正特定错误释义 ═══
  const defFixes = {
    'xenophobia': ['n. 仇外，惧外；排外心理'],
    'windfall': ['n. 意外的收获；被风吹落的果实'],
  }

  for (const w of words) {
    const fixes = defFixes[w.name.toLowerCase()]
    if (!fixes) continue
    report('S8-释义修正', w.name, `"${w.trans}" → "${fixes}"`)
    w.trans = fixes
  }

  // ═══ S9: 格式转换 数组 → 方括号字符串 ═══
  for (const w of words) {
    if (!Array.isArray(w.trans)) continue

    // 解析每个 trans 条目: "v. 释义" → { pos: "v", text: "释义" }
    const parsed = []
    for (const t of w.trans) {
      const match = t.match(/^(v|vt|vi|n|ns|adj|adv|prep|conj|pron|int|art|interj|phr|phrase)\.\s*(.*)$/i)
      if (match) {
        const pos = match[1].toLowerCase()
        let text = match[2].trim()
        // 中文分号 → 逗号（同 POS 内部分隔）
        text = text.replace(/[；;]/g, '，')
        // 去掉多余空格
        text = text.replace(/\s+/g, '').replace(/，+/g, '，')
        // 去掉首尾逗号
        text = text.replace(/^[，]+|[，]+$/g, '')
        parsed.push({ pos, text })
      } else {
        // 没有 POS 标签的，保留原文
        parsed.push({ pos: null, text: t })
      }
    }

    // 按 POS 分组合并
    const posGroups = new Map()
    for (const p of parsed) {
      const key = p.pos || 'unk'
      if (!posGroups.has(key)) posGroups.set(key, [])
      posGroups.get(key).push(p.text)
    }

    // 组装目标字符串
    const parts = []
    for (const [pos, texts] of posGroups) {
      const merged = texts.join('，').replace(/，+/g, '，').replace(/^[，]+|[，]+$/g, '')
      parts.push(`[${pos}] ${merged}`)
    }

    const newTrans = parts.join('；')
    report('S9-格式转换', w.name, `数组 → 字符串`, `"${newTrans}"`)
    w.trans = newTrans
  }

  // ═══ 写回数据 ═══
  const afterCount = countWords(dict)
  if (beforeCount !== afterCount) {
    console.error(`词数变化！之前: ${beforeCount}, 之后: ${afterCount}`)
  }

  // 统计实际修复的词数
  const fixedWords = new Set(log.map(e => e.word))
  console.log(`\nSAT 词库: ${beforeCount} 词, 修复 ${fixedWords.size} 词`)

  if (!DRY_RUN) {
    saveDict('sat.json', dict)
    console.log('已写入 src/dictionaries/sat.json')
  }

  return dict
}

// ──────────────────────────────────────────────────────────────
// 考研词库修复
// ──────────────────────────────────────────────────────────────

function fixPostgrad() {
  console.log('\n' + '─'.repeat(40))
  console.log('修复考研词库')
  console.log('─'.repeat(40))

  const dict = loadDict('postgraduate.json')
  const beforeCount = countWords(dict)
  const words = getAllWords(dict)

  // ═══ P1: 修复双分号 ;; ═══
  for (const w of words) {
    if (typeof w.trans !== 'string') continue
    const before = w.trans
    while (w.trans.includes(';;')) {
      w.trans = w.trans.replace(/;;/g, ';')
    }
    if (w.trans !== before) {
      report('P1-双分号', w.name, `"${before}" → "${w.trans}"`)
    }
  }

  // ═══ P2: 删除尾部多余分号 ═══
  for (const w of words) {
    if (typeof w.trans !== 'string') continue
    const before = w.trans
    w.trans = w.trans.replace(/[;；\s]+$/, '')
    if (w.trans !== before) {
      report('P2-尾部分号', w.name, `"${before}" → "${w.trans}"`)
    }
  }

  // ═══ P3: 修复缺失/错误词性括号 ═══
  const bracketFixes = {
    'classmate': '[n] 同班同学',
    'cue': '[n] 暗示，提示，球杆',
    'poster': '[n] 海报，张贴的大幅广告',
    'they': '[pron] 他们，她们，它们；人们',
  }

  for (const w of words) {
    const fix = bracketFixes[w.name.toLowerCase()]
    if (!fix) continue
    report('P3-括号修复', w.name, `"${w.trans}" → "${fix}"`)
    w.trans = fix
  }

  // ═══ P4: 修正错误词性 ═══
  const posFixes = {
    'account': '[n] 叙述，说明；账目，账户；[vi] 说明，解释',
    'both': '[pron] 两者(都)，双方(都)；[adj] 两个…(都)',
  }

  for (const w of words) {
    const fix = posFixes[w.name.toLowerCase()]
    if (!fix) continue
    report('P4-词性修正', w.name, `"${w.trans}" → "${fix}"`)
    w.trans = fix
  }

  // ═══ P5: 规范化非标准词性标签 ═══
  const posTagMap = [
    // 代词类
    [/\[he的所有格\/物主代词\]/g, '[pron]'],
    [/\[he的宾格\]/g, '[pron]'],
    [/\[she的宾格\]/g, '[pron]'],
    [/\[she的所有格\]/g, '[pron]'],
    [/\[she的物主代词\]/g, '[pron]'],
    [/\[反身代词\]/g, '[pron]'],
    [/\[I 的宾格\]/g, '[pron]'],
    [/\[it的所有格\]/g, '[pron]'],
    [/\[they的所有格\]/g, '[pron]'],
    [/\[they的物主代词\]/g, '[pron]'],
    [/\[we的所有格\]/g, '[pron]'],
    [/\[we的物主代词\]/g, '[pron]'],
    [/\[you的所有格\]/g, '[pron]'],
    [/\[you的物主代词\]/g, '[pron]'],
    [/\[this的复数\]/g, '[pron]'],
    [/\[that的复数\]/g, '[pron]'],
    // 冠词
    [/\[the[-~]\]/g, '[art]'],
    [/\[the T-s\]/g, '[art]'],
    // 注意: [the R-] 不是冠词，是 "the Renaissance" 的缩写，保留不动
    // [S -用于姓名前] 如 "Sir" 用法，保留不动
    // 名词
    [/\[集合名词\]/g, '[n]'],
    // 连词
    [/\[引导从句\]/g, '[conj]'],
    [/\[引导名词从句\]/g, '[conj]'],
    [/\[与or连用\]/g, '[conj]'],
    // 副词
    [/\[作无人称动词的主语\]/g, '[adv]'],
    [/\[一般用于否定句或疑问句中\]/g, '[adv]'],
    [/\[用于肯定句前\]/g, '[adv]'],
    [/\[表否定\]/g, '[adv]'],
    [/\[表肯定\]/g, '[adv]'],
    [/\[nevertheless\]/gi, '[adv]'],
    // 介词
    [/\[with\]/gi, '[prep]'],
    // 叹词
    [/\[呼救\]/g, '[interj]'],
    // 注意: [天主教]、[装置]、[时期]、[风]、[点,物]、[榜样]、[指飞机] 等是语境/领域标签，保留不动
  ]

  for (const w of words) {
    if (typeof w.trans !== 'string') continue
    let changed = false
    let s = w.trans
    for (const [pattern, replacement] of posTagMap) {
      if (pattern.test(s)) {
        s = s.replace(pattern, replacement)
        changed = true
      }
    }
    if (changed) {
      report('P5-标签规范化', w.name, `"${w.trans}" → "${s}"`)
      w.trans = s
    }
  }

  // ═══ P6: 补充空音标 ═══
  const phoneticMap = buildPhoneticMap()
  let filledCount = 0
  let unfilled = []

  for (const w of words) {
    const hasEmpty = (!w.uk || w.uk.trim() === '') && (!w.us || w.us.trim() === '')
    if (!hasEmpty) continue

    const key = w.name.toLowerCase()
    const lookup = phoneticMap.get(key)
    if (lookup) {
      if (!w.uk || w.uk.trim() === '') w.uk = lookup.ukphone
      if (!w.us || w.us.trim() === '') w.us = lookup.usphone
      filledCount++
      report('P6-补充音标', w.name, `从其他词库找到音标: uk=${w.uk}, us=${w.us}`)
    } else {
      unfilled.push(w.name)
      review('P6', w.name, '其他词库未找到音标，需手动补充')
    }
  }

  console.log(`\n音标补充: ${filledCount} 个自动填充, ${unfilled.length} 个待手动补充`)
  if (unfilled.length > 0 && unfilled.length <= 30) {
    console.log('待补充: ' + unfilled.join(', '))
  } else if (unfilled.length > 30) {
    console.log('待补充 (前30): ' + unfilled.slice(0, 30).join(', ') + ` ... 共${unfilled.length}个`)
  }

  // ═══ P7: 删除空 phrases 字段 ═══
  let phrasesRemoved = 0
  for (const w of words) {
    if (w.phrases && Array.isArray(w.phrases) && w.phrases.length === 0) {
      delete w.phrases
      phrasesRemoved++
    }
  }
  console.log(`删除空 phrases: ${phrasesRemoved} 条`)

  // ═══ P8: 补充元数据 ═══
  if (!dict.description) {
    dict.description = '考研英语核心词汇'
  }
  if (!dict.category) {
    dict.category = '考研英语'
  }

  // ═══ P9: 标点规范化 ═══
  for (const w of words) {
    if (typeof w.trans !== 'string') continue
    const before = w.trans
    // 中文逗号统一为半角逗号+无空格（与用户要求的格式一致）
    // 用户格式: [adj] 暴力的,猛烈的;[n] 暴力,暴行 — 用半角逗号
    // 统一为: POS间用 ; 分隔，释义内用 , 分隔
    let s = w.trans
    // 全角逗号 → 半角逗号
    s = s.replace(/，/g, ',')
    // 全角分号 → 半角分号
    s = s.replace(/；/g, ';')
    // 修复双逗号
    while (s.includes(',,')) s = s.replace(/,,/g, ',')
    // 修复双分号
    while (s.includes(';;')) s = s.replace(/;;/g, ';')
    // 去掉尾部标点
    s = s.replace(/[,;]+$/, '')
    if (s !== before) {
      report('P9-标点规范', w.name, `"${before}" → "${s}"`)
      w.trans = s
    }
  }

  // ═══ 写回数据 ═══
  const afterCount = countWords(dict)
  if (beforeCount !== afterCount) {
    console.error(`词数变化！之前: ${beforeCount}, 之后: ${afterCount}`)
  }

  const fixedWords = new Set(log.filter(e => e.stage.startsWith('P')).map(e => e.word))
  console.log(`\n考研词库: ${beforeCount} 词, 修复 ${fixedWords.size} 词`)

  if (!DRY_RUN) {
    saveDict('postgraduate.json', dict)
    console.log('已写入 src/dictionaries/postgraduate.json')
  }

  return dict
}

// ─── 主函数 ──────────────────────────────────────────────────
console.log('SAT & 考研词库修复脚本')
console.log(`SAT: ${DO_SAT ? '✓' : '✗'}  考研: ${DO_POSTGRAD ? '✓' : '✗'}  Dry-run: ${DRY_RUN ? '✓' : '✗'}`)

if (DO_SAT) fixSAT()
if (DO_POSTGRAD) fixPostgrad()

printReport()
