/**
 * 从有道词库 + ECDICT 合并扩充，生成完整大纲词量的词库
 *
 * 策略：
 *   1. 以有道词库为主体（有完整 pos/tranCn/usphone/ukphone）
 *   2. 用 ECDICT 的 tag 字段按考试类别补充缺失词汇
 *   3. ECDICT 补充的词用其 translation 和 phonetic 字段
 *
 * 用法: node scripts/merge-dictionaries.cjs
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const TEMP_DIR = path.join(process.env.TEMP, 'dict-sources');
const ECDICT_PATH = path.join(process.env.TEMP, 'ecdict.csv');
const OUT_DIR = path.join(__dirname, '..', 'src', 'dictionaries');
const CHAPTER_SIZE = 25;

// ============================================================
// 有道数据源解析（复用之前的逻辑）
// ============================================================

const POS_MAP = {
  'n': 'n', 'v': 'v', 'vt': 'vt', 'vi': 'vi',
  'adj': 'adj', 'adv': 'adv', 'prep': 'prep',
  'conj': 'conj', 'pron': 'pron', 'art': 'art',
  'aux': 'aux', 'num': 'num', 'int': 'int', 'abbr': 'abbr',
  'a': 'adj', 'ad': 'adv', 'neg': 'adj', 'auxiliary verb': 'aux',
};

function normalizePos(rawPos) {
  if (!rawPos) return [];
  const pos = rawPos.trim().replace(/^["'""]+|["'""]+$/g, '');
  if (!pos) return [];
  if (POS_MAP[pos]) return [POS_MAP[pos]];
  if (pos.includes('&')) {
    const parts = pos.split('&').map(p => p.trim()).filter(Boolean);
    return [...new Set(parts.map(p => POS_MAP[p]).filter(Boolean))];
  }
  if (pos.includes('/')) {
    const parts = pos.split('/').map(p => p.trim()).filter(Boolean);
    return [...new Set(parts.map(p => POS_MAP[p]).filter(Boolean))];
  }
  return [];
}

function cleanTranCn(tran) {
  if (!tran) return '';
  return tran.replace(/\s+/g, '').replace(/;+/g, '；').replace(/,,+/g, '，')
    .replace(/["""]/g, '').trim();
}

function cleanFieldPrefix(meaning) {
  if (!meaning) return '';
  return meaning.replace(/^\[[^\]]*\]\s*/, '').trim();
}

function cleanFrenchChars(str) {
  if (!str) return str;
  return str.replace(/é/g,'e').replace(/ê/g,'e').replace(/è/g,'e').replace(/ë/g,'e')
    .replace(/à/g,'a').replace(/â/g,'a').replace(/ç/g,'c')
    .replace(/î/g,'i').replace(/ï/g,'i').replace(/ô/g,'o')
    .replace(/ù/g,'u').replace(/û/g,'u').replace(/ü/g,'u').replace(/ÿ/g,'y');
}

// ============================================================
// 数据清洗管道
// ============================================================

/**
 * 清洗音标字段
 * - 西里尔 ә → IPA ə
 * - 去除首尾 []
 * - ^ → ə（OCR 残留）
 */
function cleanPhonetic(ph) {
  if (!ph) return '';
  return ph
    .replace(/ә/g, 'ə')  // 西里尔 ә → IPA ə
    .replace(/ҙ/g, 'ə')  // 西里尔 ә 变体
    .replace(/\^/g, 'ə')      // ^ → ə
    .replace(/^\[|\]$/g, '')       // 去首尾 []
    .trim();
}

/**
 * 清洗 trans 字符串
 * - 【】→ []（中文方括号转英文）
 * - 去人名噪声：(xxx)人名,xxx
 * - 去音标泄漏：[maɪˈnjuːt,...] 等含 IPA 字符的假 POS
 * - 去词性污染：[theblue(s)] 等
 * - fiance 硬编码修正
 */
