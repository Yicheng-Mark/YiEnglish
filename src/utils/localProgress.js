import { idbPut } from './idb.js'

const PROGRESS_KEY = 'lf_progress'

// 内存缓存：{ "dictId:chapterId": [word1, word2] }
let _cache = null;

function isMigrated() {
  return localStorage.getItem(PROGRESS_KEY + '_migrated') === '1';
}

function ensureCache() {
  if (_cache !== null) return;
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    _cache = raw ? JSON.parse(raw) : {};
  } catch {
    _cache = {};
  }
}

export function saveLocalProgress(dictId, chapterId, words) {
  try {
    const key = `${dictId}:${chapterId}`;

    if (isMigrated()) {
      ensureCache();
      if (!_cache[key]) _cache[key] = [];
      const set = new Set(_cache[key]);
      for (const w of words) set.add(w);
      _cache[key] = [...set];
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(_cache));
      idbPut('progress', { dictChapter: key, words: _cache[key] }).catch(e => console.warn('[IDB] progress put failed:', e));
    } else {
      const raw = localStorage.getItem(PROGRESS_KEY);
      const data = raw ? JSON.parse(raw) : {};
      if (!data[key]) data[key] = [];
      const set = new Set(data[key]);
      for (const w of words) set.add(w);
      data[key] = [...set];
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(data));
    }
  } catch (e) {
    console.warn('[localProgress] save error', e);
  }
}

export function getLocalProgress(dictId) {
  try {
    if (isMigrated()) {
      ensureCache();
      const chapters = {};
      for (const [key, words] of Object.entries(_cache)) {
        if (key.startsWith(`${dictId}:`)) {
          const chapterId = key.split(':')[1];
          chapters[chapterId] = words.length;
        }
      }
      return chapters;
    }
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    const chapters = {};
    for (const [key, words] of Object.entries(data)) {
      if (key.startsWith(`${dictId}:`)) {
        const chapterId = key.split(':')[1];
        chapters[chapterId] = words.length;
      }
    }
    return chapters;
  } catch (e) {
    console.warn('[localProgress] read error', e);
    return {};
  }
}
