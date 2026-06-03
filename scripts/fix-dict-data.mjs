import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DICTS_DIR = path.join(__dirname, '..', 'src', 'dictionaries');
const REPORT_PATH = path.join(__dirname, '..', 'reports', 'fix-data-report.json');
const DRY_RUN = process.argv.includes('--dry-run');

const TARGET_FILES = ['tem4.json', 'tem8.json', 'ielts.json', 'toefl.json'];

const stats = {
  corrupted_trans: 0,
  asterisk_fix: 0,
  double_bracket: 0,
  proper_noun_removal: 0,
  phonetic_slash: 0,
  cabinet_fix: 0,
};

function fixWord(word, filename) {
  let changed = false;

  // Fix 1: Corrupted trans fields (fanwise, waterside in toefl.json)
  if (filename === 'toefl.json') {
    if (word.name === 'fanwise' && word.trans === 'ad&;[adj] 呈扇形展开的') {
      word.trans = '[adv] 扇形地;[adj] 呈扇形展开的';
      stats.corrupted_trans++;
      changed = true;
    }
    if (word.name === 'waterside' && word.trans === '[n] n&;[adj] 水边(的),湖畔(的)') {
      word.trans = '[n] 水边,湖畔;[adj] 水边(的),湖畔(的)';
      stats.corrupted_trans++;
      changed = true;
    }
  }

  // Fix 2: Double asterisks (交**点 → 交叉点)
  if (word.trans.includes('交**点')) {
    word.trans = word.trans.replace(/交\*\*点/g, '交叉点');
    stats.asterisk_fix++;
    changed = true;
  }

  // Fix 3: Double angle brackets (<< >> → < >)
  if (word.trans.includes('<<') || word.trans.includes('>>')) {
    word.trans = word.trans.replace(/<</g, '<').replace(/>>/g, '>');
    stats.double_bracket++;
    changed = true;
  }

  // Fix 4: Remove proper noun data (;[n],(国籍) 音译名)
  if (word.trans.includes(';[n],(')) {
    word.trans = word.trans.replace(/;\[n\],(?:(?!;\[).)*/g, '');
    stats.proper_noun_removal++;
    changed = true;
  }

  // Fix 5: Phonetic slash normalization
  if (word.usphone && word.usphone.startsWith('/')) {
    word.usphone = word.usphone.replace(/^\/|\/$/g, '');
    stats.phonetic_slash++;
    changed = true;
  }

  // Fix 6: cabinet stray character (toefl.json)
  if (filename === 'toefl.json' && word.name === 'cabinet') {
    if (word.trans === '[n] 橱柜,a<美>内阁的') {
      word.trans = '[n] 橱柜,内阁;[adj] <美>内阁的';
      stats.cabinet_fix++;
      changed = true;
    }
  }

  return changed;
}

function validate(data, filename) {
  const issues = [];
  for (const chapter of data.chapters) {
    for (const word of chapter.words) {
      if (!word.trans || !word.trans.startsWith('[')) {
        issues.push(`${word.name}: trans 不以 [ 开头`);
      }
      if (word.trans && (word.trans.includes('**') || word.trans.includes('&;'))) {
        issues.push(`${word.name}: 残留损坏标记`);
      }
      if (word.usphone && word.usphone.startsWith('/')) {
        issues.push(`${word.name}: 音标仍有斜杠`);
      }
      if (!word.name || !word.usphone || !word.ukphone || !word.trans) {
        issues.push(`${word.name || '??'}: 存在空字段`);
      }
    }
  }
  return issues;
}

// Main
console.log(DRY_RUN ? '🔍 DRY RUN 模式 - 不写入文件\n' : '🔧 执行修复\n');

const report = { timestamp: new Date().toISOString(), dryRun: DRY_RUN, files: [] };

for (const filename of TARGET_FILES) {
  const filePath = path.join(DICTS_DIR, filename);
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);

  let fixCount = 0;
  const changedWords = [];

  for (const chapter of data.chapters) {
    for (const word of chapter.words) {
      const before = word.trans;
      const beforePhone = word.usphone;
      if (fixWord(word, filename)) {
        fixCount++;
        const change = { word: word.name };
        if (before !== word.trans) {
          change.trans_before = before;
          change.trans_after = word.trans;
        }
        if (beforePhone !== word.usphone) {
          change.usphone_before = beforePhone;
          change.usphone_after = word.usphone;
        }
        changedWords.push(change);
      }
    }
  }

  // Post-fix validation
  const issues = validate(data, filename);

  const fileReport = {
    file: filename,
    totalWords: data.chapters.reduce((s, c) => s + c.words.length, 0),
    fixes: fixCount,
    validationIssues: issues,
    changedWords: changedWords.slice(0, 50), // 最多记录前50条
  };
  report.files.push(fileReport);

  if (issues.length > 0) {
    console.log(`❌ ${filename}: ${fixCount} 处修复, ${issues.length} 个验证问题 (跳过写入)`);
    issues.slice(0, 10).forEach(i => console.log(`   - ${i}`));
  } else {
    console.log(`✅ ${filename}: ${fixCount} 处修复, 验证通过`);
  }

  // Write only if not dry-run and no validation issues
  if (!DRY_RUN && issues.length === 0) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  }
}

// Summary
const totalFixes = Object.values(stats).reduce((a, b) => a + b, 0);
console.log('\n📊 修复统计:');
console.log(`   损坏 trans 修复: ${stats.corrupted_trans}`);
console.log(`   编码 ** 修复:   ${stats.asterisk_fix}`);
console.log(`   双尖括号修复:   ${stats.double_bracket}`);
console.log(`   专有名词移除:   ${stats.proper_noun_removal}`);
console.log(`   音标斜杠修复:   ${stats.phonetic_slash}`);
console.log(`   cabinet 修复:   ${stats.cabinet_fix}`);
console.log(`   ────────────────`);
console.log(`   总计:           ${totalFixes}`);

// Save report
if (!fs.existsSync(path.dirname(REPORT_PATH))) {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
}
fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
console.log(`\n📄 报告已保存: ${REPORT_PATH}`);
