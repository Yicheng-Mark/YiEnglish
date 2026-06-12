/**
 * 检查 mockCorpusVideos.js 中是否存在重复的 YouTube 视频来源链接
 *
 * 用法：node scripts/check-youtube-dup.mjs
 *      npm run corpus:check-yt
 *
 * 工作流：
 * 1. 读取 mockCorpusVideos.js
 * 2. 提取每条记录的 id、title、youtubeUrl
 * 3. 从 URL 中提取 YouTube 视频 ID
 * 4. 报告重复项（如有）
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '..', 'src', 'modules', 'corpus', 'data', 'mockCorpusVideos.js');

/**
 * 从 YouTube URL 中提取视频 ID
 */
function extractVideoId(url) {
  if (!url) return null;
  // 标准格式: https://www.youtube.com/watch?v=VIDEO_ID
  const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];
  // 短链接: https://youtu.be/VIDEO_ID
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];
  return null;
}

// ---- 主流程 ----

const content = fs.readFileSync(DATA_FILE, 'utf8');

// 用正则直接匹配每个条目的 id、title、youtubeUrl
// title 可能用单引号也可能用双引号（内容含撇号时）
// 单引号字符串内部可用 \' 转义，所以用 (?:[^'\\]|\\.)* 匹配
const entryRegex = /\{\s*id:\s*'(\d+)',\s*title:\s*(?:'((?:[^'\\]|\\.)*)'|"([^"]*)"),[\s\S]*?youtubeUrl:\s*'([^']+)'/g;

const episodes = [];
let match;
while ((match = entryRegex.exec(content)) !== null) {
  const id = match[1];
  const title = match[2] ?? match[3] ?? '(unknown)';
  const youtubeUrl = match[4];
  episodes.push({
    id,
    title,
    youtubeUrl,
    videoId: extractVideoId(youtubeUrl),
  });
}

console.log(`📋 共扫描 ${episodes.length} 条语料视频记录\n`);

// 按 videoId 分组
const idMap = new Map();
for (const ep of episodes) {
  if (!ep.videoId) {
    console.log(`⚠️  #${ep.id} 无法提取视频 ID: ${ep.youtubeUrl}`);
    continue;
  }
  if (!idMap.has(ep.videoId)) {
    idMap.set(ep.videoId, []);
  }
  idMap.get(ep.videoId).push(ep);
}

// 查找重复
let dupCount = 0;
for (const [videoId, eps] of idMap) {
  if (eps.length > 1) {
    dupCount++;
    console.log(`❌ 重复视频 ID: ${videoId}`);
    for (const ep of eps) {
      console.log(`   → #${ep.id} "${ep.title}"`);
      console.log(`     ${ep.youtubeUrl}`);
    }
    console.log();
  }
}

if (dupCount === 0) {
  console.log(`✅ 无重复！全部 ${episodes.length} 条视频来源链接均唯一。`);
} else {
  console.log(`❌ 发现 ${dupCount} 组重复视频！请检查上述条目。`);
  process.exit(1);
}
