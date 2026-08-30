import { describe, it, expect } from 'vitest'
import { buildWordIndex, searchWordIndex } from './wordIndex.js'

const dicts = [
  {
    id: 'd1',
    name: '测试词库',
    chapters: [
      {
        id: 'c1',
        words: [
          { name: 'apple', usphone: '/ˈæpəl/', trans: ['n. 苹果'] },
          { name: 'banana', trans: ['n. 香蕉'] },
          { name: 'application', trans: ['n. 申请；应用'] },
          { name: 'papaya', trans: ['n. 木瓜'] },
        ],
      },
    ],
  },
]

describe('buildWordIndex', () => {
  it('非数组输入返回空数组', () => {
    expect(buildWordIndex(null)).toEqual([])
    expect(buildWordIndex('x')).toEqual([])
    expect(buildWordIndex(undefined)).toEqual([])
  })

  it('构建索引条目，含 word/phonetic/definition/searchText', () => {
    const idx = buildWordIndex(dicts)
    expect(idx).toHaveLength(4)
    const apple = idx.find((i) => i.word === 'apple')
    expect(apple.phonetic).toBe('/ˈæpəl/')
    expect(apple.definition).toBe('n. 苹果')
    expect(apple.dictId).toBe('d1')
    expect(apple.chapterId).toBe('c1')
  })

  it('searchText 清洗音标符号（/ [ ] ˈ ˌ）并小写', () => {
    const idx = buildWordIndex(dicts)
    const apple = idx.find((i) => i.word === 'apple')
    expect(apple.searchText).toBe('apple æpəl n. 苹果')
    expect(apple.searchText).not.toMatch(/[/[\]ˈˌ]/)
  })

  it('trans 非数组时 definition 为空', () => {
    const idx = buildWordIndex([
      { id: 'd', name: 'x', chapters: [{ id: 'c', words: [{ name: 'cat', trans: 'n. 猫' }] }] },
    ])
    expect(idx[0].definition).toBe('')
  })

  it('缺 name 的词被跳过', () => {
    const idx = buildWordIndex([
      {
        id: 'd',
        name: 'x',
        chapters: [{ id: 'c', words: [{ trans: ['n. 空'] }, { name: 'ok' }] }],
      },
    ])
    expect(idx).toHaveLength(1)
    expect(idx[0].word).toBe('ok')
  })
})

describe('searchWordIndex', () => {
  const idx = buildWordIndex(dicts)

  it('空查询返回空', () => {
    expect(searchWordIndex(idx, '')).toEqual([])
    expect(searchWordIndex(idx, '   ')).toEqual([])
  })

  it('完全匹配优先级最高', () => {
    const r = searchWordIndex(idx, 'apple')
    expect(r[0].word).toBe('apple')
  })

  it('两个前缀匹配时，短词优先', () => {
    // apple 与 application 都以 app 开头（前缀匹配 priority 1），短词排前
    const r = searchWordIndex(idx, 'app')
    expect(r[0].word).toBe('apple')
    expect(r[1].word).toBe('application')
  })

  it('前缀匹配整体优先于纯子串匹配', () => {
    // ap：apple/application 前缀匹配(priority 1)，papaya 仅子串匹配(priority 2)
    const r = searchWordIndex(idx, 'ap')
    const papayaPos = r.findIndex((i) => i.word === 'papaya')
    const applePos = r.findIndex((i) => i.word === 'apple')
    expect(applePos).toBeGreaterThanOrEqual(0)
    expect(papayaPos).toBeGreaterThan(applePos)
  })

  it('释义（中文）也能命中', () => {
    const r = searchWordIndex(idx, '苹果')
    expect(r.some((i) => i.word === 'apple')).toBe(true)
  })

  it('limit 截断结果数量', () => {
    expect(searchWordIndex(idx, 'a', 1)).toHaveLength(1)
    expect(searchWordIndex(idx, 'a', 2)).toHaveLength(2)
  })

  it('索引条目预计算 wordLower（搜索热路径的排序键）', () => {
    const entry = idx.find((i) => i.word === 'apple')
    expect(entry.wordLower).toBe('apple')
  })
})

describe('searchWordIndex · 四级优先级完整排序（优化后行为回归）', () => {
  const rankedDicts = [
    {
      id: 'rank',
      name: '排序词库',
      chapters: [
        {
          id: 'c1',
          words: [
            { name: 'app', trans: ['n. 应用程序'] }, // 完全匹配（priority 0）
            { name: 'apple', trans: ['n. 苹果'] }, // 前缀（1），长度 5
            { name: 'appetite', trans: ['n. 食欲'] }, // 前缀（1），长度 8
            { name: 'happy', trans: ['adj. 快乐的'] }, // 子串（2），长度 5
            { name: 'pineapple', trans: ['n. 菠萝'] }, // 子串（2），长度 9
            { name: 'zephyr', trans: ['n. 和风 app 西风'] }, // 仅释义命中（3）
          ],
        },
      ],
    },
  ]
  const rankedIdx = buildWordIndex(rankedDicts)

  it('完全 > 前缀 > 子串 > 释义；同级短词在前', () => {
    const r = searchWordIndex(rankedIdx, 'app', 10)
    expect(r.map((i) => i.word)).toEqual([
      'app',
      'apple',
      'appetite',
      'happy',
      'pineapple',
      'zephyr',
    ])
  })

  it('limit 只保留排序后的前 N 个（不是匹配序）', () => {
    const r = searchWordIndex(rankedIdx, 'app', 3)
    expect(r.map((i) => i.word)).toEqual(['app', 'apple', 'appetite'])
  })

  it('查询大小写与两端空白归一化', () => {
    const r = searchWordIndex(rankedIdx, '  APP ')
    expect(r[0].word).toBe('app')
  })
})
