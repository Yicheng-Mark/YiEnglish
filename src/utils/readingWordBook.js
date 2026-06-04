import { addWordToBook, removeWordFromBook, fetchWordBook, replaceWordBook } from '../lib/api-wordbooks'
import { idbPut, idbDelete, idbClear, idbBulkPut } from './idb.js'
import { findWordInMap } from './wordLookup.js'

const STORAGE_KEY = 'lingoforge_reading_words';

// 内存缓存：words 数组
let _cache = null;

function isMigrated() {
  return localStorage.getItem(STORAGE_KEY + '_migrated') === '1';
}

function ensureCache() {
  if (_cache !== null) return;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    _cache = saved ? JSON.parse(saved).words || [] : [];
  } catch {
    _cache = [];
  }
}

let dictWordMap = null;

async function buildDictWordMap() {
  if (dictWordMap) return dictWordMap;
  dictWordMap = new Map();
  const dictIds = ['junior', 'zhongkao', 'senior', 'gaokao', 'cet4', 'cet4freq', 'cet6', 'cet6freq', 'tem4', 'tem8', 'ielts', 'toefl', 'sat', 'postgraduate', 'postgraduateCore', 'programmer'];
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
    if (isMigrated()) {
      _cache = enriched;
      idbBulkPut('readingWords', enriched).catch(e => console.warn('[IDB] readingWords bulkPut failed:', e));
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ words: enriched }));
    replaceWordBook('reading', enriched).catch(e => console.warn('Sync enriched reading words failed:', e))
  }
}

export function getReadingWordBook() {
  if (isMigrated()) {
    ensureCache();
    return { words: _cache };
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : { words: [] };
  } catch {
    return { words: [] };
  }
}

export function addToReadingWordBook(wordInfo) {
  try {
    if (isMigrated()) {
      ensureCache();
      const existingIndex = _cache.findIndex((w) => w.name === wordInfo.name);
      if (existingIndex !== -1) {
        _cache[existingIndex] = {
          ..._cache[existingIndex],
          ...wordInfo,
          addTime: _cache[existingIndex].addTime || Date.now(),
        };
        idbPut('readingWords', _cache[existingIndex]).catch(e => console.warn('[IDB] readingWords put failed:', e));
      } else {
        const entry = { ...wordInfo, addTime: Date.now() };
        _cache.unshift(entry);
        idbPut('readingWords', entry).catch(e => console.warn('[IDB] readingWords put failed:', e));
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ words: _cache }));
    } else {
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
    }

    addWordToBook('reading', wordInfo).catch(e => console.warn('Sync reading add failed:', e))
  } catch (e) {
    console.error('Failed to add to reading word book:', e);
  }
}

export function removeFromReadingWordBook(wordName) {
  try {
    if (isMigrated()) {
      ensureCache();
      _cache = _cache.filter((w) => w.name !== wordName);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ words: _cache }));
      idbDelete('readingWords', wordName).catch(e => console.warn('[IDB] readingWords delete failed:', e));
    } else {
      const data = getReadingWordBook();
      const words = (data.words || []).filter((w) => w.name !== wordName);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ words }));
    }

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
    if (isMigrated()) {
      _cache = data.words || [];
      await idbClear('readingWords');
      await idbBulkPut('readingWords', _cache);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.warn('Sync reading word book from server failed:', e)
  }
}
