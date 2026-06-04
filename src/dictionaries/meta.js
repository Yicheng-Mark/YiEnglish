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
  { id: 'programmer', name: '程序员常见词汇', category: '专业英语', description: '程序员核心专业英语词汇，覆盖编程语言、数据结构、算法、操作系统、网络协议、前后端开发、数据库、软件工程、安全、云计算、DevOps、AI/ML、大数据等领域', totalWords: 1538, color: warmColors[7] },
  { id: 'nautical', name: '航海英语', category: '船员考试', description: '海船船员适任考试（航海英语）大纲词汇，依据《中华人民共和国海船船员考试大纲（2022版）》和《海船船员培训大纲（2021版）》整理，涵盖船舶结构、操纵避碰、航海仪器、货物装卸、轮机设备、船舶通信、安全应急、气象观测、国际公约、船员职务等主题。', totalWords: 1565, color: warmColors[7] },
  { id: 'marine_engineering', name: '轮机英语', category: '专业英语', description: '轮机英语专业词汇，覆盖主推进装置、辅机系统、电气与自动化、消防与救生、船舶维修与检验、国际公约与法规、轮机管理、业务写作与通信等全部适任考试板块。参考郑高《轮机英语词汇》（国防工业出版社，2022）和李品友《轮机英语词汇手册》（人民交通出版社，2005）等权威资料编制，收录约5,200词条。', totalWords: 5215, color: warmColors[4] },
  { id: 'automotive', name: '汽修英语', category: '专业英语', description: '基于GB/T 5624-2019、SAE J1930、SAE J670、SAE J645、SAE J3016五大权威标准构建的汽车维修英语词库，涵盖发动机、传动系统、底盘、制动系统、电气系统等核心领域', totalWords: 1645, color: warmColors[1] },
  { id: 'electrician', name: '电工电气工控英语', category: '专业英语', description: '面向电工、电气维修工、自动化技术人员的专业英语词汇库，涵盖电学基础、电路元件、电机变压器、PLC控制、仪器仪表、电气安全等核心领域', totalWords: 936, color: warmColors[3] },
  { id: 'chef', name: '厨师英语专业词汇', category: '专业英语', description: '面向厨师、烘焙师、餐饮管理人员的专业英语词汇库，涵盖食材、技法、设备、管理、食品安全、营养及服务等10大类别', totalWords: 1248, color: warmColors[2] },
  { id: 'foreign_trade', name: '实用外贸商务英语', category: '专业英语', description: '基于外销员全国统一考试大纲、对外经济贸易大学880万词商务英语语料库、外贸单证员考试三大权威来源，覆盖实用外贸商务英语核心词汇，涵盖贸易术语、商务函电、单证、支付、运输、保险、报关、谈判、合同、展会、跨境电商等外贸全流程。', totalWords: 4000, color: warmColors[5] },
  { id: 'business', name: '商务英语', category: '专业英语', description: '基于剑桥商务英语BEC标准的纯商务核心词汇，覆盖初级、中级、高级', totalWords: 6000, color: warmColors[0] }
].map(d => ({ ...d, totalChapters: Math.ceil(d.totalWords / CHAPTER_SIZE) }));

export const categories = ['功能词本', '中学英语', '大学英语', '英专生英语', '留学英语', '考研英语', '船员考试', '专业英语'];

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
