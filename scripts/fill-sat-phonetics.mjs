import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAT_PATH = path.join(__dirname, '..', 'src', 'dictionaries', 'sat.json');

function fetchPhonetic(word) {
  return new Promise((resolve, reject) => {
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
    https.get(url, { headers: { 'User-Agent': 'typing-word' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (Array.isArray(json) && json[0]) {
            const phonetics = json[0].phonetics || [];
            let phone = '';
            // Collect all phonetic texts
            for (const p of phonetics) {
              if (p.text && !phone) {
                phone = p.text.replace(/[\/\[\]]/g, '');
              }
            }
            if (!phone && json[0].phonetic) {
              phone = json[0].phonetic.replace(/[\/\[\]]/g, '');
            }
            resolve(phone || '');
          } else {
            resolve('');
          }
        } catch {
          resolve('');
        }
      });
    }).on('error', () => resolve(''));
  });
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('📋 加载 SAT 词库...');
  const sat = JSON.parse(fs.readFileSync(SAT_PATH, 'utf-8'));

  const needPhone = [];
  for (const ch of sat.chapters) {
    for (const w of ch.words) {
      if (!w.usphone && !w.ukphone) needPhone.push(w);
    }
  }
  console.log(`需要获取音标: ${needPhone.length} 个词`);

  let success = 0, fail = 0;
  const BATCH = 10;

  for (let i = 0; i < needPhone.length; i += BATCH) {
    const batch = needPhone.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(w => fetchPhonetic(w.name)));

    for (let j = 0; j < batch.length; j++) {
      const phone = results[j];
      if (phone) {
        batch[j].usphone = phone;
        batch[j].ukphone = phone;
        success++;
      } else {
        fail++;
      }
    }

    const progress = Math.min(i + BATCH, needPhone.length);
    process.stdout.write(`\r   进度: ${progress}/${needPhone.length} | 成功: ${success} | 失败: ${fail}`);

    // Save progress every 50 words
    if ((i + BATCH) % 50 === 0) {
      fs.writeFileSync(SAT_PATH, JSON.stringify(sat, null, 2));
    }

    await sleep(300); // Rate limit
  }

  // Final save
  fs.writeFileSync(SAT_PATH, JSON.stringify(sat, null, 2));

  console.log(`\n\n📊 结果:`);
  console.log(`   获取成功: ${success}`);
  console.log(`   获取失败: ${fail}`);
  console.log(`   ✅ 已保存: ${SAT_PATH}`);

  // Show remaining failures
  const stillMissing = needPhone.filter(w => !w.usphone && !w.ukphone);
  if (stillMissing.length > 0) {
    console.log(`\n   仍缺音标的词 (${stillMissing.length} 个):`);
    stillMissing.slice(0, 20).forEach(w => process.stdout.write(`  ${w.name}\n`));
    if (stillMissing.length > 20) console.log(`   ... 还有 ${stillMissing.length - 20} 个`);
  }
}

main().catch(console.error);
