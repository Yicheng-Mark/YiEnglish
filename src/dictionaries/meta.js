import { getErrorBookCount, loadErrorBookAsDictionary } from '../utils/errorBook.js'
import {
  getReadingWordBookCount,
  loadReadingWordBookAsDictionary,
} from '../utils/readingWordBook.js'
import { getCorpusWordBookCount, loadCorpusWordBookAsDictionary } from '../utils/corpusWordBook.js'
import { getDueReviewCount, getTotalReviewCount } from '../utils/reviewCards.js'

const warmColors = [
  'warm-coral',
  'warm-amber',
  'warm-rose',
  'warm-sage',
  'warm-sky',
  'warm-violet',
  'warm-slate',
  'warm-teal',
]

const CHAPTER_SIZE = 25

export const dictionaryMeta = [
  {
    id: 'junior',
    name: '初中英语词汇',
    category: '中学英语',
    description: '初中必学词汇，打牢基础',
    totalWords: 1757,
    color: warmColors[0],
  },
  {
    id: 'zhongkao',
    name: '中考英语核心词汇',
    category: '中学英语',
    description: '中考高频核心词，冲刺提分',
    totalWords: 700,
    color: warmColors[1],
  },
  {
    id: 'senior',
    name: '高中英语词汇',
    category: '中学英语',
    description: '高中必学词汇，稳步进阶',
    totalWords: 3449,
    color: warmColors[2],
  },
  {
    id: 'gaokao',
    name: '高考英语核心词汇',
    category: '中学英语',
    description: '高考高频核心词，冲刺必备',
    totalWords: 689,
    color: warmColors[3],
  },
  {
    id: 'cet4',
    name: '英语4级',
    category: '大学英语',
    description: '四级大纲词汇，系统备考',
    totalWords: 4533,
    color: warmColors[4],
  },
  {
    id: 'cet4freq',
    name: '英语4级高频',
    category: '大学英语',
    description: '真题高频必考词，优先突破',
    totalWords: 1488,
    color: warmColors[5],
  },
  {
    id: 'cet6',
    name: '英语6级',
    category: '大学英语',
    description: '六级大纲词汇，系统备考',
    totalWords: 8013,
    color: warmColors[6],
  },
  {
    id: 'cet6freq',
    name: '英语6级高频',
    category: '大学英语',
    description: '真题高频必考词，优先突破',
    totalWords: 1500,
    color: warmColors[7],
  },
  {
    id: 'tem4',
    name: '英语专四',
    category: '英专生英语',
    description: '专四大纲词汇，英专打底',
    totalWords: 5977,
    color: warmColors[0],
  },
  {
    id: 'tem8',
    name: '英语专八',
    category: '英专生英语',
    description: '专八大纲词汇，英专进阶',
    totalWords: 12999,
    color: warmColors[1],
  },
  {
    id: 'ielts',
    name: '雅思词汇',
    category: '留学英语',
    description: '雅思核心词汇，四科全覆盖',
    totalWords: 7999,
    color: warmColors[2],
  },
  {
    id: 'ieltsfreq',
    name: '雅思高频',
    category: '留学英语',
    description: '大纲词频双筛，高频核心',
    totalWords: 1500,
    color: warmColors[6],
  },
  {
    id: 'toefl',
    name: '托福词汇',
    category: '留学英语',
    description: '托福核心词汇，系统备考',
    totalWords: 9999,
    color: warmColors[3],
  },
  {
    id: 'toeflfreq',
    name: '托福高频',
    category: '留学英语',
    description: '大纲词频双筛，高频核心',
    totalWords: 1500,
    color: warmColors[7],
  },
  {
    id: 'sat',
    name: 'SAT 词汇',
    category: '留学英语',
    description: 'SAT 核心词汇，留学备考',
    totalWords: 4423,
    color: warmColors[4],
  },
  {
    id: 'postgraduate',
    name: '考研词汇',
    category: '考研英语',
    description: '考研大纲词汇，系统过一遍',
    totalWords: 5527,
    color: warmColors[5],
  },
  {
    id: 'postgraduateCore',
    name: '考研核心词汇',
    category: '考研英语',
    description: '200 套真题统计，高频核心',
    totalWords: 2444,
    color: warmColors[6],
  },
  {
    id: 'programmer',
    name: '程序员英语',
    category: '专业英语',
    description: '覆盖编程、算法、云计算等领域',
    totalWords: 1538,
    color: warmColors[7],
  },
  {
    id: 'nautical',
    name: '航海英语',
    category: '船员考试',
    description: '适任考试大纲，覆盖航海全主题',
    totalWords: 1565,
    color: warmColors[7],
  },
  {
    id: 'marine_engineering',
    name: '轮机英语',
    category: '专业英语',
    description: '适任考试大纲，覆盖轮机全板块',
    totalWords: 5215,
    color: warmColors[4],
  },
  {
    id: 'automotive',
    name: '汽修英语',
    category: '专业英语',
    description: '五大权威标准，汽修核心词汇',
    totalWords: 1645,
    color: warmColors[1],
  },
  {
    id: 'electrician',
    name: '电工电气工控英语',
    category: '专业英语',
    description: '电工、PLC、仪表常用词汇',
    totalWords: 936,
    color: warmColors[3],
  },
  {
    id: 'business',
    name: '商务英语',
    category: '专业英语',
    description: 'BEC 标准词汇，初高级通用',
    totalWords: 6000,
    color: warmColors[0],
  },
  {
    id: 'foreign_trade',
    name: '实用外贸商务英语',
    category: '专业英语',
    description: '外贸全流程词汇，函电到报关',
    totalWords: 4000,
    color: warmColors[5],
  },
  {
    id: 'chef',
    name: '厨师英语专业词汇',
    category: '专业英语',
    description: '食材技法设备，后厨全覆盖',
    totalWords: 1248,
    color: warmColors[2],
  },
].map((d) => ({ ...d, totalChapters: Math.ceil(d.totalWords / CHAPTER_SIZE) }))

