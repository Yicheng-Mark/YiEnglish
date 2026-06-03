/**
 * fix-gaps.mjs — 补全所有词库剩余缺失项
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');
const DICT_DIR = join(__dirname, '..', 'src', 'dictionaries');

function loadDict(id) {
  const p = join(DICT_DIR, `${id}.json`);
  return JSON.parse(readFileSync(p, 'utf-8'));
}
function saveDict(id, dict) {
  writeFileSync(join(DICT_DIR, `${id}.json`), JSON.stringify(dict, null, 2), 'utf-8');
}

// ============================================================
// 音标补全数据
// ============================================================
const phonetics = {
  // Senior
  'bean curd': { us: 'ˌbiːn ˈkɜːrd', uk: 'ˌbiːn ˈkɜːd' },
  'human being': { us: 'ˈhjuːmən ˈbiːɪŋ', uk: 'ˈhjuːmən ˈbiːɪŋ' },
  // CET-6
  'according to': { us: 'əˈkɔːrdɪŋ tuː', uk: 'əˈkɔːdɪŋ tʊ' },
  'affordable': { us: 'əˈfɔːrdəbl', uk: 'əˈfɔːdəbl' },
  'air-conditioner': { us: 'ˈer kənˌdɪʃənər', uk: 'ˈeə kənˌdɪʃənər' },
  'air-conditioning': { us: 'ˈer kənˌdɪʃənɪŋ', uk: 'ˈeə kənˌdɪʃənɪŋ' },
  'app': { us: 'æp', uk: 'æp' },
  'autobiographic': { us: 'ˌɔːtəˌbaɪəˈɡræfɪk', uk: 'ˌɔːtəˌbaɪəˈɡræfɪk' },
  'automatically': { us: 'ˌɔːtəˈmætɪkli', uk: 'ˌɔːtəˈmætɪkli' },
  'axe': { us: 'æks', uk: 'æks' },
  'barracks': { us: 'ˈbærəks', uk: 'ˈbærəks' },
  'bbq': { us: 'ˌbiːˌbiːˈkjuː', uk: 'ˌbiːˌbiːˈkjuː' },
  'beetle': { us: 'ˈbiːtəl', uk: 'ˈbiːt(ə)l' },
  'blog': { us: 'blɒɡ', uk: 'blɒɡ' },
  'brand-new': { us: 'ˈbrændˈnjuː', uk: 'ˈbrændˈnjuː' },
  'buddhist': { us: 'ˈbʊdɪst', uk: 'ˈbʊdɪst' },
  'christ': { us: 'kraɪst', uk: 'kraɪst' },
  'cigaret': { us: 'ˈsɪɡəˌret', uk: 'ˈsɪɡəˌret' },
  'clear-cut': { us: 'ˈklɪrˈkʌt', uk: 'ˈklɪəˈkʌt' },
  'cyberspace': { us: 'ˈsaɪbərˌspeɪs', uk: 'ˈsaɪbəˌspeɪs' },
  'deployment': { us: 'dɪˈplɔɪmənt', uk: 'dɪˈplɔɪmənt' },
  'derailment': { us: 'dɪˈreɪlmənt', uk: 'dɪˈreɪlmənt' },
  'distil': { us: 'dɪˈstɪl', uk: 'dɪˈstɪl' },
  'durability': { us: 'ˌdjʊrəˈbɪləti', uk: 'ˌdjʊərəˈbɪləti' },
  'easy-going': { us: 'ˈiːziˈɡoʊɪŋ', uk: 'ˈiːziˈɡəʊɪŋ' },
  'electronically': { us: 'ɪˌlekˈtrɒnɪkli', uk: 'ɪˌlekˈtrɒnɪkli' },
  'emphasise': { us: 'ˈemfəˌsaɪz', uk: 'ˈemfəˌsaɪz' },
  'enlightening': { us: 'ɪnˈlaɪtənɪŋ', uk: 'ɪnˈlaɪtənɪŋ' },
  'errand': { us: 'ˈerənd', uk: 'ˈerənd' },
  'finalise': { us: 'ˈfaɪnəlaɪz', uk: 'ˈfaɪnəlaɪz' },
  'founding': { us: 'ˈfaʊndɪŋ', uk: 'ˈfaʊndɪŋ' },
  'freshman': { us: 'ˈfreʃmən', uk: 'ˈfreʃmən' },
  'fulfilment': { us: 'fʊlˈfɪlmənt', uk: 'fʊlˈfɪlmənt' },
  'genetically': { us: 'dʒəˈnetɪkli', uk: 'dʒəˈnetɪkli' },
  'geographically': { us: 'ˌdʒiːəˈɡræfɪkli', uk: 'ˌdʒiːəˈɡræfɪkli' },
  'globalise': { us: 'ˈɡloʊbəlaɪz', uk: 'ˈɡləʊbəlaɪz' },
  'granted': { us: 'ˈɡræntɪd', uk: 'ˈɡrɑːntɪd' },
  'graphically': { us: 'ˈɡræfɪkli', uk: 'ˈɡræfɪkli' },
  'guy': { us: 'ɡaɪ', uk: 'ɡaɪ' },
  'helplessly': { us: 'ˈhelpləsli', uk: 'ˈhelpləsli' },
  'hibernation': { us: 'ˌhaɪbərˈneɪʃən', uk: 'ˌhaɪbəˈneɪʃən' },
  'high-tech': { us: 'ˈhaɪˈtek', uk: 'ˈhaɪˈtek' },
  'hurriedly': { us: 'ˈhɜːrɪdli', uk: 'ˈhʌrɪdli' },
  'implementation': { us: 'ˌɪmplɪmenˈteɪʃən', uk: 'ˌɪmplɪmenˈteɪʃən' },
  'including': { us: 'ɪnˈkluːdɪŋ', uk: 'ɪnˈkluːdɪŋ' },
  'instal': { us: 'ɪnˈstɔːl', uk: 'ɪnˈstɔːl' },
  'intrinsically': { us: 'ɪnˈtrɪnsɪkli', uk: 'ɪnˈtrɪnzɪkli' },
  'ironically': { us: 'aɪˈrɒnɪkli', uk: 'aɪˈrɒnɪkli' },
  'jeopardise': { us: 'ˈdʒepərdaɪz', uk: 'ˈdʒepədaɪz' },
  'jetlag': { us: 'ˈdʒetˌlæɡ', uk: 'ˈdʒetˌlæɡ' },
  'knowhow': { us: 'ˈnoʊˌhaʊ', uk: 'ˈnəʊˌhaʊ' },
  'laptop': { us: 'ˈlæptɒp', uk: 'ˈlæptɒp' },
  'mindset': { us: 'ˈmaɪndset', uk: 'ˈmaɪndset' },
  'minimise': { us: 'ˈmɪnɪmaɪz', uk: 'ˈmɪnɪmaɪz' },
  'narrator': { us: 'ˈnærətər', uk: 'ˈnærətər' },
  'networking': { us: 'ˈnetwɜːrkɪŋ', uk: 'ˈnetwɜːkɪŋ' },
  'obliged': { us: 'əˈblaɪdʒd', uk: 'əˈblaɪdʒd' },
  'obtainment': { us: 'əbˈteɪnmənt', uk: 'əbˈteɪnmənt' },
  'organisational': { us: 'ˌɔːrɡənəˈzeɪʃənəl', uk: 'ˌɔːɡənaɪˈzeɪʃənəl' },
  'ought to': { us: 'ˈɔːtə tʊ', uk: 'ˈɔːt tʊ' },
  'owing to': { us: 'ˈoʊɪŋ tuː', uk: 'ˈəʊɪŋ tʊ' },
  'penalise': { us: 'ˈpiːnəlaɪz', uk: 'ˈpiːnəlaɪz' },
  'planning': { us: 'ˈplænɪŋ', uk: 'ˈplænɪŋ' },
  'podcast': { us: 'ˈpɒdkæst', uk: 'ˈpɒdkɑːst' },
  'privatization': { us: 'ˌpraɪvətaɪˈzeɪʃən', uk: 'ˌpraɪvətaɪˈzeɪʃən' },
  'privatize': { us: 'ˈpraɪvətaɪz', uk: 'ˈpraɪvətaɪz' },
  'scrutinise': { us: 'ˈskruːtɪnaɪz', uk: 'ˈskruːtɪnaɪz' },
  'sensitivity': { us: 'ˌsensəˈtɪvəti', uk: 'ˌsensəˈtɪvəti' },
  'shyly': { us: 'ˈʃaɪli', uk: 'ˈʃaɪli' },
  'smartphone': { us: 'ˈsmɑːrtfoʊn', uk: 'ˈsmɑːtfəʊn' },
  'smuggling': { us: 'ˈsmʌɡlɪŋ', uk: 'ˈsmʌɡlɪŋ' },
  'sparingly': { us: 'ˈsperɪŋli', uk: 'ˈspeərɪŋli' },
  'standardise': { us: 'ˈstændərdaɪz', uk: 'ˈstændədaɪz' },
  'subsidise': { us: 'ˈsʌbsɪdaɪz', uk: 'ˈsʌbsɪdaɪz' },
  'watchful': { us: 'ˈwɒtʃfʊl', uk: 'ˈwɒtʃfʊl' },
  'webcast': { us: 'ˈwebkæst', uk: 'ˈwebkɑːst' },
  'well-off': { us: 'ˈwelˈɒf', uk: 'ˈwelˈɒf' },
  'westerner': { us: 'ˈwestərnər', uk: 'ˈwestənər' },
};

// ============================================================
// 词性修复数据
// ============================================================
const posFixes = {
  // Junior
  'n.': ['用法', 'application 的缩写解析错误 → 修正'],  // 实际是解析错误
  'personal computer': { trans: ['abbr. 个人电脑（Personal Computer）'] },
  'physical education': { trans: ['abbr. 体育（Physical Education）'] },
  // Senior
  'an': { trans: ['art. 一（个）〔用于以元音开头的单词前〕'] },
  'shall': { trans: ['aux. 将要；会；必须'] },
  'will': { trans: ['aux. 将，会，要〔用于构成将来时〕', 'n. 意志，毅力，决心'] },
  // CET-6 POS fixes (ECDICT 的 "[计] xxx" 格式 → 标准词性)
  'according to': { trans: ['prep. 根据，按照'] },
  'affordable': { trans: ['adj. 负担得起的，买得起的'] },
  'app': { trans: ['n. 应用程序（application 的缩写）'] },
  'auditing': { trans: ['n. 审计，查账'] },
  'cell-phone': { trans: ['n. 手机，移动电话'] },
  'cyberspace': { trans: ['n. 网络空间'] },
  'dating': { trans: ['n. 约会；记日期'] },
  'deployment': { trans: ['n. 部署，展开'] },
  'derailment': { trans: ['n. 出轨'] },
  'deregulate': { trans: ['vt. 解除管制，放松管制'] },
  'facilitation': { trans: ['n. 促进，便利化'] },
  'fertiliser': { trans: ['n. 肥料（fertilizer 的英式拼写）'] },
  'funding': { trans: ['n. 资金，拨款'] },
  'geographically': { trans: ['adv. 地理上地'] },
  'globalise': { trans: ['vt. 使全球化（globalize 的英式拼写）'] },
  'hacker': { trans: ['n. 黑客'] },
  'hierarchical': { trans: ['adj. 分层的，等级的'] },
  'homo': { trans: ['n. 人属（拉丁语）'] },
  'imaging': { trans: ['n. 成像'] },
  'infliction': { trans: ['n. 施加（惩罚等）'] },
  'intrinsically': { trans: ['adv. 本质上地'] },
  'laptop': { trans: ['n. 笔记本电脑'] },
  'mechanisation': { trans: ['n. 机械化（mechanization 的英式拼写）'] },
  'networking': { trans: ['n. 联网，社交'] },
  'ought to': { trans: ['aux. 应该，应当'] },
  'owing to': { trans: ['prep. 由于，因为'] },
  'privatization': { trans: ['n. 私有化'] },
  'quantification': { trans: ['n. 量化'] },
  'standardization': { trans: ['n. 标准化'] },
  'upload': { trans: ['vt. 上传'] },
};

function fix() {
  let totalFixed = 0;

  for (const id of ['junior', 'senior', 'cet4', 'cet6']) {
    const dict = loadDict(id);
    let fixed = 0;

    for (const ch of dict.chapters) {
      for (const w of ch.words) {
        const key = w.name.toLowerCase();

        // 补音标
        if ((!w.usphone || !w.ukphone) && phonetics[key]) {
          if (!w.usphone) w.usphone = phonetics[key].us;
          if (!w.ukphone) w.ukphone = phonetics[key].uk;
          fixed++;
        }

        // 修词性/释义
        const fix = posFixes[key];
        if (fix && fix.trans) {
          if (!w.trans || !w.trans[0] || !/^[a-z]+\./i.test(w.trans[0])) {
            w.trans = fix.trans;
            fixed++;
          }
        }
      }
    }

    if (fixed > 0) {
      saveDict(id, dict);
      console.log(`  ${id}: 修复 ${fixed} 项`);
      totalFixed += fixed;
    } else {
      console.log(`  ${id}: 无需修复`);
    }
  }

  // Junior 特殊处理：删除解析错误产生的 "n." 词条
  const junior = loadDict('junior');
  const before = junior.chapters.reduce((s, c) => s + c.words.length, 0);
  for (const ch of junior.chapters) {
    ch.words = ch.words.filter(w => w.name !== 'n.');
  }
  const after = junior.chapters.reduce((s, c) => s + c.words.length, 0);
  if (after < before) {
    junior.totalWords = after;
    // 重新编号章节
    junior.chapters = junior.chapters.filter(ch => ch.words.length > 0);
    junior.chapters.forEach((ch, i) => { ch.id = i; ch.name = `第${i+1}章`; });
    junior.totalChapters = junior.chapters.length;
    saveDict('junior', junior);
    console.log(`  junior: 删除 ${before - after} 个错误词条，更新为 ${after} 词`);
    totalFixed += (before - after);
  }

  console.log(`\n  总计修复: ${totalFixed} 项`);
}

fix();
