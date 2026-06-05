import { Type, Clock, FileText } from 'lucide-react'
import grammarData from '../../../data/english_grammar_system.json'

export const metadata = grammarData.metadata
export const partsOfSpeech = grammarData.partsOfSpeech
export const tenses = grammarData.tenses
export const sentenceAnalysis = grammarData.sentenceAnalysis

export const moduleConfig = [
  {
    id: 'partsOfSpeech',
    path: 'parts-of-speech',
    step: 1,
    name: '词性',
    nameEn: 'Parts of Speech',
    description: '从单词的角色出发，建立句子的最小构件认知',
    color: 'violet',
    textColor: 'text-violet-600 dark:text-violet-300',
    iconBg: 'bg-violet-100/70 dark:bg-violet-500/15',
    accentBar: 'bg-gradient-to-r from-violet-500 to-violet-400 dark:from-violet-400 dark:to-violet-300',
    hoverBorder: 'hover:border-violet-300/70 dark:hover:border-violet-400/30',
    glowFrom: 'from-violet-400/[0.12] dark:from-violet-400/[0.18]',
    Icon: Type,
    stats: [
      { value: '10', label: '大词性类别' },
      { value: '82', label: '细分子类型' },
    ],
    tags: ['名词', '动词', '形容词', '副词'],
    data: grammarData.partsOfSpeech,
  },
  {
    id: 'tenses',
    path: 'tenses',
    step: 2,
    name: '时态',
    nameEn: 'Tenses',
    description: '掌握 12 种时态在时间轴上的精确定位与切换',
    color: 'emerald',
    textColor: 'text-emerald-600 dark:text-emerald-300',
    iconBg: 'bg-emerald-100/70 dark:bg-emerald-500/15',
    accentBar: 'bg-gradient-to-r from-emerald-500 to-emerald-400 dark:from-emerald-400 dark:to-emerald-300',
    hoverBorder: 'hover:border-emerald-300/70 dark:hover:border-emerald-400/30',
    glowFrom: 'from-emerald-400/[0.12] dark:from-emerald-400/[0.18]',
    Icon: Clock,
    stats: [
      { value: '12', label: '基本时态' },
      { value: '3×4', label: '时间 × 体' },
    ],
    tags: ['现在', '过去', '将来', '完成进行'],
    data: grammarData.tenses,
  },
  {
    id: 'sentenceAnalysis',
    path: 'sentence-analysis',
    step: 3,
    name: '句子精解',
    nameEn: 'Sentence Analysis',
    description: '从成分到从句，拆解任何复杂句的结构骨架',
    color: 'amber',
    textColor: 'text-amber-600 dark:text-amber-300',
    iconBg: 'bg-amber-100/70 dark:bg-amber-500/15',
    accentBar: 'bg-gradient-to-r from-amber-500 to-amber-400 dark:from-amber-400 dark:to-amber-300',
    hoverBorder: 'hover:border-amber-300/70 dark:hover:border-amber-400/30',
    glowFrom: 'from-amber-400/[0.12] dark:from-amber-400/[0.18]',
    Icon: FileText,
    stats: [
      { value: '5', label: '核心板块' },
      { value: '4+', label: '从句类型' },
    ],
    tags: ['成分', '句型', '从句', '特殊句式'],
    data: grammarData.sentenceAnalysis,
  },
]
