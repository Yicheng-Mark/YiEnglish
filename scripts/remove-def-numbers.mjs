/**
 * 移除词库释义中的数字标记（如 "1." "2." "3."）
 *
 * 示例：
 *   "v. 1. 征(税) 2. 把…强加于 3. 利用" → "v. 征(税)；把…强加于；利用"
 *   "[n] 1. 吸收 2. 专注"              → "[n] 吸收；专注"
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dictsDir = resolve(__dirname, '../src/dictionaries');

const TARGETS = ['cet6.json', 'tem4.json'];

function cleanTrans(text) {
  // Step 1: 移除数字标记，替换为 ；
  let result = text
    .replace(/\s+\d+\.\s+/g, '；')   // 标准模式：1. 2. 3.
    .replace(/\s+\d+(?=\()/g, '；');  // 边缘：3(人) 无句号

  // Step 2: 修复紧跟词性标记后的多余 ；
  result = result
    .replace(/([a-z]+\.)\s*；/g, '$1 ')  // v.； → v.  |  adj.； → adj.
    .replace(/(\])\s*；/g, '$1 ');        // [n]； → [n]

  return result;
}

function processFile(filename) {
  const filepath = resolve(dictsDir, filename);
  const raw = readFileSync(filepath, 'utf-8');
  const dict = JSON.parse(raw);

  let changed = 0;

  for (const chapter of dict.chapters) {
    for (const word of chapter.words) {
      if (Array.isArray(word.trans)) {
        const cleaned = word.trans.map(t => cleanTrans(t));
        if (cleaned.some((t, i) => t !== word.trans[i])) {
          word.trans = cleaned;
          changed++;
        }
      } else if (typeof word.trans === 'string') {
        const cleaned = cleanTrans(word.trans);
        if (cleaned !== word.trans) {
          word.trans = cleaned;
          changed++;
        }
      }
    }
  }

  // 原地写回（保留 JSON 缩进格式）
  writeFileSync(filepath, JSON.stringify(dict, null, 2) + '\n', 'utf-8');
  console.log(`${filename}: ${changed} 条释义已清洗`);
}

for (const f of TARGETS) {
  processFile(f);
}
console.log('完成！');
