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

export function findWordInMap(wordName, map) {
  const key = wordName.toLowerCase();
  if (map.has(key)) return map.get(key);

  const fallbacks = [];
  if (key.endsWith('ies')) fallbacks.push(key.slice(0, -3) + 'y');
  else if (key.endsWith('es')) fallbacks.push(key.slice(0, -2));
  else if (key.endsWith('s')) fallbacks.push(key.slice(0, -1));

  if (key.endsWith('ied')) fallbacks.push(key.slice(0, -3) + 'y');
  else if (key.endsWith('ed')) fallbacks.push(key.slice(0, -2), key.slice(0, -1));

  if (key.endsWith('ying')) fallbacks.push(key.slice(0, -3) + 'ie');
  else if (key.endsWith('ing')) fallbacks.push(key.slice(0, -3), key.slice(0, -3) + 'e');

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