function cleanTrans(word, trans) {
  if (!trans) return trans;

  let t = trans;

  // 1. 中文方括号 → 英文方括号
  t = t.replace(/【/g, '[').replace(/】/g, ']');

  // 2. 去人名噪声：(Xxx)人名 / （Xxx）人名
  t = t.replace(/[,(，;；]*\s*[（(][^)）]*[)）]人名[^,;；]*/g, '');
  t = t.replace(/[,(，;；]*\s*[（(]人名[^,;；]*/g, '');

  // 3. 去音标泄漏到 POS 中：[maɪ...] [US-...] 等
  t = t.replace(/\[[^\]]*[ˈˌəɐɑɒɓɔɕɪʊʌʎʏʒʤʧ].*?\]/g, '');
  // 去 [US-...] 格式
  t = t.replace(/\[US-.*?\]/g, '');
  // 去 [thexxx] 格式（词本身泄漏）
  t = t.replace(/\[the\w+\(?\s?s?\)?\]/g, '');

  // 4. 去非标准领域的独立标签（如 [网络]、[口语]、[计] 等）
  const standardPos = ['n','v','vt','vi','adj','adv','prep','conj','pron','art','aux','num','int','abbr'];
  t = t.replace(/\[([^\]]+)\]/g, (match, inner) => {
    const trimmed = inner.trim();
    if (standardPos.includes(trimmed)) return match;
    return '';
  });

  // 5. 清理释义中嵌入的 &组合词性残留（如 ",n&a,佛洛伊德学说"）
  // 匹配：逗号后跟 pos&pos 再跟逗号的模式
  t = t.replace(/,?\s*[a-z]&[a-z],/g, ',');
  t = t.replace(/,?\s*[a-z]&[a-z];/g, ';');

  // 6. 清理残渣：多余分隔符、空段
  t = t.replace(/^[,;；]+/, '').replace(/[,;；]+$/, '');
  t = t.replace(/;{2,}/g, ';').replace(/,{2,}/g, ',');
  t = t.replace(/;\s*;/g, ';').replace(/,\s*,/g, ',');

  // 7. 去独立的 ,人名 或 ;人名（作为释义出现的）
  t = t.replace(/[,;；]\s*人名(?=[,;；]|$)/g, '');

  // 7. fiance 硬编码修正
  if (word.toLowerCase() === 'fiance' || word.toLowerCase() === 'fiancé' || word.toLowerCase() === 'fiancée') {
    t = '[n] 未婚夫';
  }

  // 8. 拆分释义中嵌入的 &组合词性（如 "奇特的n&v想象力"）
  t = t.replace(/([^\[,;；])((?:n&v|v&n|a&ad|n&a|vt&vi|vi&vt|n&vi|n&vt|a&n|n&adj|adj&n|adj&adv|adv&adj))([一-鿿])/g,
    (_, before, posCombo, afterChar) => {
      const parts = posCombo.split('&').map(p => POS_MAP[p]).filter(Boolean);
      if (parts.length === 0) return _;
      // 把前面的释义截断，后面的释义拆分给新词性
      const newSegments = parts.map(p => `[${p}] ${afterChar}`).join(';');
      return before.substring(0, before.length > 0 ? before.length : 0) + ';' + newSegments;
    }
  );

  // 9. 再次清理残渣
  t = t.replace(/^[,;；]+/, '').replace(/[,;；]+$/, '');
  t = t.replace(/;{2,}/g, ';').replace(/,{2,}/g, ',');

  return t.trim() || null;
}

function formatYoudaoTrans(transArr) {
  if (!transArr || !Array.isArray(transArr) || transArr.length === 0) return null;
  const posGroups = new Map();
  for (const t of transArr) {
    const posList = normalizePos(t.pos);
    const rawMeaning = cleanTranCn(t.tranCn);
    const meaning = cleanFieldPrefix(rawMeaning);
    if (!meaning) continue;
    for (const pos of posList.length > 0 ? posList : ['']) {
      if (!posGroups.has(pos)) posGroups.set(pos, []);
      const parts = meaning.split(/[,，;；]/).filter(Boolean);
      for (const p of parts) {
        const trimmed = p.trim();
        if (trimmed && !posGroups.get(pos).includes(trimmed)) posGroups.get(pos).push(trimmed);
      }
    }
  }
  const segments = [];
  for (const [pos, meanings] of posGroups) {
    segments.push(pos ? `[${pos}] ${meanings.join(',')}` : meanings.join(','));
  }
  return segments.join(';') || null;
}

function parseJSONL(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw.trim().split('\n').map((line, i) => {
    try { return JSON.parse(line); }
    catch (e) { return null; }
  }).filter(Boolean);
}

function convertYoudaoEntry(entry) {
  const headWord = cleanFrenchChars((entry.headWord || '').trim());
  if (!headWord) return null;
  const content = entry.content?.word?.content;
  if (!content) return null;
  const usphone = cleanPhonetic(cleanFrenchChars((content.usphone || '').trim()));
  const ukphone = cleanPhonetic(cleanFrenchChars((content.ukphone || '').trim()));
  const trans = cleanTrans(headWord, formatYoudaoTrans(content.trans));
  if (!usphone && !ukphone) return null;
  if (!trans) return null;
  return { name: headWord, usphone: usphone || ukphone, ukphone: ukphone || usphone, trans };
}

// ============================================================
// ECDICT 数据源解析
// ============================================================

/**
 * 从 ECDICT 的 translation 字段解析出 [pos] 释义 格式
 * ECDICT translation 格式: "n. 宗教；宗教信仰\nv. 使…信教"
 * 或 "n. 宗教，宗教信仰"
 */
function formatEcdictTrans(translation, posField) {
  if (!translation) return null;

  // 清理
  let cleaned = translation
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .trim();
  if (!cleaned) return null;

  const segments = [];

  // 预处理：拆分嵌入在释义中的 & 组合词性
  // 例如 "奇特的n&v想象力,设想" → 拆为两段
  cleaned = cleaned.replace(/([a-z])&([a-z])/g, (match, p1, p2) => {
    return `;${p1}&${p2}`;
  });

  // 按换行拆分（每个可能是不同词性）
  const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    // 匹配 "n. xxx" 或 "vt. xxx" 或 "adj. xxx" 等格式
    const match = line.match(/^([a-z]+\.?)\s+(.+)$/i);
    if (match) {
      const rawPos = match[1].replace('.', '').trim().toLowerCase();
      const meaning = match[2].trim();
      const posList = normalizePos(rawPos);
      if (posList.length > 0 && meaning) {
        // 拆分多个释义
        const parts = meaning.split(/[;；,，]/).map(p => p.trim()).filter(Boolean);
        for (const pos of posList) {
          segments.push(`[${pos}] ${parts.join(',')}`);
        }
        continue;
      }
    }
    // 没有词性前缀的行，用 posField 作为词性
    const meaning = line.replace(/^[a-z]+\.\s*/i, '').trim();
    if (meaning) {
      if (posField) {
        const posList = normalizePos(posField);
        if (posList.length > 0) {
          const parts = meaning.split(/[;；,，]/).map(p => p.trim()).filter(Boolean);
          for (const pos of posList) {
            segments.push(`[${pos}] ${parts.join(',')}`);
          }
          continue;
        }
      }
      // 完全没有词性信息 - 拆分看看是否包含中文词性标记
      const posMatch = meaning.match(/^(n|v|vt|vi|adj|adv|prep|conj|pron|art|aux|num|int|abbr)[\.。、]\s*(.+)$/i);
      if (posMatch) {
        const pos = POS_MAP[posMatch[1].toLowerCase()];
        const def = posMatch[2].trim();
        if (pos && def) {
          segments.push(`[${pos}] ${def.split(/[,，;；]/).map(p=>p.trim()).filter(Boolean).join(',')}`);
          continue;
        }
      }
      // 无法识别词性的释义，跳过不纳入（保证每个词条都有词性）
    }
  }

  return segments.length > 0 ? segments.join(';') : null;
}

