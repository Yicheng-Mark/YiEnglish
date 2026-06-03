/**
 * align-dicts.mjs — 按官方考试大纲校准词库
 *
 * 数据源（全部在 scripts/ref/ 下）:
 *   - cet4.txt (mahavivo CET4_edited): 含音标+词性+释义，~4615词
 *   - cet6.txt (mahavivo CET6_edited): 含音标+词性+释义，~2200词
 *   - cet4plus6.txt (mahavivo CET_4+6_edited): 2016大纲词目列表
 *   - cet6_star.txt: CET-6纯增量词目
 *   - zhongkao.txt (mahavivo): 含音标+词性+释义，~1600词
 *   - highschool.txt (mahavivo Highschool_edited): 高中词目列表
 *   - kyle_*.json (KyleBing): 结构化音标+词性+释义（补充数据源）
 *
 * 用法:
 *   node scripts/align-dicts.mjs          # 全部
 *   node scripts/align-dicts.mjs junior    # 只初中
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REF_DIR = join(__dirname, 'ref');
const DICT_DIR = join(__dirname, '..', 'src', 'dictionaries');
const CHAPTER_SIZE = 25;

// ============================================================
// 工具函数
// ============================================================

function readFile(name) {
  const p = join(REF_DIR, name);
  if (!existsSync(p)) { console.error(`  ⚠️ 不存在: ${p}`); return ''; }
  return readFileSync(p, 'utf-8');
}

/** 解析 mahavivo CET4/CET6 格式:
 *  "abandon [əˈbændən] vt.丢弃；放弃"
 *  "abstract [ˈæbstrækt] a.抽象的 n.摘要 vt.摘录"
 *  "a art.一(个)"  (无音标)
 */
