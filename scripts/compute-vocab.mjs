/**
 * 自动计算语料视频的字幕条数和不重复词汇数，更新 mockCorpusVideos.js
 *
 * 用法：node scripts/compute-vocab.mjs
 *
 * 工作流：
 * 1. 放字幕 JSON 到 public/corpus/subtitles/
 * 2. 在 mockCorpusVideos.js 中添加条目（vocabCount/sentenceCount 随便填占位值）
 * 3. 运行此脚本 → 所有数值自动修正
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SUBTITLES_DIR = path.join(__dirname, '..', 'public', 'corpus', 'subtitles');
const DATA_FILE = path.join(__dirname, '..', 'src', 'modules', 'corpus', 'data', 'mockCorpusVideos.js');

// 英语停用词表
const STOP_WORDS = new Set([
  'i','me','my','myself','we','our','ours','ourselves','you','your','yours',
  'yourself','yourselves','he','him','his','himself','she','her','hers',
  'herself','it','its','itself','they','them','their','theirs','themselves',
  'what','which','who','whom','this','that','these','those','am','is','are',
  'was','were','be','been','being','have','has','had','having','do','does',
  'did','doing','a','an','the','and','but','if','or','because','as','until',
  'while','of','at','by','for','with','about','against','between','through',
  'during','before','after','above','below','to','from','up','down','in',
  'out','on','off','over','under','again','further','then','once','here',
  'there','when','where','why','how','all','both','each','few','more','most',
  'other','some','such','no','nor','not','only','own','same','so','than',
  'too','very','s','t','can','will','just','don','should','now','d','ll',
  'm','o','re','ve','y','ain','aren','couldn','didn','doesn','hadn','hasn',
  'haven','isn','ma','mightn','mustn','needn','shan','shouldn','wasn',
  'weren','won','wouldn','also','would','could','might','shall','may',
  'get','got','go','going','goes','went','gone','come','came','coming',
  'like','know','think','see','make','really','much','thing','things',
  'one','two','three','four','five','six','seven','eight','nine','ten',
  'said','say','says','well','way','still','even','back','lot','want',
  'let','yeah','oh','um','uh','okay','right','actually','literally',
  'basically','honestly','kind','sort','feel','good','little',
  'look','looking','looked','new','old','big','small','long','great',
  'time','day','year','years','people','man','woman','life','world',
  'never','always','every','everything','something','anything','nothing',
  'many','sure','pretty','bit','need','try','put','keep',
  'thought','found','made','take','tell','work','give','use','call',
  'point','hand','place','case','week','fact','part','end','side','home',
  'told','talk','talking','talked','ask','asked','turn','show',
  'start','started','able','into','getting','doing','saying',
  'having','took','making','coming','already','another','around','away',
  'enough','first','last','next','ever','however','together','since','yet',
  'without','within','along','though','whether','per','become','became',
  'each','across','among','perhaps','rather','quite','almost','less','least',
  'instead','behind','often','upon','else','seems',
]);

/**
 * 从字幕数组中计算统计信息
 */
function computeStats(subtitles) {
  const sentenceCount = subtitles.length;
  const words = new Set();

  for (const item of subtitles) {
    if (!item.en) continue;
    // 小写、去标点、分词
    item.en
      .toLowerCase()
      .replace(/[^a-z\s'-]/g, '')
      .split(/\s+/)
      .forEach((w) => {
        w = w.replace(/^[-']+|[-']+$/g, '');
        if (w && w.length > 1 && !STOP_WORDS.has(w)) {
          words.add(w);
        }
      });
  }

  return { sentenceCount, vocabCount: words.size };
}

// ---- 主流程 ----

// 1. 读取所有字幕文件，计算统计
const stats = {};
const files = fs.readdirSync(SUBTITLES_DIR).filter((f) => f.endsWith('.json')).sort();
for (const file of files) {
  const id = path.basename(file, '.json');
  const data = JSON.parse(fs.readFileSync(path.join(SUBTITLES_DIR, file), 'utf8'));
  stats[id] = computeStats(data);
}

// 2. 读取 mockCorpusVideos.js
let content = fs.readFileSync(DATA_FILE, 'utf8');

// 3. 匹配每个视频条目并替换 sentenceCount 和 vocabCount
let updateCount = 0;

// 匹配 subtitleUrl 并提取文件编号，然后在同一对象中替换数值
content = content.replace(
  /subtitleUrl:\s*'\/corpus\/subtitles\/(\d+)\.json'[^}]*?(\s*}\s*,?\s*$)/gm,
  (match, id) => match // 先标记位置
);

// 用更精确的方式：逐个视频条目替换
// 匹配模式：subtitleUrl: '/corpus/subtitles/XXX.json'
// 然后在该条目中替换 sentenceCount 和 vocabCount
const videoEntries = content.split(/(\s*{\s*id:)/);

for (let i = 0; i < videoEntries.length; i++) {
  const entry = videoEntries[i];
  const subtitleMatch = entry.match(/subtitleUrl:\s*'\/corpus\/subtitles\/(\d+)\.json'/);
  if (!subtitleMatch) continue;

  const id = subtitleMatch[1];
  const s = stats[id];
  if (!s) {
    console.log(`⚠️  字幕文件 ${id}.json 未找到统计信息，跳过`);
    continue;
  }

  let updated = entry;

  // 替换 sentenceCount
  const oldSentence = updated.match(/sentenceCount:\s*(\d+)/)?.[1];
  if (oldSentence && Number(oldSentence) !== s.sentenceCount) {
    updated = updated.replace(/sentenceCount:\s*\d+/, `sentenceCount: ${s.sentenceCount}`);
    console.log(`  #${id} sentenceCount: ${oldSentence} → ${s.sentenceCount}`);
  }

  // 替换 vocabCount
  const oldVocab = updated.match(/vocabCount:\s*(\d+)/)?.[1];
  if (oldVocab && Number(oldVocab) !== s.vocabCount) {
    updated = updated.replace(/vocabCount:\s*\d+/, `vocabCount: ${s.vocabCount}`);
    console.log(`  #${id} vocabCount: ${oldVocab} → ${s.vocabCount}`);
  }

  if (updated !== entry) {
    videoEntries[i] = updated;
    updateCount++;
  }
}

// 4. 写回文件
content = videoEntries.join('');
fs.writeFileSync(DATA_FILE, content, 'utf8');

console.log(`\n✅ 完成！已更新 ${updateCount} 个视频条目`);
console.log(`📝 文件：${path.relative(process.cwd(), DATA_FILE)}`);
