import { getErrorBookCount, loadErrorBookAsDictionary } from '../utils/errorBook.js';
import { getReadingWordBookCount, loadReadingWordBookAsDictionary } from '../utils/readingWordBook.js';
import { getCorpusWordBookCount, loadCorpusWordBookAsDictionary } from '../utils/corpusWordBook.js';
import { getDueReviewCount, getTotalReviewCount } from '../utils/reviewCards.js';

const warmColors = [
  'warm-coral',
  'warm-amber',
  'warm-rose',
  'warm-sage',
  'warm-sky',
  'warm-violet',
  'warm-slate',
  'warm-teal',
];

const CHAPTER_SIZE = 25

export const dictionaryMeta = [
  { id: 'junior', name: '初中英语词汇', category: '中学英语', description: '初中阶段必学英语词汇', totalWords: 1757, color: warmColors[0] },
  { id: 'zhongkao', name: '中考英语核心词汇', category: '中学英语', description: '中考英语高频核心词汇', totalWords: 700, color: warmColors[1] },
  { id: 'senior', name: '高中英语词汇', category: '中学英语', description: '高中阶段必学英语词汇', totalWords: 3449, color: warmColors[2] },
  { id: 'gaokao', name: '高考英语核心词汇', category: '中学英语', description: '高考英语高频核心词汇', totalWords: 689, color: warmColors[3] },
  { id: 'cet4', name: '英语4级', category: '大学英语', description: '大学英语四级大纲词汇', totalWords: 4533, color: warmColors[4] },
  { id: 'cet4freq', name: '英语4级高频', category: '大学英语', description: 'CET-4 高频必考词汇', totalWords: 1488, color: warmColors[5] },
  { id: 'cet6', name: '英语6级', category: '大学英语', description: '大学英语六级大纲词汇', totalWords: 8013, color: warmColors[6] },
  { id: 'cet6freq', name: '英语6级高频', category: '大学英语', description: 'CET-6 高频必考词汇', totalWords: 1500, color: warmColors[7] },
  { id: 'tem4', name: '英语专四', category: '英专生英语', description: '英语专业四级考试大纲词汇', totalWords: 5977, color: warmColors[0] },
  { id: 'tem8', name: '英语专八', category: '英专生英语', description: '英语专业八级考试大纲词汇', totalWords: 12999, color: warmColors[1] },
  { id: 'ielts', name: '雅思词汇', category: '留学英语', description: '雅思考试大纲核心词汇', totalWords: 7999, color: warmColors[2] },
  { id: 'toefl', name: '托福词汇', category: '留学英语', description: '托福考试大纲核心词汇', totalWords: 9999, color: warmColors[3] },
  { id: 'sat', name: 'SAT 词汇', category: '留学英语', description: 'SAT 考试核心词汇', totalWords: 4423, color: warmColors[4] },
  { id: 'postgraduate', name: '考研词汇', category: '考研英语', description: '考研英语核心词汇', totalWords: 5527, color: warmColors[5] },
  { id: 'postgraduateCore', name: '考研核心词汇', category: '考研英语', description: '基于200套真题统计的高频核心词汇', totalWords: 2444, color: warmColors[6] },
  { id: 'programmer', name: '程序员常见词汇', category: '专业英语', description: '程序员工作中高频使用的英语单词', totalWords: 1665, color: warmColors[7] },
  { id: 'nautical', name: '航海英语', category: '专业英语', description: '基于IMO标准海事通信用语的专业航海词汇', totalWords: 80, color: warmColors[7] },
  { id: 'business', name: '商务英语', category: '专业英语', description: '基于BEC官方词汇的商务场景核心词汇', totalWords: 66, color: warmColors[0] },
  { id: 'automotive', name: '汽修英语', category: '专业英语', description: '汽车维修专业英语词汇，涵盖发动机、传动系统、底盘、制动系统、电气系统等核心词汇', totalWords: 66, color: warmColors[1] },
  { id: 'chef', name: '厨师英语', category: '专业英语', description: '烹饪与厨师专业英语词汇，涵盖厨房职位、烹饪技法、工具设备、食材调料等核心词汇', totalWords: 70, color: warmColors[2] },
  { id: 'electrician', name: '电工英语', category: '专业英语', description: '电气工程与电工专业英语词汇，涵盖基础电气概念、电气元件、电路术语、电力设备等核心词汇', totalWords: 70, color: warmColors[3] },
  { id: 'marine_engineering', name: '轮机英语', category: '专业英语', description: '船舶轮机工程专业英语词汇，涵盖主机辅机、推进系统、管系阀件、电气设备、维护保养等核心词汇', totalWords: 59, color: warmColors[4] },
  { id: 'foreign_trade', name: '外贸英语', category: '专业英语', description: '国际贸易实务专业英语词汇，涵盖贸易术语、支付方式、运输单证、海关报关、商务谈判等核心词汇', totalWords: 66, color: warmColors[5] }
].map(d => ({ ...d, totalChapters: Math.ceil(d.totalWords / CHAPTER_SIZE) }));

export const categories = ['功能词本', '中学英语', '大学英语', '英专生英语', '留学英语', '考研英语', '专业英语'];

export const getMeta = (id) => {
  if (id === 'error-book') {
    const dict = loadErrorBookAsDictionary();
    const count = getErrorBookCount();
    return {
      id: 'error-book',
      name: '错题本',
      category: '功能词本',
      description: '专属错题练习',
      totalChapters: dict.chapters?.length || 0,
      totalWords: count,
      color: 'warm-rose',
    };
  }
  if (id === 'reading-word-book') {
    const dict = loadReadingWordBookAsDictionary();
    const count = getReadingWordBookCount();
    return {
      id: 'reading-word-book',
      name: '阅读词本',
      category: '功能词本',
      description: '语境中积累的词汇',
      totalChapters: dict.chapters?.length || 0,
      totalWords: count,
      color: 'warm-violet',
    };
  }
  if (id === 'corpus-word-book') {
    const dict = loadCorpusWordBookAsDictionary();
    const count = getCorpusWordBookCount();
    return {
      id: 'corpus-word-book',
      name: '语料词本',
      category: '功能词本',
      description: '从语料字幕中积累的词汇',
      totalChapters: dict.chapters?.length || 0,
      totalWords: count,
      color: 'warm-teal',
    };
  }
  if (id === 'review') {
    const dueCount = getDueReviewCount();
    const totalCount = getTotalReviewCount();
    return {
      id: 'review',
      name: '复习计划',
      category: '功能词本',
      description: '间隔重复复习',
      totalChapters: Math.ceil(dueCount / 25) || 0,
      totalWords: dueCount,
      color: 'warm-sky',
    };
  }
  return dictionaryMeta.find((d) => d.id === id);
};
