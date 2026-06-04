import { addWordToBook, removeWordFromBook, clearWordBook, fetchWordBook } from '../lib/api-wordbooks'
import { idbPut, idbDelete, idbClear, idbBulkPut } from './idb.js'

const STORAGE_KEY = 'typingword_wrong';

// 内存缓存：迁移后同步读走的路径
let _cache = null;

function isMigrated() {
  return localStorage.getItem(STORAGE_KEY + '_migrated') === '1';
}

/** 从 localStorage 加载缓存（迁移后 localStorage 数据仍保留，可做 bootstrap） */
function ensureCache() {
  if (_cache !== null) return;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    _cache = saved ? JSON.parse(saved).words || [] : [];
  } catch {
    _cache = [];
  }
}

export function addToErrorBook({ word, trans, notation, dictName }) {
  try {
    if (isMigrated()) {
      ensureCache();
      const existingIndex = _cache.findIndex(w => w.name === word);
      if (existingIndex !== -1) {
        _cache[existingIndex].wrongCount = (_cache[existingIndex].wrongCount || 1) + 1;
        _cache[existingIndex].trans = Array.isArray(trans) ? trans : (trans ? trans.split('; ') : []);
        _cache[existingIndex].notation = notation || _cache[existingIndex].notation;
        _cache[existingIndex].dictName = dictName || _cache[existingIndex].dictName;
        _cache[existingIndex].lastWrongTime = Date.now();
      } else {
        _cache.unshift({
          name: word,
          trans: Array.isArray(trans) ? trans : (trans ? trans.split('; ') : []),
          notation: notation || '',
          dictName: dictName || '',
          wrongCount: 1,
          addTime: Date.now(),
          lastWrongTime: Date.now(),
        });
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ words: _cache }));
      idbPut('errorBook', existingIndex !== -1 ? _cache[existingIndex] : _cache[0]).catch(e => console.warn('[IDB] errorBook put failed:', e));
    } else {
      const saved = localStorage.getItem(STORAGE_KEY);
      const data = saved ? JSON.parse(saved) : { words: [] };
      const words = data.words || [];

      const existingIndex = words.findIndex(w => w.name === word);
      if (existingIndex !== -1) {
        words[existingIndex].wrongCount = (words[existingIndex].wrongCount || 1) + 1;
        words[existingIndex].trans = Array.isArray(trans) ? trans : (trans ? trans.split('; ') : []);
        words[existingIndex].notation = notation || words[existingIndex].notation;
        words[existingIndex].dictName = dictName || words[existingIndex].dictName;
        words[existingIndex].lastWrongTime = Date.now();
      } else {
        words.unshift({
          name: word,
          trans: Array.isArray(trans) ? trans : (trans ? trans.split('; ') : []),
          notation: notation || '',
          dictName: dictName || '',
          wrongCount: 1,
          addTime: Date.now(),
          lastWrongTime: Date.now(),
        });
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify({ words }));
    }

    addWordToBook('error', { name: word, trans, notation, dictName }).catch(e => console.warn('Sync error add failed:', e))
  } catch (e) {
    console.error('Failed to add to error book:', e);
  }
}

export function getErrorBook() {
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

export function removeFromErrorBook(wordName) {
  try {
    if (isMigrated()) {
      ensureCache();
      _cache = _cache.filter(w => w.name !== wordName);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ words: _cache }));
      idbDelete('errorBook', wordName).catch(e => console.warn('[IDB] errorBook delete failed:', e));
    } else {
      const saved = localStorage.getItem(STORAGE_KEY);
      const data = saved ? JSON.parse(saved) : { words: [] };
      const words = (data.words || []).filter(w => w.name !== wordName);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ words }));
    }

    removeWordFromBook('error', wordName).catch(e => console.warn('Sync error remove failed:', e))
  } catch (e) {
    console.error('Failed to remove from error book:', e);
  }
}

export function clearErrorBook() {
  if (isMigrated()) {
    _cache = [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ words: [] }));
    idbClear('errorBook').catch(e => console.warn('[IDB] errorBook clear failed:', e));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }

  clearWordBook('error').catch(e => console.warn('Sync error clear failed:', e))
}

export function getErrorBookCount() {
  return getErrorBook().words?.length || 0;
}

const CHAPTER_SIZE = 25;

export function loadErrorBookAsDictionary() {
  const data = getErrorBook();
  const words = data.words || [];

  if (words.length === 0) {
    return {
      name: '错题本',
      description: '专属错题练习',
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
      words: chunk.map(w => ({
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
    name: '错题本',
    description: '专属错题练习',
    chapters,
  };
}

export async function syncErrorBookFromServer() {
  try {
    const data = await fetchWordBook('error')
    if (isMigrated()) {
      _cache = data.words || [];
      await idbClear('errorBook');
      await idbBulkPut('errorBook', _cache);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.warn('Sync error book from server failed:', e)
  }
}
