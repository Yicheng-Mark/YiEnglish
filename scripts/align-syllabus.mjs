import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DICTS_DIR = path.join(__dirname, '..', 'src', 'dictionaries');
const STANDARDS_DIR = path.join(__dirname, '..', 'standards');
const REPORTS_DIR = path.join(__dirname, '..', 'reports');

// ============================================================
// Parse Barron's SAT standard - robust version
// ============================================================
function parseBarrons(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const words = new Map();

  for (const rawLine of lines) {
    const line = rawLine.replace(/^[•■\-\s]+/, '').trim();
    if (!line) continue;

    // Skip "Word List N" headers
    if (/^Word List/i.test(line)) continue;

    // Extract the first word (English characters, possibly with hyphens)
    const wordMatch = line.match(/^([a-zA-Z][a-zA-Z\-']*)\s+(.+)$/);
    if (!wordMatch) continue;

    const word = wordMatch[1].toLowerCase();
    const rest = wordMatch[2];

    // Find Chinese characters in rest — the POS + Chinese translation is before English definition
    // Strategy: extract everything up to the first English word that starts a definition
    // Chinese chars: 一-鿿, 㐀-䶿, also common punctuation ，。；、（）etc.

    // Find the POS tag and Chinese portion
    // POS patterns: adj. adv. n. v. vt. vi. prep. conj. a. ad. etc.
    // Sometimes POS is malformed: ad丄, adi, ad J., etc.
    // Key insight: look for Chinese characters to identify the translation portion

    const chineseMatch = rest.match(/^([\w.\-;]*[一-鿿][一-鿿\w.,;；，、（）()\s]*[一-鿿）\)])?/);
    if (!chineseMatch || !chineseMatch[1]) {
      // Try alternate: find first run containing Chinese
      const altMatch = rest.match(/([\w.\-;]*[一-鿿][^\x00-\x7F]*[一-鿿）\)])/);
      if (altMatch) {
        const posAndChinese = altMatch[1].trim();
        // Split POS from Chinese
        const posSplit = posAndChinese.match(/^((?:adj|adv|n|v|vt|vi|prep|conj|art|pron|a|ad|interj)[.\s;]*)?(.+)/);
        const pos = normalizePos((posSplit?.[1] || '').replace(/[.\s;]/g, ''));
        const chinese = posSplit?.[2] || posAndChinese;
        words.set(word, { pos, chinese: chinese.trim() });
      }
      continue;
    }

    const posAndChinese = chineseMatch[1].trim();

    // Split POS from Chinese
    // POS is the leading Latin abbreviation before Chinese starts
    const posSplit = posAndChinese.match(/^((?:adj|adv|n|v|vt|vi|prep|conj|art|pron|a|ad|interj)[.\s;]*)?(.+)/);

    let pos = '';
    let chinese = posAndChinese;

    if (posSplit) {
      const rawPos = posSplit[1] || '';
      pos = normalizePos(rawPos.replace(/[.\s;]/g, ''));
      chinese = (posSplit[2] || posAndChinese).trim();
    }

    // Extract Chinese portion (remove any trailing Latin)
    const cleanChinese = chinese.match(/([一-鿿][一-鿿\w.,;；，、（）()\s　]*)/);
    if (cleanChinese) {
      chinese = cleanChinese[1].trim();
    }

    if (word && chinese) {
      words.set(word, { pos: pos || 'unknown', chinese });
    }
  }

  return words;
}

function normalizePos(raw) {
  const p = raw.toLowerCase().trim();
  if (p === 'adj' || p === 'a' || p === 'ad') return 'adj';
  if (p === 'adv' || p === 'ad') return 'adv';
  if (p === 'n') return 'n';
  if (p === 'v') return 'v';
  if (p === 'vt') return 'vt';
  if (p === 'vi') return 'vi';
  if (p === 'prep') return 'prep';
  if (p === 'conj') return 'conj';
  if (p.startsWith('n') && p.includes('v')) return 'n,v';
  if (p.startsWith('v') && p.includes('n')) return 'v,n';
  if (p.startsWith('adj') && p.includes('n')) return 'adj,n';
  return p || 'unknown';
}

// ============================================================
// Parse NPEE postgraduate standard
// ============================================================
function parseNPEE(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const words = new Map();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Pattern: word [phonetic] pos.definition
    const match = trimmed.match(/^([a-zA-Z\-][a-zA-Z\-'\s]*?)\s+\[([^\]]*)\]\s+(.+)$/);
    if (match) {
      const word = match[1].trim().toLowerCase();
      const phonetic = match[2].trim();
      const posAndDef = match[3].trim();
      if (word && posAndDef) {
        words.set(word, { phonetic, posAndDef });
      }
    }
  }
  return words;
}

// ============================================================
// Load dictionary words
// ============================================================
function loadDictWords(dictPath) {
  const data = JSON.parse(fs.readFileSync(dictPath, 'utf-8'));
  const words = [];
  for (const chapter of data.chapters || []) {
    for (const w of chapter.words || []) {
      if (w.name) words.push(w);
    }
  }
  return words;
}

// ============================================================
// Compare
// ============================================================
function compare(dictWords, standardMap) {
  const dictSet = new Map();
  for (const w of dictWords) {
    dictSet.set(w.name.toLowerCase().trim(), w);
  }

  const extra = [];
  const missing = [];
  const kept = [];

  for (const [key, w] of dictSet) {
    if (!standardMap.has(key)) {
      extra.push({ name: w.name, key });
    } else {
      kept.push({ name: w.name, key, dictEntry: w, standardEntry: standardMap.get(key) });
    }
  }

  for (const [key, val] of standardMap) {
    if (!dictSet.has(key)) {
      missing.push({ key, ...val });
    }
  }

  extra.sort((a, b) => a.key.localeCompare(b.key));
  missing.sort((a, b) => a.key.localeCompare(b.key));

  return { extra, missing, kept, total: dictSet.size, standardTotal: standardMap.size };
}

// ============================================================
// Main
// ============================================================
console.log('='.repeat(60));
console.log('SAT & 考研词库大纲对比分析');
console.log('='.repeat(60));

if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

// --- SAT ---
console.log('\n📚 SAT 词库分析');
const barronsPath = path.join(STANDARDS_DIR, 'sat-barrons-raw.txt');
const satDictPath = path.join(DICTS_DIR, 'sat.json');

if (fs.existsSync(barronsPath)) {
  const satStandard = parseBarrons(barronsPath);
  console.log(`   Barron's 标准词量: ${satStandard.size}`);

  const satWords = loadDictWords(satDictPath);
  console.log(`   SAT 词库词量: ${satWords.length}`);

  const satResult = compare(satWords, satStandard);
  console.log(`   ✅ 两边都有: ${satResult.kept.length}`);
  console.log(`   ❌ 多余词(词库有,大纲无): ${satResult.extra.length}`);
  console.log(`   ➕ 缺失词(大纲有,词库无): ${satResult.missing.length}`);
  console.log(`   📊 覆盖率: ${(satResult.kept.length / satStandard.size * 100).toFixed(1)}%`);

  const satReport = {
    standardTotal: satResult.standardTotal,
    dictTotal: satResult.total,
    keptCount: satResult.kept.length,
    extraCount: satResult.extra.length,
    missingCount: satResult.missing.length,
    coverage: (satResult.kept.length / satStandard.size * 100).toFixed(1) + '%',
    extraWords: satResult.extra,
    missingWords: satResult.missing,
    keptWords: satResult.kept.map(k => k.name)
  };
  fs.writeFileSync(path.join(REPORTS_DIR, 'sat-comparison.json'), JSON.stringify(satReport, null, 2));
  console.log(`   📄 详细报告: reports/sat-comparison.json`);
}

// --- 考研 ---
console.log('\n📚 考研词库分析');
const npeePath = path.join(STANDARDS_DIR, 'postgraduate-standard.txt');
const kaoyanDictPath = path.join(DICTS_DIR, 'postgraduate.json');

if (fs.existsSync(npeePath)) {
  const npeeStandard = parseNPEE(npeePath);
  console.log(`   NPEE 标准词量: ${npeeStandard.size}`);

  const kaoyanWords = loadDictWords(kaoyanDictPath);
  console.log(`   考研词库词量: ${kaoyanWords.length}`);

  const kaoyanResult = compare(kaoyanWords, npeeStandard);
  console.log(`   ✅ 两边都有: ${kaoyanResult.kept.length}`);
  console.log(`   ❌ 多余词(词库有,大纲无): ${kaoyanResult.extra.length}`);
  console.log(`   ➕ 缺失词(大纲有,词库无): ${kaoyanResult.missing.length}`);
  console.log(`   📊 覆盖率: ${(kaoyanResult.kept.length / npeeStandard.size * 100).toFixed(1)}%`);

  const kaoyanReport = {
    standardTotal: kaoyanResult.standardTotal,
    dictTotal: kaoyanResult.total,
    keptCount: kaoyanResult.kept.length,
    extraCount: kaoyanResult.extra.length,
    missingCount: kaoyanResult.missing.length,
    coverage: (kaoyanResult.kept.length / npeeStandard.size * 100).toFixed(1) + '%',
    extraWords: kaoyanResult.extra,
    missingWords: kaoyanResult.missing,
    keptWords: kaoyanResult.kept.map(k => k.name)
  };
  fs.writeFileSync(path.join(REPORTS_DIR, 'kaoyan-comparison.json'), JSON.stringify(kaoyanReport, null, 2));
  console.log(`   📄 详细报告: reports/kaoyan-comparison.json`);
}

console.log('\n' + '='.repeat(60));
console.log('分析完成！');
