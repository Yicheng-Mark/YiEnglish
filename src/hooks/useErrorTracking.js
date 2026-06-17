import { useCallback } from 'react';
import { idbPut, idbGetAll } from '../utils/idb';

const STORE = 'errorDetails';

// QWERTY 键盘邻接表
const ADJACENT = {
  q: 'w', w: 'qe', e: 'wr', r: 'et', t: 'ry', y: 'tu', u: 'yi', i: 'uo', o: 'ip', p: 'o',
  a: 'sq', s: 'adw', d: 'sfe', f: 'dgr', g: 'fht', h: 'gjy', j: 'hku', k: 'jli', l: 'k',
  z: 'x', x: 'zc', c: 'xv', v: 'cb', b: 'vn', n: 'bm', m: 'n',
};

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

function classifyError(word, letterIndex, expected, typed) {
  // 1. 双写遗漏：期望字母与前一个字母相同（用户漏打重复字母）
  if (letterIndex > 0 && expected === word[letterIndex - 1]) {
    return 'doubleLetter';
  }
  // 2. 元音混淆
  if (VOWELS.has(expected) && VOWELS.has(typed)) {
    return 'vowel';
  }
  // 3. 相邻键位（expected/typed 可能为 undefined —— 空章节/加载中时触发，需防御）
  if (typeof expected !== 'string' || typeof typed !== 'string') return 'other';
  const e = expected.toLowerCase();
  const t = typed.toLowerCase();
  if (ADJACENT[e] && ADJACENT[e].includes(t)) {
    return 'adjacentKey';
  }
  // 4. 其他
  return 'other';
}

// 内存缓存：避免每次 getErrorStats 都读 IDB
let _cache = null;
let _cacheTimestamp = 0;
const CACHE_TTL = 3000; // 3 秒

function invalidateCache() {
  _cache = null;
  _cacheTimestamp = 0;
}

export default function useErrorTracking() {
  const onError = useCallback((wordObj, expected, typed, letterIndex) => {
    // 空/加载中场景 expected/typed 可能为 undefined，跳过避免崩溃并污染统计
    if (typeof expected !== 'string' || typeof typed !== 'string') return;
    const word = typeof wordObj === 'string' ? wordObj : wordObj.name;
    const entry = {
      word,
      letterIndex,
      expected,
      typed,
      timestamp: Date.now(),
      pattern: classifyError(word, letterIndex, expected, typed),
    };
    // 写入 IndexedDB（异步，不阻塞输入）
    idbPut(STORE, entry).catch(() => {});
    invalidateCache();
  }, []);

  const getRecentErrors = useCallback(async (days = 30) => {
    const all = await idbGetAll(STORE);
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return all.filter(e => e.timestamp >= cutoff);
  }, []);

  const getErrorStats = useCallback(async () => {
    // 使用缓存
    const now = Date.now();
    if (_cache && (now - _cacheTimestamp) < CACHE_TTL) {
      return _cache;
    }

    const recent = await getRecentErrors(30);
    const total = recent.length;

    const byPattern = { doubleLetter: 0, vowel: 0, adjacentKey: 0, other: 0 };
    const wordMap = {}; // word -> { totalErrors, errorMap: { letterIndex: count } }

    for (const err of recent) {
      byPattern[err.pattern] = (byPattern[err.pattern] || 0) + 1;

      if (!wordMap[err.word]) {
        wordMap[err.word] = { word: err.word, totalErrors: 0, errorMap: {} };
      }
      wordMap[err.word].totalErrors += 1;
      wordMap[err.word].errorMap[err.letterIndex] = (wordMap[err.word].errorMap[err.letterIndex] || 0) + 1;
    }

    // Top 5 错误最多的单词
    const topWords = Object.values(wordMap)
      .sort((a, b) => b.totalErrors - a.totalErrors)
      .slice(0, 5);

    const result = { total, byPattern, topWords };
    _cache = result;
    _cacheTimestamp = now;
    return result;
  }, [getRecentErrors]);

  return { onError, getErrorStats, getRecentErrors };
}