export const categories = [
  '功能词本',
  '中学英语',
  '大学英语',
  '英专生英语',
  '留学英语',
  '考研英语',
  '船员考试',
  '专业英语',
]

export const getMeta = (id) => {
  if (id === 'error-book') {
    const dict = loadErrorBookAsDictionary()
    const count = getErrorBookCount()
    return {
      id: 'error-book',
      name: '错题本',
      category: '功能词本',
      description: '专属错题练习',
      totalChapters: dict.chapters?.length || 0,
      totalWords: count,
      color: 'warm-rose',
    }
  }
  if (id === 'reading-word-book') {
    const dict = loadReadingWordBookAsDictionary()
    const count = getReadingWordBookCount()
    return {
      id: 'reading-word-book',
      name: '阅读词本',
      category: '功能词本',
      description: '语境中积累的词汇',
      totalChapters: dict.chapters?.length || 0,
      totalWords: count,
      color: 'warm-violet',
    }
  }
  if (id === 'corpus-word-book') {
    const dict = loadCorpusWordBookAsDictionary()
    const count = getCorpusWordBookCount()
    return {
      id: 'corpus-word-book',
      name: '语料词本',
      category: '功能词本',
      description: '从语料字幕中积累的词汇',
      totalChapters: dict.chapters?.length || 0,
      totalWords: count,
      color: 'warm-teal',
    }
  }
  if (id === 'review') {
    const dueCount = getDueReviewCount()
    const totalCount = getTotalReviewCount()
    return {
      id: 'review',
      name: '复习计划',
      category: '功能词本',
      description: '间隔重复复习',
      totalChapters: Math.ceil(dueCount / 25) || 0,
      totalWords: dueCount,
      color: 'warm-sky',
    }
  }
  return dictionaryMeta.find((d) => d.id === id)
}
