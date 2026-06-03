/**
 * 词库数据质量修复脚本
 * 修复初中、高中、CET-4、CET-6 四个词库的数据问题
 *
 * 修复项：
 *   P0: 截断条目（& 和 / 结尾）、\n 换行符
 *   P1: 畸形 POS 标签
 *   P2: POS 缩写统一（a.→adj., ad.→adv.）、合并词性拆分
 *   P3: 特殊字符清理、多余空格、嵌入音标移除
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dictsDir = resolve(__dirname, '../src/dictionaries');

const FILES = [
  { file: 'junior.json', label: '初中' },
  { file: 'senior.json', label: '高中' },
  { file: 'cet4.json', label: 'CET-4' },
  { file: 'cet6.json', label: 'CET-6' },
];

// 统计
const stats = {
  truncatedAmpersand: 0,
  truncatedSlash: 0,
  newlinesSplit: 0,
  doubleDot: 0,
  malformedPOS: 0,
  iniToInt: 0,
  interjectionToInt: 0,
  hToN: 0,
  vmodToAux: 0,
  aToAdj: 0,
  adToAdv: 0,
  mergedPOSSplit: 0,
  privateUseChar: 0,
  fullWidthSpace: 0,
  doubleSpace: 0,
  embeddedPhonetic: 0,
  totalWords: 0,
  totalTrans: 0,
};

// 需要修复的详细日志
const log = [];

function addLog(dict, word, field, issue, fix) {
  log.push({ dict, word, field, issue, fix });
}

/**
 * 检查一个 trans 条目是否是截断的（& 或 / 结尾）
 */
function isTruncated(t) {
  // 匹配 "POS. &" 或 "POS. /" 模式
  return /^\s*(?:n|v|vt|vi|v\.mod|a|adj|ad|adv|prep|conj|pron|int|art|aux|num|abbr)\.\s*[&\/]\s*$/.test(t);
}

/**
 * 检查并修复字面量 \n（JSON 文件中的 \\n，解析后是反斜杠+n 两个字符）
 */
function fixNewlines(trans, dict, word) {
  const result = [];
  for (const t of trans) {
    // 匹配字面量 \n：反斜杠(0x5c) + n(0x6e)
    if (t.includes('\\n')) {
      // 不用 split('\\n') 因为反斜杠需要转义
      // 用正则按 \n 拆分（字面量反斜杠+n）
      const parts = t.split(/\\n/).map(s => s.trim()).filter(Boolean);
      stats.newlinesSplit++;
      addLog(dict, word, 'trans', `\\n 拆分: "${t.substring(0, 60)}..."`, `→ ${parts.length} 条`);
      result.push(...parts);
    } else {
      result.push(t);
    }
  }
  return result;
}

/**
 * 修复畸形 POS 标签
 */
function fixMalformedPOS(t, dict, word) {
  let fixed = t;

  // 双句号: "a. .数字的" → "a. 数字的"
  if (/^([a-z]+)\.\s*\.\s*/.test(fixed)) {
    const before = fixed;
    fixed = fixed.replace(/^([a-z]+)\.\s*\.\s*/, '$1. ');
    stats.doubleDot++;
    addLog(dict, word, 'trans', `双句号: "${before}"`, `→ "${fixed}"`);
  }

  // "adj. a." 畸形（只有 POS 没有释义）
  if (/^adj\.\s*a\.\s*$/.test(fixed)) {
    stats.malformedPOS++;
    addLog(dict, word, 'trans', `畸形POS: "${fixed}"`, '→ 删除');
    return null; // 标记删除
  }

  // "ini." → "int."
  if (fixed.startsWith('ini.')) {
    const before = fixed;
    fixed = fixed.replace(/^ini\./, 'int.');
    stats.iniToInt++;
    addLog(dict, word, 'trans', `ini.→int.: "${before}"`, `→ "${fixed}"`);
  }

  // "interjection." → "int."
  if (fixed.startsWith('interjection.')) {
    const before = fixed;
    fixed = fixed.replace(/^interjection\./, 'int.');
    stats.interjectionToInt++;
    addLog(dict, word, 'trans', `interjection.→int.: "${before}"`, `→ "${fixed}"`);
  }

  // "h." → "n." （仅当后面紧跟中文时）
  if (/^h\.\s*[一-鿿]/.test(fixed)) {
    const before = fixed;
    fixed = fixed.replace(/^h\./, 'n.');
    stats.hToN++;
    addLog(dict, word, 'trans', `h.→n.: "${before}"`, `→ "${fixed}"`);
  }

  // "v. mod." → "aux."
  if (fixed.startsWith('v. mod.')) {
    const before = fixed;
    fixed = fixed.replace(/^v\.\s*mod\./, 'aux.');
    stats.vmodToAux++;
    addLog(dict, word, 'trans', `v.mod.→aux.: "${before}"`, `→ "${fixed}"`);
  }

  return fixed;
}