/**
 * 加载 ECDICT 中指定 tag 的所有词条
 * 返回 Map<word, {phonetic, translation, pos}>
 */
function loadEcdictByTag(targetTag) {
  return new Promise((resolve) => {
    const wordMap = new Map();
    const rl = readline.createInterface({
      input: fs.createReadStream(ECDICT_PATH),
      crlfDelay: Infinity,
    });

    let header = true;
    let count = 0;

    rl.on('line', (line) => {
      if (header) { header = false; return; }

      // CSV parse
      const parts = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') { inQuotes = !inQuotes; }
        else if (line[i] === ',' && !inQuotes) { parts.push(current); current = ''; }
        else { current += line[i]; }
      }
      parts.push(current);

      const [word, phonetic, definition, translation, pos, , , tag] = parts;

      // 检查 tag 是否包含目标标签
      if (tag && tag.split(' ').includes(targetTag)) {
        const w = word.trim().toLowerCase();
        if (!wordMap.has(w)) {
          wordMap.set(w, { word: word.trim(), phonetic: phonetic || '', translation: translation || '', pos: pos || '' });
          count++;
        }
      }
    });

    rl.on('close', () => {
      console.log(`  ECDICT tag '${targetTag}': ${count} words loaded`);
      resolve(wordMap);
    });
  });
}

