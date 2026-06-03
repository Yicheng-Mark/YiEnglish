import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DICTS_DIR = path.join(__dirname, '..', 'src', 'dictionaries');
const STANDARDS_DIR = path.join(__dirname, '..', 'standards');

// ============================================================
// Parse Barron's standard
// ============================================================
function parseBarrons(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const words = new Map();

  for (const rawLine of lines) {
    const line = rawLine.replace(/^[•■\-\s]+/, '').trim();
    if (!line || /^Word List/i.test(line)) continue;

    const wordMatch = line.match(/^([a-zA-Z][a-zA-Z\-']*)\s+(.+)$/);
    if (!wordMatch) continue;

    const word = wordMatch[1].toLowerCase();
    const rest = wordMatch[2];

    if (!/[一-鿿]/.test(rest)) continue;

    let pos = '';
    let chinese = '';

    const posAndChinese = rest.match(/^((?:adj|adv|n|v|vt|vi|prep|conj|art|pron|a|ad|interj|aux)[.\s;]*)?(.+)/);
    if (posAndChinese) {
      const rawPos = (posAndChinese[1] || '').replace(/[.\s;]/g, '');
      pos = normalizePos(rawPos);
      const remainder = posAndChinese[2] || rest;
      const chineseMatch = remainder.match(/([一-鿿][一-鿿\w.,;；，、（）()\s　]*[一-鿿）\)])/);
      if (chineseMatch) {
        chinese = chineseMatch[1].trim();
      } else {
        const altMatch = remainder.match(/([一-鿿][^\x00-\x7F]+)/);
        if (altMatch) chinese = altMatch[1].trim();
      }
    }

    if (chinese && !words.has(word)) {
      words.set(word, { pos: pos || 'unknown', chinese });
    }
  }
  return words;
}

function normalizePos(raw) {
  const p = raw.toLowerCase().trim();
  if (p === 'a') return 'adj';
  if (p === 'ad') return 'adv';
  if (['adj','adv','n','v','vt','vi','prep','conj','art','pron','interj','aux'].includes(p)) return p;
  return p || 'unknown';
}

// ============================================================
// Parse NPEE for phonetic lookup
// ============================================================
function parseNPEEPhonetics(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const phonetics = new Map();
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^([a-zA-Z\-][a-zA-Z\-'\s]*?)\s+\[([^\]]*)\]/);
    if (match) {
      const word = match[1].trim().toLowerCase();
      const phone = match[2].trim();
      if (word && phone) phonetics.set(word, phone);
    }
  }
  return phonetics;
}

// ============================================================
// Main SAT alignment
// ============================================================
console.log('📋 加载 Barron\'s 标准...');
const barronsPath = path.join(STANDARDS_DIR, 'sat-barrons-raw.txt');
const barronsStandard = parseBarrons(barronsPath);
console.log(`   Barron's 标准词量: ${barronsStandard.size}`);

console.log('📋 加载 NPEE 音标库...');
const npeePath = path.join(STANDARDS_DIR, 'postgraduate-standard.txt');
const npeePhonetics = parseNPEEPhonetics(npeePath);
console.log(`   NPEE 音标库: ${npeePhonetics.size} 词`);

console.log('📋 加载 SAT 词库...');
const dictPath = path.join(DICTS_DIR, 'sat.json');
const dict = JSON.parse(fs.readFileSync(dictPath, 'utf-8'));

// Build word map from current dictionary
const existingWords = new Map();
for (const chapter of dict.chapters) {
  for (const w of chapter.words) {
    existingWords.set(w.name.toLowerCase().trim(), w);
  }
}
console.log(`   SAT 原始词量: ${existingWords.size}`);

// Build final word list from Barron's standard
const finalWords = [];
let keptCount = 0, addedCount = 0;

for (const [word, data] of barronsStandard) {
  const existing = existingWords.get(word);

  if (existing) {
    // Keep existing word, but add POS to trans if missing
    const transWithPos = existing.trans.map(t => {
      // If trans already has POS, keep it
      if (/^(n\.|v\.|adj\.|adv\.|vt\.|vi\.|prep\.|conj\.|art\.|pron\.)/.test(t)) return t;
      // Add POS from Barron's
      return `${data.pos}. ${t}`;
    });
    finalWords.push({
      name: existing.name,
      usphone: existing.usphone,
      ukphone: existing.ukphone,
      trans: transWithPos
    });
    keptCount++;
  } else {
    // Add new word from Barron's
    const phone = npeePhonetics.get(word) || '';
    finalWords.push({
      name: word,
      usphone: phone,
      ukphone: phone,
      trans: [`${data.pos}. ${data.chinese}`]
    });
    addedCount++;
  }
}

// Sort alphabetically
finalWords.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

console.log(`\n📊 对齐结果:`);
console.log(`   保留(两边都有): ${keptCount}`);
console.log(`   新增(Barron's有,SAT无): ${addedCount}`);
console.log(`   移除(SAT有,Barron's无): ${existingWords.size - keptCount}`);
console.log(`   对齐后总词量: ${finalWords.length}`);

// Organize into chapters (~25 words each)
const wordsPerChapter = 25;
const totalChapters = Math.ceil(finalWords.length / wordsPerChapter);
const chapters = [];
for (let i = 0; i < totalChapters; i++) {
  chapters.push({
    id: i + 1,
    name: `第${i + 1}章`,
    words: finalWords.slice(i * wordsPerChapter, (i + 1) * wordsPerChapter)
  });
}

// Update dictionary
dict.chapters = chapters;
dict.totalChapters = totalChapters;
dict.totalWords = finalWords.length;

fs.writeFileSync(dictPath, JSON.stringify(dict, null, 2));
console.log(`\n✅ 已写回: ${dictPath}`);

// Report missing phonetics
const noPhone = finalWords.filter(w => !w.usphone && !w.ukphone);
console.log(`\n📝 缺少音标的词: ${noPhone.length} 个`);
noPhone.slice(0, 20).forEach(w => console.log(`   ${w.name}`));
if (noPhone.length > 20) console.log(`   ... 还有 ${noPhone.length - 20} 个`);
