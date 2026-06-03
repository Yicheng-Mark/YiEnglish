import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DICTS_DIR = path.join(__dirname, '..', 'src', 'dictionaries');
const STANDARDS_DIR = path.join(__dirname, '..', 'standards');

// POS prefixes ordered by length (longest first) for correct greedy matching
const POS_PREFIXES = 'interj|conj|prep|pron|num|adj|adv|art|int|aux|vt|vi|ad|a|n|v';

// Non-standard → standard POS normalization
const POS_NORMALIZE = { 'a': 'adj', 'ad': 'adv', 'int': 'interj' };

function normalizePos(pos) {
  return POS_NORMALIZE[pos] || pos;
}

// ============================================================
// Parse NPEE standard into a Map<word, {phonetic, posAndDef}>
// ============================================================
function parseNPEE(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const words = new Map();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Standard format: word [phonetic] posAndDef
    let match = trimmed.match(/^([a-zA-Z\-][a-zA-Z\-'\s]*?)\s+\[([^\]]*)\]\s+(.+)$/);
    if (match) {
      const word = match[1].trim().toLowerCase();
      const phonetic = match[2].trim();
      const posAndDef = match[3].trim();
      if (word && posAndDef) {
        words.set(word, { phonetic, posAndDef });
      }
      continue;
    }

    // Fallback: no phonetic (e.g., "I pron.(主格)我")
    const fallbackRe = new RegExp(
      `^([a-zA-Z\\-][a-zA-Z\\-'\\s]*?)\\s+((?:${POS_PREFIXES})\\..+)$`
    );
    match = trimmed.match(fallbackRe);
    if (match) {
      const word = match[1].trim().toLowerCase();
      const posAndDef = match[2].trim();
      if (word && posAndDef) {
        words.set(word, { phonetic: '', posAndDef });
      }
    }
  }
  return words;
}

// ============================================================
// Build trans string from NPEE posAndDef
// Input:  "n.狗,雄兽 vt.尾随,跟踪"
// Output: "[n] 狗,雄兽;[vt] 尾随,跟踪"
//
// Handles combined POS: ad.&prep. → [adv] def;[prep] def
// Handles slash POS:    a./ad.     → [adj] def;[adv] def
// Handles stuck POS:    梗概vt.提取, (表示)ad.进
// Normalizes: a→adj, ad→adv, int→interj
// ============================================================
function buildTransFromNpee(posAndDef) {
  if (!posAndDef) return posAndDef;

  // Pre-normalize compound auxiliary markers
  let text = posAndDef
    .replace(/aux\.v\./g, 'aux.')
    .replace(/v\.aux\./g, 'aux.');

  // Regex to match POS markers (single or combined)
  // NPEE format: "n." "vt." "v./n." "ad.&prep." "n./v" (trailing dot optional on last POS)
  const posRegex = new RegExp(
    `(?:${POS_PREFIXES})\\.(?:\\s*[&/]\\s*(?:${POS_PREFIXES})\\.?)*`,
    'g'
  );

  // Collect groups: [{posList: ['n','vt'], def: '狗,雄兽'}]
  const groups = [];
  let lastIndex = 0;
  let match;

  while ((match = posRegex.exec(text)) !== null) {
    // Fill definition for the previous group
    if (groups.length > 0) {
      groups[groups.length - 1].def = text.slice(lastIndex, match.index).trim();
    }

    // Parse matched POS marker: "v./n." → remove dots → "v/n" → ['v','n'] → ['v','n']
    const raw = match[0].replace(/\./g, '');
    const posList = raw.split(/\s*[&/]\s*/).map(p => normalizePos(p.trim()));

    groups.push({ posList, def: '' });
    lastIndex = posRegex.lastIndex;
  }

  // Fill the last group's definition
  if (groups.length > 0) {
    groups[groups.length - 1].def = text.slice(lastIndex).trim();
  }

  if (groups.length === 0) return posAndDef;

  // Expand: each POS in a group gets its own [pos] def entry
  const parts = [];
  for (const g of groups) {
    if (!g.def) continue;
    for (const pos of g.posList) {
      parts.push(`[${pos}] ${g.def}`);
    }
  }
  return parts.join(';');
}

// ============================================================
// Build a new word entry from NPEE standard data
// ============================================================
function buildEntry(word, standardData) {
  const { phonetic, posAndDef } = standardData;
  return {
    name: word,
    trans: buildTransFromNpee(posAndDef),
    uk: phonetic,
    us: phonetic,
    phrases: []
  };
}

// ============================================================
// Main alignment
// ============================================================
const npeePath = path.join(STANDARDS_DIR, 'postgraduate-standard.txt');
const dictPath = path.join(DICTS_DIR, 'postgraduate.json');

console.log('📋 加载 NPEE 标准...');
const npeeStandard = parseNPEE(npeePath);
console.log(`   NPEE 标准词量: ${npeeStandard.size}`);

console.log('📋 加载考研词库...');
const dict = JSON.parse(fs.readFileSync(dictPath, 'utf-8'));
const originalCount = dict.chapters[0].words.length;
console.log(`   原始词量: ${originalCount}`);

// Build a set of standard words for lookup
const standardSet = new Set(npeeStandard.keys());

// Process: keep only words that are in the standard, rebuild trans from NPEE data
const keptWords = [];
const removedWords = [];
for (const w of dict.chapters[0].words) {
  const key = w.name.toLowerCase().trim();
  if (standardSet.has(key)) {
    // Use NPEE standard data for trans, keep existing phonetics
    const standardData = npeeStandard.get(key);
    if (standardData) {
      w.trans = buildTransFromNpee(standardData.posAndDef);
    }
    keptWords.push(w);
    standardSet.delete(key); // mark as covered
  } else {
    removedWords.push(w.name);
  }
}

// Add missing words from standard
const addedWords = [];
for (const [key, data] of npeeStandard) {
  if (standardSet.has(key)) {
    // This word was not in the dict, add it
    const entry = buildEntry(key, data);
    addedWords.push(entry);
  }
}
addedWords.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

// Merge kept + added, sort alphabetically
const allWords = [...keptWords, ...addedWords].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

console.log(`\n📊 对齐结果:`);
console.log(`   保留(两边都有): ${keptWords.length}`);
console.log(`   移除(词库有,大纲无): ${removedWords.length}`);
console.log(`   新增(大纲有,词库无): ${addedWords.length}`);
console.log(`   对齐后总词量: ${allWords.length}`);

// Update dictionary
dict.chapters[0].words = allWords;
dict.totalWords = allWords.length;

// Write back
fs.writeFileSync(dictPath, JSON.stringify(dict, null, 2));
console.log(`\n✅ 已写回: ${dictPath}`);

// Report
console.log(`\n📝 移除的 ${removedWords.length} 个词:`);
removedWords.forEach(w => process.stdout.write(`  ${w}\n`));

console.log(`\n📝 新增的 ${addedWords.length} 个词:`);
addedWords.forEach(w => process.stdout.write(`  ${w.name} | ${w.trans}\n`));

// Spot-check: verify known problem words
console.log(`\n🔍 抽检修复结果:`);
const spotChecks = ['dog', 'in', 'cheese', 'run', 'book', 'account', 'above', 'yourself', 'yet'];
for (const w of allWords) {
  if (spotChecks.includes(w.name)) {
    console.log(`   ${w.name}: ${w.trans}`);
  }
}

// POS distribution check
const posCounts = {};
for (const w of allWords) {
  const posMatches = w.trans.matchAll(/\[([a-z]+)\]/g);
  for (const m of posMatches) {
    posCounts[m[1]] = (posCounts[m[1]] || 0) + 1;
  }
}
console.log(`\n📊 词性分布:`);
const sortedPos = Object.entries(posCounts).sort((a, b) => b[1] - a[1]);
for (const [pos, count] of sortedPos) {
  console.log(`   ${pos}: ${count}`);
}