// ============================================================
// 合并逻辑
// ============================================================

/**
 * 合并有道主体 + ECDICT 补充
 */
function mergeWithEcdict(youdaoWords, ecdictMap, targetCount) {
  const result = [...youdaoWords];
  const existingNames = new Set(youdaoWords.map(w => w.name.toLowerCase()));

  // 按 ECDICT 补充
  for (const [key, entry] of ecdictMap) {
    if (existingNames.has(key)) continue;
    if (result.length >= targetCount) break;

    const trans = cleanTrans(entry.word, formatEcdictTrans(entry.translation, entry.pos));
    if (!trans) continue; // ECDICT 无法解析出带词性的释义则跳过

    const phonetic = cleanPhonetic(entry.phonetic || '');
    if (!phonetic) continue; // 无音标也跳过

    // ECDICT 音标通常是 IPA 格式，用同一个值作为美音和英音
    result.push({
      name: entry.word,
      usphone: phonetic,
      ukphone: phonetic,
      trans,
    });
    existingNames.add(key);
  }

  return result;
}

/**
 * 将词列表分章并生成完整词库 JSON
 */
function buildDictionary(config, words) {
  const chapters = [];
  for (let i = 0; i < words.length; i += CHAPTER_SIZE) {
    const chunk = words.slice(i, i + CHAPTER_SIZE);
    const idx = Math.floor(i / CHAPTER_SIZE);
    chapters.push({ id: idx + 1, name: `第 ${idx + 1} 章`, words: chunk });
  }

  return {
    id: config.id,
    name: config.name,
    description: config.description,
    category: config.category,
    totalChapters: chapters.length,
    chapters,
  };
}

/**
 * 质量校验
 */
