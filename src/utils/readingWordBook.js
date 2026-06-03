import { addWordToBook, removeWordFromBook, fetchWordBook, replaceWordBook } from '../lib/api-wordbooks'

const STORAGE_KEY = 'lingoforge_reading_words';

let dictWordMap = null;

async function buildDictWordMap() {
  if (dictWordMap) return dictWordMap;
  dictWordMap = new Map();
  const dictIds = ['junior', 'zhongkao', 'senior', 'gaokao', 'cet4', 'cet4freq', 'cet6', 'cet6freq', 'tem4', 'tem8', 'ielts', 'toefl', 'sat', 'postgraduate', 'programmer'];
  for (const id of dictIds) {
    try {
      const mod = await import(`../dictionaries/${id}.json`);
      const dict = mod.default ?? mod;
      dict.chapters?.forEach((ch) => {
        ch.words?.forEach((w) => {
          if (w?.name) {
            dictWordMap.set(w.name.toLowerCase(), w);
          }
        });
      });
    } catch {
      // ignore missing dictionaries
    }
  }
  return dictWordMap;
}

// 不规则动词映射（过去式/过去分词 → 原形）
const IRREGULAR_VERBS = {
  // be
  am: 'be', is: 'be', are: 'be', was: 'be', were: 'be', been: 'be',
  // have
  has: 'have', had: 'have',
  // do
  does: 'do', did: 'do', done: 'do',
  // say
  said: 'say',
  // tell
  told: 'tell',
  // take
  took: 'take', taken: 'take',
  // make
  made: 'make',
  // go
  went: 'go', gone: 'go',
  // come
  came: 'come',
  // give
  gave: 'give', given: 'give',
  // know
  knew: 'know', known: 'know',
  // get
  got: 'get', gotten: 'get',
  // see
  saw: 'see', seen: 'see',
  // find
  found: 'find',
  // think
  thought: 'think',
  // speak
  spoke: 'speak', spoken: 'speak',
  // drive
  drove: 'drive', driven: 'drive',
  // write
  wrote: 'write', written: 'write',
  // choose
  chose: 'choose', chosen: 'choose',
  // wear
  wore: 'wear', worn: 'wear',
  // grow
  grew: 'grow', grown: 'grow',
  // draw
  drew: 'draw', drawn: 'draw',
  // throw
  threw: 'throw', thrown: 'throw',
  // blow
  blew: 'blow', blown: 'blow',
  // fly
  flew: 'fly', flown: 'fly',
  // build
  built: 'build',
  // send
  sent: 'send',
  // spend
  spent: 'spend',
  // catch
  caught: 'catch',
  // teach
  taught: 'teach',
  // buy
  bought: 'buy',
  // fight
  fought: 'fight',
  // sell
  sold: 'sell',
  // sing
  sang: 'sing', sung: 'sing',
  // swim
  swam: 'swim', swum: 'swim',
  // ring
  rang: 'ring', rung: 'ring',
  // bring
  brought: 'bring',
  // begin
  began: 'begin', begun: 'begin',
  // keep
  kept: 'keep',
  // pay
  paid: 'pay',
  // run
  ran: 'run',
  // sit
  sat: 'sit',
  // stand
  stood: 'stand',
  // hear
  heard: 'hear',
  // meet
  met: 'meet',
  // hold
  held: 'hold',
  // lead
  led: 'lead',
  // leave
  left: 'leave',
  // lose
  lost: 'lose',
  // mean
  meant: 'mean',
  // read
  read: 'read', // past tense is same spelling, skip
  // rise
  rose: 'rise', risen: 'rise',
  // break
  broke: 'break', broken: 'break',
  // fall
  fell: 'fall', fallen: 'fall',
  // feel
  felt: 'feel',
  // sleep
  slept: 'sleep',
  // win
  won: 'win',
  // lay / lie
  laid: 'lay', lay: 'lie',
  // bear
  bore: 'bear', borne: 'bear',
  // bite
  bit: 'bite', bitten: 'bite',
  // hide
  hid: 'hide', hidden: 'hide',
  // shoot
  shot: 'shoot',
  // shut
  shut: 'shut', // same form, skip
  // cost
  cost: 'cost', // same form, skip
  // hang
  hung: 'hang',
  // shine
  shone: 'shine',
  // show
  showed: 'show', shown: 'show',
  // wake
  woke: 'wake', woken: 'wake',
  // understand
  understood: 'understand',
  // deal
  dealt: 'deal',
  // feed
  fed: 'feed',
  // bleed
  bled: 'bleed',
  // speed
  sped: 'speed',
  // lend
  lent: 'lend',
  // bind
  bound: 'bind',
  // wind
  wound: 'wind',
  // strike
  struck: 'strike',
  // seek
  sought: 'seek',
  // weave
  wove: 'weave', woven: 'weave',
  // freeze
  froze: 'freeze', frozen: 'freeze',
  // steal
  stole: 'steal', stolen: 'steal',
  // tear
  tore: 'tear', torn: 'tear',
  // swing
  swung: 'swing',
  // sink
  sank: 'sink', sunk: 'sink',
  // shrink
  shrank: 'shrink', shrunk: 'shrink',
  // spread
  spread: 'spread', // same form
  // breed
  bred: 'breed',
  // light
  lit: 'light',
};