/**
 * 统一 POS 缩写
 */
function unifyPOS(t, dict, word) {
  let fixed = t;

  // "a." → "adj." (形容词) — 匹配行首的 a. 后跟空格/中文
  // 注意不能匹配 adj. ad. art. abbr. aux. 等
  if (/^a\.\s/.test(fixed) && !/^(adj|ad|art|abbr|aux)\./.test(fixed)) {
    const before = fixed;
    fixed = fixed.replace(/^a\./, 'adj.');
    stats.aToAdj++;
    addLog(dict, word, 'trans', `a.→adj.: "${before}"`, `→ "${fixed}"`);
  }

  // "ad." → "adv." (副词) — 匹配行首的 ad. 后跟空格/中文
  if (/^ad\.\s/.test(fixed) && !/^(adj|adv)\./.test(fixed)) {
    const before = fixed;
    fixed = fixed.replace(/^ad\./, 'adv.');
    stats.adToAdv++;
    addLog(dict, word, 'trans', `ad.→adv.: "${before}"`, `→ "${fixed}"`);
  }

  return fixed;
}

/**
 * 拆分合并词性 "vt.vi." → 两条
 */
function splitMergedPOS(t, dict, word) {
  // 匹配 "vt.vi." 或 "vi.vt." 等合并格式
  const match = t.match(/^(vt|vi|v)\.(vt|vi|v)\.\s*(.*)/);
  if (match) {
    const [, pos1, pos2, meaning] = match;
    stats.mergedPOSSplit++;
    addLog(dict, word, 'trans', `合并词性: "${t}"`, `→ ["${pos1}. ${meaning}", "${pos2}. ${meaning}"]`);
    return [`${pos1}. ${meaning}`, `${pos2}. ${meaning}`];
  }
  return [t];
}

/**
 * 清理特殊字符和格式
 */
function cleanupChars(t, dict, word) {
  let fixed = t;

  // 移除 Unicode 私用区字符 (U+E000-U+F8FF)
  if (/[-]/.test(fixed)) {
    const before = fixed;
    fixed = fixed.replace(/[-]/g, '');
    stats.privateUseChar++;
    addLog(dict, word, 'trans', `私用字符: "${before}"`, `→ "${fixed}"`);
  }

  // 替换全角空格 (U+3000) 为普通空格
  if (/[　]/.test(fixed)) {
    const before = fixed;
    fixed = fixed.replace(/　/g, ' ');
    stats.fullWidthSpace++;
    addLog(dict, word, 'trans', `全角空格: "${before}"`, `→ "${fixed}"`);
  }

  // POS 后双空格 → 单空格（仅匹配 "POS.  " 两个及以上空格）
  if (/^([a-z]+\.)\s{2,}/.test(fixed)) {
    const before = fixed;
    fixed = fixed.replace(/^([a-z]+\.)\s{2,}/, '$1 ');
    stats.doubleSpace++;
    addLog(dict, word, 'trans', `多余空格: "${before}"`, `→ "${fixed}"`);
  }

  // 移除释义末尾嵌入的音标，如 "  [əˈbjuːs]"
  // 匹配：中文释义后跟空格+方括号内的IPA音标
  const phoneticMatch = fixed.match(/^(.+?)\s+\[[Ā-ʟɐ-ʯəɪʊɒʌæɑɜɔɛˈˌː.;\s\w]+\]\s*$/);
  if (phoneticMatch) {
    // 确认方括号内容确实是音标（包含 IPA 特征字符）
    const bracketContent = fixed.match(/\[([^\]]+)\]\s*$/);
    if (bracketContent) {
      const content = bracketContent[1];
      // 音标通常包含 ə, ɪ, ˈ, ː 等 IPA 字符
      if (/[əɪʊɒʌæɑɜɔɛˈˌː]/.test(content)) {
        const before = fixed;
        fixed = phoneticMatch[1];
        stats.embeddedPhonetic++;
        addLog(dict, word, 'trans', `嵌入音标: "${before}"`, `→ "${fixed}"`);
      }
    }
  }

  return fixed;
}

