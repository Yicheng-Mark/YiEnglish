import { getToken } from '../lib/auth'
import { addWordToBook, removeWordFromBook, fetchWordBook } from '../lib/api-wordbooks'

const STORAGE_KEY = 'lingoforge_favorite_words';

export function getFavoriteWords() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : { words: [] };
  } catch {
    return { words: [] };
  }
}

export function addToFavoriteWords(wordInfo) {
  try {
    const data = getFavoriteWords();
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

    if (getToken()) {
      addWordToBook('favorite', wordInfo).catch(e => console.warn('Sync favorite add failed:', e))
    }
  } catch (e) {
    console.error('Failed to add to favorite words:', e);
  }
}

export function removeFromFavoriteWords(wordName) {
  try {
    const data = getFavoriteWords();
    const words = (data.words || []).filter((w) => w.name !== wordName);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ words }));

    if (getToken()) {
      removeWordFromBook('favorite', wordName).catch(e => console.warn('Sync favorite remove failed:', e))
    }
  } catch (e) {
    console.error('Failed to remove from favorite words:', e);
  }
}

export function isInFavoriteWords(wordName) {
  const data = getFavoriteWords();
  return (data.words || []).some((w) => w.name === wordName);
}

export function getFavoriteWordsCount() {
  return getFavoriteWords().words?.length || 0;
}

const CHAPTER_SIZE = 25;

export function loadFavoriteWordsAsDictionary() {
  const data = getFavoriteWords();
  const words = data.words || [];

  if (words.length === 0) {
    return {
      name: '收藏词本',
      description: '你收藏的词汇',
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
    name: '收藏词本',
    description: '你收藏的词汇',
    chapters,
  };
}

export async function syncFavoriteWordsFromServer() {
  if (!getToken()) return
  try {
    const data = await fetchWordBook('favorite')
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.warn('Sync favorite words from server failed:', e)
  }
}
