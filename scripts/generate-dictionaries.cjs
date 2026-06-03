/**
 * 从有道词库 JSONL 数据生成项目所需的 JSON 格式词库
 *
 * 数据源: kajweb/dict (有道词库)
 * 目标格式: { name, usphone, ukphone, trans: "[pos] 释义1,释义2;[pos] 释义3" }
 *
 * 用法: node scripts/generate-dictionaries.js
 */

const fs = require('fs');
const path = require('path');

const TEMP_DIR = path.join(process.env.TEMP, 'dict-sources');
const OUT_DIR = path.join(__dirname, '..', 'src', 'dictionaries');
const CHAPTER_SIZE = 25;

// 源文件 -> 目标配置
const DICTS = [
  {
    sourceFile: 'Level4luan_2.json',
    id: 'tem4',
    name: '英语专四',
    description: '英语专业四级考试核心词汇',
    category: '英专生英语',
  },
  {
    sourceFile: 'Level8luan_2.json',
    id: 'tem8',
    name: '英语专八',
    description: '英语专业八级考试核心词汇',
    category: '英专生英语',
  },
  {
    sourceFile: 'IELTSluan_2.json',
    id: 'ielts',
    name: '雅思词汇',
    description: '雅思考试核心词汇',
    category: '留学英语',
  },
  {
    sourceFile: 'TOEFL_2.json',
    id: 'toefl',
    name: '托福词汇',
    description: '托福考试核心词汇',
    category: '留学英语',
  },
];

/**
 * 清理法语字符（数据源有少量法语字母混入）
 */
function cleanFrenchChars(str) {
  if (!str) return str;
  return str
    .replace(/é/g, 'e').replace(/ê/g, 'e').replace(/è/g, 'e').replace(/ë/g, 'e')
    .replace(/à/g, 'a').replace(/â/g, 'a').replace(/ç/g, 'c')
    .replace(/î/g, 'i').replace(/ï/g, 'i').replace(/ô/g, 'o')
    .replace(/ù/g, 'u').replace(/û/g, 'u').replace(/ü/g, 'u')
    .replace(/ÿ/g, 'y');
}

/**
 * 清理中文释义中的多余空格和标点
 */