/**
 * 处理单个词库文件
 */
function processDict({ file, label }) {
  const filePath = resolve(dictsDir, file);
  const data = JSON.parse(readFileSync(filePath, 'utf-8'));

  let wordCount = 0;
  let transCount = 0;

  for (const chapter of data.chapters) {
    for (const word of chapter.words) {
      wordCount++;
      stats.totalWords++;

      // Step 1: 修复 \n 换行符（拆分为数组元素）
      let trans = fixNewlines(word.trans, label, word.name);

      // Step 2: 移除截断条目
      const beforeLen = trans.length;
      const truncated = trans.filter(t => isTruncated(t));
      for (const t of truncated) {
        if (/&\s*$/.test(t)) {
          stats.truncatedAmpersand++;
          addLog(label, word.name, 'trans', `& 截断: "${t}"`, '→ 删除');
        } else if (/\/\s*$/.test(t)) {
          stats.truncatedSlash++;
          addLog(label, word.name, 'trans', `/ 截断: "${t}"`, '→ 删除');
        }
      }
      trans = trans.filter(t => !isTruncated(t));

      // Step 3: 修复畸形 POS
      trans = trans.map(t => fixMalformedPOS(t, label, word.name)).filter(Boolean);

      // Step 4: 拆分合并词性
      trans = trans.flatMap(t => splitMergedPOS(t, label, word.name));

      // Step 5: 统一 POS 缩写
      trans = trans.map(t => unifyPOS(t, label, word.name));

      // Step 6: 清理特殊字符
      trans = trans.map(t => cleanupChars(t, label, word.name));

      // Step 7: 清理空字符串
      trans = trans.filter(t => t.trim().length > 0);

      transCount += trans.length;
      word.trans = trans;
    }
  }

  stats.totalTrans += transCount;

  // 写回文件
  writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  console.log(`✅ ${label}: ${wordCount} 词, ${transCount} 条释义已处理`);
}

// 主流程
console.log('=== 词库数据质量修复 ===\n');
for (const dict of FILES) {
  processDict(dict);
}

// 输出统计
console.log('\n=== 修复统计 ===');
console.log(`总词数: ${stats.totalWords}`);
console.log(`总释义条目: ${stats.totalTrans}`);
console.log('');
console.log(`P0 - 截断(&):       ${stats.truncatedAmpersand}`);
console.log(`P0 - 截断(/):       ${stats.truncatedSlash}`);
console.log(`P0 - \\n拆分:        ${stats.newlinesSplit}`);
console.log(`P1 - 双句号:        ${stats.doubleDot}`);
console.log(`P1 - 畸形POS:       ${stats.malformedPOS}`);
console.log(`P1 - ini.→int.:     ${stats.iniToInt}`);
console.log(`P1 - interj.→int.:  ${stats.interjectionToInt}`);
console.log(`P1 - h.→n.:         ${stats.hToN}`);
console.log(`P1 - v.mod.→aux.:   ${stats.vmodToAux}`);
console.log(`P2 - a.→adj.:       ${stats.aToAdj}`);
console.log(`P2 - ad.→adv.:      ${stats.adToAdv}`);
console.log(`P2 - 合并词性拆分:   ${stats.mergedPOSSplit}`);
console.log(`P3 - 私用字符:      ${stats.privateUseChar}`);
console.log(`P3 - 全角空格:      ${stats.fullWidthSpace}`);
console.log(`P3 - 多余空格:      ${stats.doubleSpace}`);
console.log(`P3 - 嵌入音标:      ${stats.embeddedPhonetic}`);

// 输出详细日志
console.log(`\n=== 详细修改 (${log.length} 条) ===`);
for (const entry of log) {
  console.log(`  [${entry.dict}] ${entry.word}: ${entry.issue}  ${entry.fix}`);
}