// 去双写辅音：如果词尾是两个相同辅音字母，生成去掉一个的版本
function dedoubleConsonant(word) {
  if (word.length < 3) return null;
  const last = word[word.length - 1];
  const prev = word[word.length - 2];
  // 辅音字母（排除 a,e,i,o,u）
  if (last === prev && !/[aeiou]/.test(last)) {
    return word.slice(0, -1);
  }
  return null;
}

export function findWordInMap(wordName, map) {
  const key = wordName.toLowerCase();
  if (map.has(key)) return map.get(key);

  // 1. 不规则动词表
  const irreg = IRREGULAR_VERBS[key];
  if (irreg && map.has(irreg)) return map.get(irreg);

  const fallbacks = [];

  // 2. -ies → -y（studies → study）
  if (key.endsWith('ies')) {
    fallbacks.push(key.slice(0, -3) + 'y');
  }

  // 3. 名词复数 -s/-es（不用 else-if，同时尝试两种）
  if (key.endsWith('s')) {
    fallbacks.push(key.slice(0, -1)); // -s: runs → run
    if (key.endsWith('es')) {
      fallbacks.push(key.slice(0, -2)); // -es: boxes → box
    }
  }

  // 4. -ied → -y（carried → carry）
  if (key.endsWith('ied')) {
    fallbacks.push(key.slice(0, -3) + 'y');
  }

  // 5. -ed 过去式（played→play, stopped→stop, enabled→enable）
  if (key.endsWith('ed')) {
    const stripEd = key.slice(0, -2); // strip -ed
    const stripD = key.slice(0, -1);  // strip -d
    fallbacks.push(stripEd, stripD);
    // 去双写辅音：stopped → stoppe → stop
    const dd = dedoubleConsonant(stripEd);
    if (dd) fallbacks.push(dd);
  }

  // 6. -ying → -ie（studying → study）
  if (key.endsWith('ying')) {
    fallbacks.push(key.slice(0, -4) + 'y', key.slice(0, -3) + 'ie');
  }

  // 7. -ing 现在分词（running→run, making→make, stopping→stop）
  if (key.endsWith('ing')) {
    const base = key.slice(0, -3);      // running → runn
    const baseE = base + 'e';            // making → mak + e = make
    fallbacks.push(base, baseE);
    // 去双写辅音：runn → run, stopp → stop
    const dd = dedoubleConsonant(base);
    if (dd) fallbacks.push(dd);
  }

  // 8. -ly 副词（seriously → serious, easily → easy）
  if (key.endsWith('ly')) {
    const noLy = key.slice(0, -2);
    fallbacks.push(noLy);
    // -ily → -y（happily → happy）
    if (key.endsWith('ily')) {
      fallbacks.push(key.slice(0, -3) + 'y');
    }
    // -ally → -al（basically → basic → 基本不行，但 basically → 试试）
    // 注意：seriously → serious 已由 strip -ly 处理
  }

  // 9. -er 比较级（older → old, easier → easy）
  if (key.endsWith('er')) {
    const noEr = key.slice(0, -2);
    fallbacks.push(noEr);
    const dd = dedoubleConsonant(noEr);
    if (dd) fallbacks.push(dd); // bigger → bigg → big
    // -ier → -y（easier → easy）
    if (key.endsWith('ier')) {
      fallbacks.push(key.slice(0, -3) + 'y');
    }
  }

  // 10. -est 最高级（oldest → old）
  if (key.endsWith('est')) {
    const noEst = key.slice(0, -3);
    fallbacks.push(noEst);
    const dd = dedoubleConsonant(noEst);
    if (dd) fallbacks.push(dd); // biggest → bigg → big
    // -iest → -y（easiest → easy）
    if (key.endsWith('iest')) {
      fallbacks.push(key.slice(0, -4) + 'y');
    }
  }

  for (const fb of fallbacks) {
    if (map.has(fb)) return map.get(fb);
  }
  return null;
}