function cleanTranCn(tran) {
  if (!tran) return '';
  return tran
    .replace(/\s+/g, '')           // 去除所有空格
    .replace(/;+/g, '；')          // 英文分号转中文
    .replace(/,,+/g, '，')         // 双逗号转中文逗号
    .replace(/"/g, '')             // 去引号
    .replace(/"/g, '')
    .replace(/"/g, '')
    .trim();
}

/**
 * 标准词性映射表
 * 将有道的各种 pos 写法统一映射为标准词性缩写
 */
const POS_MAP = {
  // 标准词性直接映射
  'n': 'n', 'v': 'v', 'vt': 'vt', 'vi': 'vi',
  'adj': 'adj', 'adv': 'adv', 'prep': 'prep',
  'conj': 'conj', 'pron': 'pron', 'art': 'art',
  'aux': 'aux', 'num': 'num', 'int': 'int', 'abbr': 'abbr',
  // 有道/雅思变体
  'a': 'adj', 'ad': 'adv',
  'neg': 'adj',
  'auxiliary verb': 'aux',
};

/**
 * 将有道的 pos 字段标准化
 * - 标准 POS 直接映射
 * - 组合词性如 "a&n" → 拆分为 adj 和 n
 * - 学科标注如 "医"、"化" → 保留到释义中，不作为词性
 * - 无法识别的 → 空字符串（不显示词性）
 */
function normalizePos(rawPos) {
  if (!rawPos) return [];
  const pos = rawPos.trim().replace(/^["'""]+|["'""]+$/g, ''); // 去引号
  if (!pos) return [];

  // 单个标准 POS
  if (POS_MAP[pos]) return [POS_MAP[pos]];

  // 组合词性: "a&n", "n&v", "vt&vi" 等
  if (pos.includes('&')) {
    const parts = pos.split('&').map(p => p.trim()).filter(Boolean);
    const result = [];
    for (const p of parts) {
      if (POS_MAP[p]) result.push(POS_MAP[p]);
    }
    return [...new Set(result)];
  }

  // 斜杠组合: "vt/n", "vt/vi"
  if (pos.includes('/')) {
    const parts = pos.split('/').map(p => p.trim()).filter(Boolean);
    const result = [];
    for (const p of parts) {
      if (POS_MAP[p]) result.push(POS_MAP[p]);
    }
    return [...new Set(result)];
  }

  // 无法识别（学科标注等）→ 不作为词性
  return [];
}

/**
 * 清理释义中的学科标注前缀，如 "[医] 恶性的" → "恶性的"
 */
function cleanFieldPrefix(meaning) {
  if (!meaning) return '';
  return meaning.replace(/^\[[^\]]*\]\s*/, '').trim();
}

/**
 * 将有道 trans 数组转为目标格式字符串
 * 有道格式: [{ pos: "vt", tranCn: " 取消，撤销" }, { pos: "vi", tranCn: " 取消" }]
 * 目标格式: "[vt] 取消,撤销;[vi] 取消"
 *
 * 同词性多个释义用逗号分隔，不同词性用分号分隔
 */
function formatTrans(transArr) {
  if (!transArr || !Array.isArray(transArr) || transArr.length === 0) {
    return null;
  }

  // 按 标准化后的pos 分组
  const posGroups = new Map();
  for (const t of transArr) {
    const posList = normalizePos(t.pos);
    const rawMeaning = cleanTranCn(t.tranCn);
    // 清理释义中的学科标注前缀
    const meaning = cleanFieldPrefix(rawMeaning);
    if (!meaning) continue;

    for (const pos of posList.length > 0 ? posList : ['']) {
      if (!posGroups.has(pos)) {
        posGroups.set(pos, []);
      }
      // 意思可能本身包含逗号分隔的多个释义，拆开再合并
      const parts = meaning.split(/[,，;；]/).filter(Boolean);
      for (const p of parts) {
        const trimmed = p.trim();
        if (trimmed && !posGroups.get(pos).includes(trimmed)) {
          posGroups.get(pos).push(trimmed);
        }
      }
    }
  }

  // 组装: [pos] 释义1,释义2;[pos] 释义3
  const segments = [];
  for (const [pos, meanings] of posGroups) {
    if (!pos) {
      // 无词性的直接放释义
      segments.push(meanings.join(','));
    } else {
      segments.push(`[${pos}] ${meanings.join(',')}`);
    }
  }

  return segments.join(';') || null;
}

/**
 * 解析 JSONL 文件（每行一个 JSON 对象）
 */
function parseJSONL(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.trim().split('\n');
  const entries = [];
  for (let i = 0; i < lines.length; i++) {
    try {
      entries.push(JSON.parse(lines[i]));
    } catch (e) {
      console.warn(`  Warning: failed to parse line ${i + 1}: ${e.message}`);
    }
  }
  return entries;
}

/**
 * 将有道词条转为项目目标格式
 */
function convertEntry(entry) {
  const headWord = cleanFrenchChars((entry.headWord || '').trim());
  if (!headWord) return null;

  const content = entry.content?.word?.content;
  if (!content) return null;

  const usphone = cleanFrenchChars((content.usphone || '').trim());
  const ukphone = cleanFrenchChars((content.ukphone || '').trim());
  const trans = formatTrans(content.trans);

  if (!usphone && !ukphone) return null; // 跳过无音标的词
  if (!trans) return null; // 跳过无释义的词

  return {
    name: headWord,
    usphone: usphone || ukphone, // 缺美音用英音补
    ukphone: ukphone || usphone, // 缺英音用美音补
    trans,
  };
}

/**
 * 去重（按 word name 去重，保留第一个）
 */
function dedup(words) {
  const seen = new Set();
  return words.filter(w => {
    const key = w.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * 将词列表分章
 */
function chunkChapters(words) {
  const chapters = [];
  for (let i = 0; i < words.length; i += CHAPTER_SIZE) {
    const chunk = words.slice(i, i + CHAPTER_SIZE);
    const idx = Math.floor(i / CHAPTER_SIZE);
    chapters.push({
      id: idx + 1,
      name: `第 ${idx + 1} 章`,
      words: chunk,
    });
  }
  return chapters;
}

/**
 * 生成一个词库 JSON 文件
 */
function generateDictionary(config) {
  console.log(`\n========== Processing: ${config.name} (${config.id}) ==========`);

  const sourcePath = path.join(TEMP_DIR, config.sourceFile);
  if (!fs.existsSync(sourcePath)) {
    console.error(`  ERROR: Source file not found: ${sourcePath}`);
    return null;
  }

  // 1. 解析 JSONL
  const rawEntries = parseJSONL(sourcePath);
  console.log(`  Raw entries: ${rawEntries.length}`);

  // 2. 转换格式
  let words = rawEntries.map(convertEntry).filter(Boolean);
  console.log(`  After conversion (valid): ${words.length}`);

  // 3. 去重
  const beforeDedup = words.length;
  words = dedup(words);
  console.log(`  After dedup: ${words.length} (removed ${beforeDedup - words.length})`);

  // 4. 分章
  const chapters = chunkChapters(words);

  // 5. 组装结果
  const result = {
    id: config.id,
    name: config.name,
    description: config.description,
    category: config.category,
    totalChapters: chapters.length,
    chapters,
  };

  // 6. 写入文件
  const outPath = path.join(OUT_DIR, `${config.id}.json`);
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
  const fileSize = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
  console.log(`  Written: ${outPath} (${fileSize} MB)`);
  console.log(`  Total words: ${words.length}, Total chapters: ${chapters.length}`);

  // 7. 数据质量报告
  let missingUs = 0, missingUk = 0, noPos = 0, emptyTrans = 0;
  for (const w of words) {
    if (!w.usphone) missingUs++;
    if (!w.ukphone) missingUk++;
    // 检查 trans 中是否包含 [pos] 格式
    if (!/\[.+\]/.test(w.trans)) noPos++;
    if (!w.trans) emptyTrans++;
  }
  console.log(`  Quality: missing usphone=${missingUs}, missing ukphone=${missingUk}, no POS=${noPos}, empty trans=${emptyTrans}`);

  // 8. 示例词条
  console.log(`  Sample entries:`);
  for (const w of words.slice(0, 3)) {
    console.log(`    ${w.name} /${w.usphone}/ /${w.ukphone}/ → ${w.trans}`);
  }

  return { id: config.id, totalWords: words.length, totalChapters: chapters.length };
}

// ========== 主流程 ==========
console.log('Dictionary Generator');
console.log('Source dir:', TEMP_DIR);
console.log('Output dir:', OUT_DIR);

const results = [];
for (const config of DICTS) {
  const result = generateDictionary(config);
  if (result) results.push(result);
}

console.log('\n========== SUMMARY ==========');
console.log('id\t\twords\tchapters');
for (const r of results) {
  console.log(`${r.id}\t\t${r.totalWords}\t${r.totalChapters}`);
}

// 输出 meta.js 需要更新的数据
console.log('\n========== META.JS UPDATE ==========');
for (const r of results) {
  console.log(`${r.id}: totalWords: ${r.totalWords}`);
}