function parseMahavivoDict(filename) {
  const text = readFile(filename);
  const map = new Map();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || /^[A-Z]$/.test(line) || line.startsWith('#') ||
        line.startsWith('（') || line.startsWith('大学英语')) continue;

    let word, phonetic, posDef;

    // 带音标: word [phonetic] POS. definition
    const withPhonetic = line.match(/^([a-zA-Z][\w' -]*?)\s*\[([^\]]*)\]\s*(.+)$/);
    if (withPhonetic) {
      word = withPhonetic[1].trim();
      phonetic = withPhonetic[2].trim();
      posDef = withPhonetic[3].trim();
    } else {
      // 无音标: word POS. definition
      const noPhonetic = line.match(/^([a-zA-Z][\w' -]*?)\s+([a-z]+\.\s*.+)$/);
      if (noPhonetic) {
        word = noPhonetic[1].trim();
        phonetic = '';
        posDef = noPhonetic[2].trim();
      } else {
        continue; // 无法解析
      }
    }

    const key = word.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!key || map.has(key)) continue;

    // 解析词性和释义为 trans 数组
    const trans = parsePosDef(posDef);
    map.set(key, { name: word, phonetic, trans });
  }
  return map;
}

/** 将 "vt.丢弃；放弃  n.摘要" 转为 ["vt. 丢弃；放弃", "n. 摘要"]
 *  也处理 "n & v. 挑战" → ["n. 挑战", "v. 挑战"]
 *  也处理 "vt&vi&n. 攻击" → ["vt. 攻击", "vi. 攻击", "n. 攻击"]
 */
function parsePosDef(text) {
  // 去掉 || 分隔的短语搭配
  text = text.replace(/\s*\|\|.*$/, '').trim();
  if (!text) return [];

  const results = [];

  // 先按 "POS." 拆分段落（处理 "vt.释义1  n.释义2" 格式）
  // 注意：mahavivo CET6 有些行用 "·" 代替 "."，如 "adj·释义"
  text = text.replace(/([a-z]+)·/g, '$1.');
  const posPattern = /((?:(?:n|v[ti]?|adj|adv|a|art|prep|conj|pron|int(erj)?|num|aux|det)(?:\s*[&／/]\s*(?:n|v[ti]?|adj|adv|a|art|prep|conj|pron|int(erj)?|num|aux|det))*)\.)\s*/g;

  let lastIndex = 0;
  let currentPosGroup = null;
  let match;

  while ((match = posPattern.exec(text)) !== null) {
    if (currentPosGroup !== null) {
      const def = text.slice(lastIndex, match.index).trim().replace(/;\s*/g, '；');
      if (def) {
        // 展开 "vt&vi&n." 为多条
        for (const pos of expandPosGroup(currentPosGroup)) {
          results.push(`${pos} ${def}`);
        }
      }
    }
    currentPosGroup = match[1];
    lastIndex = posPattern.lastIndex;
  }
  // 最后一段
  if (currentPosGroup !== null) {
    const def = text.slice(lastIndex).trim().replace(/;\s*/g, '；');
    if (def) {
      for (const pos of expandPosGroup(currentPosGroup)) {
        results.push(`${pos} ${def}`);
      }
    }
  }

  // 如果没有匹配到 POS，尝试 "POS 释义" 格式（无点号）
  if (results.length === 0 && text) {
    const noDotMatch = text.match(/^((?:n|v[ti]?|adj|adv|a|art|prep|conj|pron|int|num|aux|det))\s+(.+)$/);
    if (noDotMatch) {
      results.push(`${noDotMatch[1]}. ${noDotMatch[2]}`);
    } else {
      results.push(text);
    }
  }

  return results;
}

/** 展开 "vt&vi&n." 为 ["vt.", "vi.", "n."] */
function expandPosGroup(group) {
  return group
    .replace(/\.$/, '')
    .split(/\s*[&／/]\s*/)
    .map(p => p.trim() + '.')
    .filter(p => /^[a-z]+\.$/.test(p));
}

/** 解析中考词表（处理复杂格式）*/
function parseZhongkaoDict(filename) {
  const text = readFile(filename);
  const map = new Map();
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.trim();
    if (!line || /^[A-Z]$/.test(line) || line.startsWith('#') || line.startsWith('Z') && line.length === 1) continue;
    // 去掉 BOM
    line = line.replace(/^﻿/, '');

    // 用中文字符作为分割点，拆分可能在一行中的多个词条
    // 例: "better...比较级的 a.&ad. 更好的...between [bɪˈtwiːn] prep. 在…之间"
    // 策略：找到所有 "[phonetic] POS. 中文" 的匹配
    const entries = extractZhongkaoEntries(line);
    for (const { word, phonetic, posDef } of entries) {
      const key = word.toLowerCase().trim();
      if (key && key.length > 0 && !map.has(key) && /^[a-z]/i.test(key)) {
        const trans = parsePosDef(posDef);
        if (trans.length > 0 && trans[0]) {
          map.set(key, { name: word, phonetic, trans });
        }
      }
    }
  }
  return map;
}

/** 从一行文本中提取所有词条（处理多词条在同一行的情况）*/
function extractZhongkaoEntries(line) {
  const results = [];
  // 匹配模式: word [(alt)] [phonetic] POS. definition
  // 关键是找到 [phonetic] 后跟 POS. 的模式
  const pattern = /([a-zA-Z][\w' ./-]*?)\s*\[([^\]]*)\]\s*([^\[]+?)(?=\s+[a-zA-Z]\s*\[|$)/g;
  let match;
  while ((match = pattern.exec(line)) !== null) {
    let word = match[1].trim();
    // 清理: 去掉词尾的变体标注  "bad (worse, worst)" → "bad"
    word = word.replace(/\s*\([^)]*\)\s*$/, '').trim();
    // 清理: 去掉 "= synonym" 标注
    word = word.replace(/\s*=\s*\S+\s*$/, '').trim();
    const phonetic = match[2].trim();
    const posDef = match[3].trim().replace(/\s{2,}/g, ' ');
    if (word && posDef) {
      results.push({ word, phonetic, posDef });
    }
  }

  // 如果正则没匹配到（没有音标的行），尝试简单格式
  if (results.length === 0) {
    const simple = line.match(/^([a-zA-Z][\w' -]*?)\s{2,}(.+)$/);
    if (simple) {
      let word = simple[1].trim();
      word = word.replace(/\s*\([^)]*\)\s*$/, '').trim();
      const posDef = simple[2].trim();
      results.push({ word, phonetic: '', posDef });
    }
  }

  return results;
}

/** 解析纯词表文件为 Set */
function parseWordList(filename) {
  const text = readFile(filename);
  const words = new Set();
  for (const line of text.split(/\r?\n/)) {
    const w = line.trim().replace(/^☆\s*/, '');
    if (w && /^[a-zA-Z]/.test(w)) words.add(w.toLowerCase());
  }
  return words;
}

/** 加载 KyleBing JSON 构建查询表 — 优先取有音标的版本 */
function buildKyleLookup(...filenames) {
  const map = new Map();
  for (const f of filenames) {
    const p = join(REF_DIR, f);
    if (!existsSync(p)) continue;
    try {
      const arr = JSON.parse(readFileSync(p, 'utf-8'));
      for (const e of arr) {
        const key = e.word.toLowerCase().trim();
        const existing = map.get(key);
        // 优先保留有音标的版本
        if (!existing || (!existing.us && e.us) || (!existing.uk && e.uk)) {
          map.set(key, e);
        }
      }
    } catch (e) { /* skip */ }
  }
  return map;
}

/** 加载现有词典 */
function loadExisting(id) {
  const p = join(DICT_DIR, `${id}.json`);
  if (!existsSync(p)) return new Map();
  const data = JSON.parse(readFileSync(p, 'utf-8'));
  const map = new Map();
  for (const ch of data.chapters || []) {
    for (const w of ch.words || []) {
      const key = w.name.toLowerCase().trim();
      if (!map.has(key)) map.set(key, w);
    }
  }
  return map;
}

// ============================================================
// 词条生成（多源优先级）
// ============================================================

/** 展开 KyleBing 的合并词性: "v & n" → ["v. 释义", "n. 释义"], "vt&aux" → ["vt. 释义", "aux. 释义"] */
function expandKylePos(type, translation) {
  const parts = type.split(/\s*[&／/]\s*/).map(p => p.trim()).filter(Boolean);
  if (parts.length <= 1) {
    // 确保有 .
    const pos = parts[0] || type;
    return [`${pos.endsWith('.') ? pos : pos + '.'} ${translation}`];
  }
  return parts.map(p => `${p.endsWith('.') ? p : p + '.'} ${translation}`);
}

/**
 * 多源合并词条生成：从多个数据源收集信息，优先用第一个有数据的源，
 * 但对空缺字段从其他源补全。
 */
function makeEntry(word, sources) {
  const key = word.toLowerCase().trim();
  let name = word;
  let usphone = '';
  let ukphone = '';
  let trans = [];
  let found = false;

  for (const { type, data } of sources) {
    const entry = data.get(key);
    if (!entry) continue;

    if (type === 'kyle') {
      if (!found) {
        name = entry.word || word;
        trans = (entry.translations || [])
          .filter(t => t.translation && !t.translation.includes('人名'))
          .flatMap(t => expandKylePos(t.type, t.translation));
        found = true;
      }
      if (!usphone && entry.us) usphone = entry.us;
      if (!ukphone && entry.uk) ukphone = entry.uk;
    }

    if (type === 'mahavivo' || type === 'zhongkao') {
      if (!found) {
        name = entry.name || word;
        trans = entry.trans;
        found = true;
      }
      const ph = entry.phonetic || '';
      if (!usphone && ph) usphone = ph;
      if (!ukphone && ph) ukphone = ph;
    }

    if (type === 'ecdict') {
      // ECDICT: { phonetic, translation: "n. 释义\nv. 释义", pos }
      if (!found) {
        name = word;
        const raw = entry.translation || '';
        const trans = raw.split(/\n/).map(s => s.trim()).filter(Boolean);
        // 如果 ECDICT translation 没有 POS 前缀，从内容推断
        trans.forEach((t, i) => {
          if (!/^[a-z]+\./.test(t)) {
            // ECDICT 有时用 "n. xxx" 有时直接是中文
            // 如果已经以中文开头，加个默认词性
          }
        });
        if (trans.length === 0 && entry.definition) {
          trans.push(entry.definition);
        }
        found = trans.length > 0;
        if (found) return { name, usphone: entry.phonetic || '', ukphone: entry.phonetic || '', trans };
      }
      if (!usphone && entry.phonetic) { usphone = entry.phonetic; }
      if (!ukphone && entry.phonetic) { ukphone = entry.phonetic; }
    }

    if (type === 'supplement') {
      if (!found) {
        name = entry.name || word;
        trans = entry.trans || [];
        found = true;
      }
      if (!usphone && entry.usphone) usphone = entry.usphone;
      if (!ukphone && entry.ukphone) ukphone = entry.ukphone;
    }

    if (type === 'existing') {
      const eUs = entry.usphone || entry.us || '';
      const eUk = entry.ukphone || entry.uk || '';
      if (!found) {
        name = entry.name || word;
        if (Array.isArray(entry.trans)) {
          trans = entry.trans;
        } else if (typeof entry.trans === 'string') {
          trans = entry.trans.split(';').map(s => s.trim()).filter(Boolean).map(s => {
            const m = s.match(/^\[([^\]]+)\]\s*(.+)$/);
            return m ? `${m[1]}. ${m[2]}` : s;
          });
        }
        found = true;
      }
      if (!usphone && eUs) usphone = eUs;
      if (!ukphone && eUk) ukphone = eUk;
    }
  }

  if (!found) {
    console.log(`    ⚠️ 无数据源: ${word}`);
  }

  return { name, usphone, ukphone, trans };
}

// ============================================================
// 生成词典 JSON
// ============================================================

function buildDict(id, name, desc, category, words) {
  const chapters = [];
  for (let i = 0; i < words.length; i += CHAPTER_SIZE) {
    chapters.push({
      id: chapters.length,
      name: `第${chapters.length + 1}章`,
      words: words.slice(i, i + CHAPTER_SIZE),
    });
  }
  return {
    id,
    name,
    description: desc,
    category,
    totalChapters: chapters.length,
    totalWords: words.length,
    chapters,
  };
}

function writeDict(id, name, desc, category, entries) {
  const dict = buildDict(id, name, desc, category, entries);
  const outPath = join(DICT_DIR, `${id}.json`);
  writeFileSync(outPath, JSON.stringify(dict, null, 2), 'utf-8');
  return entries.length;
}

// ============================================================
// 各词库生成
// ============================================================

function generateJunior(kyleLookup, supplementRaw) {
  console.log('\n📘 初中 (对标2022版课标中考词表)');

  const zkDict = parseZhongkaoDict('zhongkao.txt');
  console.log(`  中考词表: ${zkDict.size} 词`);

  // 修正中考词表里缺词性的词条
  const juniorSupp = supplementRaw.junior_missing || {};
  for (const [k, v] of Object.entries(juniorSupp)) {
    const entry = zkDict.get(k);
    if (entry && (!entry.trans || !entry.trans[0] || !/^[a-z]+\./.test(entry.trans[0]))) {
      entry.trans = [`${v.pos} ${v.def}`];
    }
  }

  const existingLookup = loadExisting('junior');
  const sources = [
    { type: 'zhongkao', data: zkDict },
    { type: 'kyle', data: kyleLookup },
    { type: 'existing', data: existingLookup },
  ];

  const sortedWords = [...zkDict.keys()].sort();
  const entries = sortedWords.map(w => makeEntry(w, sources));
  const count = writeDict('junior', '初中英语词汇', '初中阶段必学英语词汇（2022版课程标准）', '中学英语', entries);
  console.log(`  ✅ ${count} 词 → junior.json`);
  return count;
}

function generateSenior(kyleLookup, supplementMap) {
  console.log('\n📗 高中 (对标2017版课标)');

  const hsWords = parseWordList('highschool.txt');
  console.log(`  高中词表: ${hsWords.size} 词`);

  // 用中考词表+CET4补充音标释义
  const zkDict = parseZhongkaoDict('zhongkao.txt');
  const cet4DictForFallback = parseMahavivoDict('cet4.txt');
  const cet6DictForFallback = parseMahavivoDict('cet6.txt');
  const existingLookup = loadExisting('senior');
  const sources = [
    { type: 'kyle', data: kyleLookup },
    { type: 'mahavivo', data: cet4DictForFallback },
    { type: 'mahavivo', data: cet6DictForFallback },
    { type: 'zhongkao', data: zkDict },
    { type: 'supplement', data: supplementMap },
    { type: 'existing', data: existingLookup },
  ];

  const sortedWords = [...hsWords].sort();
  const entries = sortedWords.map(w => makeEntry(w, sources));
  const count = writeDict('senior', '高中英语词汇', '高中阶段必学英语词汇（2017版课程标准）', '中学英语', entries);
  console.log(`  ✅ ${count} 词 → senior.json`);
  return count;
}

function generateCET4(kyleLookup, supplementMap) {
  console.log('\n📙 CET-4 (对标2016大纲)');

  // 直接用 mahavivo CET4_edited.txt，它有完整的音标+词性+释义
  const cet4Dict = parseMahavivoDict('cet4.txt');
  console.log(`  CET4_edited: ${cet4Dict.size} 词`);

  const existingLookup = loadExisting('cet4');
  const sources = [
    { type: 'mahavivo', data: cet4Dict },
    { type: 'kyle', data: kyleLookup },
    { type: 'supplement', data: supplementMap },
    { type: 'existing', data: existingLookup },
  ];

  const sortedWords = [...cet4Dict.keys()].sort();
  const entries = sortedWords.map(w => makeEntry(w, sources));
  const count = writeDict('cet4', '英语4级', '大学英语四级大纲词汇（2016年修订版）', '大学英语', entries);
  console.log(`  ✅ ${count} 词 → cet4.json`);
  return count;
}

function generateCET6(kyleLookup, supplementMap, ecdictMap) {
  console.log('\n📕 CET-6 全量 (对标2016大纲CET4+6，含四级基础)');

  // 用 cet4plus6.txt 作为官方完整词目列表
  const allCETWords = parseWordList('cet4plus6.txt');
  console.log(`  CET4+6 词目: ${allCETWords.size} 词`);

  // 用 cet4.txt + cet6.txt 的解析数据填充释义和音标
  const cet4Dict = parseMahavivoDict('cet4.txt');
  const cet6Dict = parseMahavivoDict('cet6.txt');
  const combined = new Map([...cet4Dict, ...cet6Dict]);
  console.log(`  CET4_edited: ${cet4Dict.size}, CET6_edited: ${cet6Dict.size}, 合并: ${combined.size}`);

  const existingLookup = loadExisting('cet6');
  const sources = [
    { type: 'mahavivo', data: combined },
    { type: 'kyle', data: kyleLookup },
    { type: 'ecdict', data: ecdictMap },
    { type: 'supplement', data: supplementMap },
    { type: 'existing', data: existingLookup },
  ];

  // 按完整词目列表生成（而非按合并数据）
  const sortedWords = [...allCETWords].sort();
  const entries = sortedWords.map(w => makeEntry(w, sources));
  const count = writeDict('cet6', '英语6级', '大学英语六级大纲词汇（2016年修订版，含四级基础）', '大学英语', entries);
  console.log(`  ✅ ${count} 词 → cet6.json`);
  return count;
}

// ============================================================
// 主流程
// ============================================================

function main() {
  const targets = process.argv.slice(2);
  const doAll = targets.length === 0;
  const shouldRun = (name) => doAll || targets.includes(name);

  console.log('📥 加载数据源...');
  const kyleLookup = buildKyleLookup(
    'kyle_CET4_1.json', 'kyle_CET4_2.json', 'kyle_CET4_3.json',
    'kyle_CET6_1.json', 'kyle_CET6_2.json', 'kyle_CET6_3.json',
    'kyle_ChuZhong_2.json', 'kyle_ChuZhong_3.json',
    'kyle_GaoZhong_2.json', 'kyle_GaoZhong_3.json',
  );
  console.log(`  KyleBing 去重: ${kyleLookup.size} 词`);

  // 加载补充数据
  const supplementRaw = JSON.parse(readFileSync(join(REF_DIR, 'supplement.json'), 'utf-8'));
  const supplementMap = new Map();
  for (const [k, v] of Object.entries(supplementRaw)) {
    if (k.endsWith('_missing')) continue;
    supplementMap.set(k.toLowerCase(), { name: k, ...v });
  }
  // CET4 补充
  const cet4Supp = supplementRaw.cet4_missing || {};
  for (const [k, v] of Object.entries(cet4Supp)) {
    supplementMap.set(k.toLowerCase(), { name: k, ...v });
  }
  console.log(`  补充数据: ${supplementMap.size} 词`);

  // 加载 ECDICT 数据（用于补全 CET-6 派生词）
  const ecdictPath = join(REF_DIR, 'ecdict_cet6_missing.json');
  let ecdictMap = new Map();
  if (existsSync(ecdictPath)) {
    const ecdictRaw = JSON.parse(readFileSync(ecdictPath, 'utf-8'));
    for (const [k, v] of Object.entries(ecdictRaw)) {
      ecdictMap.set(k.toLowerCase(), v);
    }
    console.log(`  ECDICT CET-6 补全: ${ecdictMap.size} 词`);
  }

  const results = {};
  if (shouldRun('junior')) results.junior = generateJunior(kyleLookup, supplementRaw);
  if (shouldRun('senior')) results.senior = generateSenior(kyleLookup, supplementMap);
  if (shouldRun('cet4')) results.cet4 = generateCET4(kyleLookup, supplementMap);
  if (shouldRun('cet6')) results.cet6 = generateCET6(kyleLookup, supplementMap, ecdictMap);

  // 验证完整性
  console.log('\n🔍 数据完整性检查:');
  for (const id of Object.keys(results)) {
    const dict = JSON.parse(readFileSync(join(DICT_DIR, `${id}.json`), 'utf-8'));
    const all = dict.chapters.flatMap(ch => ch.words);
    const noUs = all.filter(w => !w.usphone).length;
    const noUk = all.filter(w => !w.ukphone).length;
    const noTrans = all.filter(w => !w.trans || w.trans.length === 0 || !w.trans[0]).length;
    const noPos = all.filter(w => w.trans && w.trans.length > 0 && !/^[a-z]+\./.test(w.trans[0])).length;
    console.log(`  ${id}: ${all.length}词 | 缺美音${noUs} | 缺英音${noUk} | 缺释义${noTrans} | 缺词性${noPos}`);
  }

  console.log('\n✅ 完成! 运行 node scripts/validate-dicts.mjs 进一步验证');
}

main();