export async function enrichReadingWordBook() {
  const data = getReadingWordBook();
  const words = data.words || [];
  if (words.length === 0) return;

  const map = await buildDictWordMap();
  let changed = false;

  const enriched = words.map((w) => {
    const hasPhonetic = w.usphone || w.ukphone || w.us || w.uk;
    const hasTrans = Array.isArray(w.trans) ? w.trans.length > 0 : w.trans;
    if (hasPhonetic && hasTrans) return w;

    const lookup = findWordInMap(w.name, map);
    if (!lookup) return w;

    changed = true;
    return {
      ...w,
      usphone: w.usphone || lookup.usphone,
      ukphone: w.ukphone || lookup.ukphone,
      us: w.us || lookup.us,
      uk: w.uk || lookup.uk,
      trans: hasTrans ? w.trans : lookup.trans,
      notation: w.notation || lookup.notation,
    };
  });

  if (changed) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ words: enriched }));
    replaceWordBook('reading', enriched).catch(e => console.warn('Sync enriched reading words failed:', e))
  }
}

export function getReadingWordBook() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : { words: [] };
  } catch {
    return { words: [] };
  }
}

export function addToReadingWordBook(wordInfo) {
  try {
    const data = getReadingWordBook();
    const words = data.words || [];
    const existingIndex = words.findIndex((w) => w.name === wordInfo.name);
    if (existingIndex !== -1) {
      words[existingIndex] = {
        ...words[existingIndex],
        ...wordInfo,
        addTime: words[existingIndex].addTime || Date.now(),
      };
    } else {
      words.unshift({
        ...wordInfo,
        addTime: Date.now(),
      });
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ words }));

    addWordToBook('reading', wordInfo).catch(e => console.warn('Sync reading add failed:', e))
  } catch (e) {
    console.error('Failed to add to reading word book:', e);
  }
}

export function removeFromReadingWordBook(wordName) {
  try {
    const data = getReadingWordBook();
    const words = (data.words || []).filter((w) => w.name !== wordName);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ words }));

    removeWordFromBook('reading', wordName).catch(e => console.warn('Sync reading remove failed:', e))
  } catch (e) {
    console.error('Failed to remove from reading word book:', e);
  }
}

export function isInReadingWordBook(wordName) {
  const data = getReadingWordBook();
  return (data.words || []).some((w) => w.name === wordName);
}

export function getReadingWordBookCount() {
  return getReadingWordBook().words?.length || 0;
}

const CHAPTER_SIZE = 25;

export function loadReadingWordBookAsDictionary() {
  const data = getReadingWordBook();
  const words = data.words || [];

  if (words.length === 0) {
    return {
      name: '阅读词本',
      description: '语境中积累的词汇',
      chapters: [],
    };
  }

  const chapters = [];
  for (let i = 0; i < words.length; i += CHAPTER_SIZE) {
    const chunk = words.slice(i, i + CHAPTER_SIZE);
    const chapterIndex = Math.floor(i / CHAPTER_SIZE);
    chapters.push({
      id: chapterIndex,
      name: `第 ${chapterIndex + 1} 章`,
      words: chunk.map((w) => ({
        name: w.name,
        trans: w.trans,
        notation: w.notation,
        usphone: w.usphone,
        ukphone: w.ukphone,
        us: w.us,
        uk: w.uk,
      })),
    });
  }

  return {
    name: '阅读词本',
    description: '语境中积累的词汇',
    chapters,
  };
}

export async function syncReadingWordBookFromServer() {
  try {
    const data = await fetchWordBook('reading')
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.warn('Sync reading word book from server failed:', e)
  }
}