function qualityCheck(id, words) {
  let missingUs = 0, missingUk = 0, noPos = 0, emptyTrans = 0;
  const posSet = new Set();
  for (const w of words) {
    if (!w.usphone) missingUs++;
    if (!w.ukphone) missingUk++;
    if (!w.trans) emptyTrans++;
    const posMatches = w.trans ? w.trans.match(/\[([^\]]+)\]/g) : null;
    if (!posMatches || posMatches.length === 0) noPos++;
    if (posMatches) {
      for (const m of posMatches) {
        const inner = m.replace(/[\[\]]/g, '');
        if (['n','v','vt','vi','adj','adv','prep','conj','pron','art','aux','num','int','abbr'].includes(inner)) {
          posSet.add(inner);
        }
      }
    }
  }
  console.log(`  Quality: ${words.length} words | missing us=${missingUs} uk=${missingUk} noPos=${noPos} emptyTrans=${emptyTrans}`);
  console.log(`  Standard POS used: ${[...posSet].sort().join(', ')}`);

  // Sample entries
  const samples = words.slice(0, 2);
  for (const w of samples) {
    console.log(`    ${w.name} /${w.usphone}/ → ${w.trans.substring(0, 80)}`);
  }
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  console.log('=== Dictionary Merge & Expand ===\n');

  const dictConfigs = [
    {
      id: 'tem4', name: '英语专四', category: '英专生英语',
      description: '英语专业四级考试大纲词汇',
      youdaoFile: 'Level4luan_2.json',
      ecdictTags: ['cet4', 'cet6'],  // TEM-4 包含 CET6 级别词汇
      targetCount: 6000,
    },
    {
      id: 'tem8', name: '英语专八', category: '英专生英语',
      description: '英语专业八级考试大纲词汇',
      youdaoFile: 'Level8luan_2.json',
      ecdictTags: ['gre'],            // TEM-8 接近 GRE 级别
      targetCount: 13000,
    },
    {
      id: 'ielts', name: '雅思词汇', category: '留学英语',
      description: '雅思考试大纲核心词汇',
      youdaoFile: 'IELTSluan_2.json',
      ecdictTags: ['ielts', 'toefl'],  // IELTS 与 TOEFL 学术词汇高度重叠，用 TOEFL 补充
      targetCount: 8000,
    },
    {
      id: 'toefl', name: '托福词汇', category: '留学英语',
      description: '托福考试大纲核心词汇',
      youdaoFile: 'TOEFL_2.json',
      ecdictTags: ['toefl'],
      targetCount: 10000,
    },
  ];

  const metaUpdates = [];

  for (const config of dictConfigs) {
    console.log(`\n===== ${config.name} (${config.id}) → target ${config.targetCount} =====`);

    // 1. 加载有道主体
    const youdaoPath = path.join(TEMP_DIR, config.youdaoFile);
    const youdaoRaw = parseJSONL(youdaoPath);
    const youdaoWords = youdaoRaw.map(convertYoudaoEntry).filter(Boolean);
    console.log(`  Youdao base: ${youdaoWords.length} words`);

    // 2. 加载 ECDICT 补充
    let merged = [...youdaoWords];
    const existingNames = new Set(merged.map(w => w.name.toLowerCase()));

    for (const tag of config.ecdictTags) {
      if (merged.length >= config.targetCount) break;
      const ecdictMap = await loadEcdictByTag(tag);
      const before = merged.length;
      merged = mergeWithEcdict(merged, ecdictMap, config.targetCount);
      console.log(`  After ECDICT '${tag}': ${merged.length} (+${merged.length - before})`);
    }

    // 3. 去重 + 过滤无标准POS的词条
    const seen = new Set();
    const standardPos = ['n','v','vt','vi','adj','adv','prep','conj','pron','art','aux','num','int','abbr'];
    merged = merged.filter(w => {
      const key = w.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      // 过滤掉没有任何标准 POS 的词条
      const hasPos = standardPos.some(p => w.trans.includes(`[${p}]`));
      if (!hasPos) return false;
      return true;
    });

    console.log(`  Final: ${merged.length} words (target was ${config.targetCount})`);

    // 4. 质量检查
    qualityCheck(config.id, merged);

    // 5. 生成分章 JSON
    const dict = buildDictionary(config, merged);
    const outPath = path.join(OUT_DIR, `${config.id}.json`);
    fs.writeFileSync(outPath, JSON.stringify(dict, null, 2), 'utf8');
    const fileSize = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
    console.log(`  Written: ${outPath} (${fileSize} MB)`);

    metaUpdates.push({ id: config.id, totalWords: merged.length });
  }

  // 输出 meta.js 更新数据
  console.log('\n===== META.JS UPDATES =====');
  for (const u of metaUpdates) {
    console.log(`  ${u.id}: totalWords: ${u.totalWords}`);
  }
}

main().catch(console.error);
