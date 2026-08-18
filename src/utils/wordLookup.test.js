// wordLookup 词形还原测试：findWordInMap 的 10 组 fallback 顺序与去双写辅音。
import { describe, it, expect } from 'vitest'
import { dedoubleConsonant, findWordInMap } from './wordLookup.js'

function makeMap(names) {
  const map = new Map()
  for (const n of names) map.set(n, { name: n })
  return map
}

describe('dedoubleConsonant', () => {
  it('词尾双写辅音去掉一个', () => {
    expect(dedoubleConsonant('runn')).toBe('run')
    expect(dedoubleConsonant('stopp')).toBe('stop')
    expect(dedoubleConsonant('bigg')).toBe('big')
  })

  it('非双写辅音 / 双元音 / 过短返回 null', () => {
    expect(dedoubleConsonant('cat')).toBeNull()
    expect(dedoubleConsonant('book')).toBeNull() // oo 是元音
    expect(dedoubleConsonant('ab')).toBeNull()
  })
})

describe('findWordInMap', () => {
  it('精确命中（大小写不敏感）优先于一切 fallback', () => {
    // lay 在不规则表里映射为 lie；词库若收录了 lay 本身，精确匹配必须赢
    const map = makeMap(['lay', 'lie'])
    expect(findWordInMap('lay', map).name).toBe('lay')
    expect(findWordInMap('LAY', map).name).toBe('lay')
  })

  it('不规则动词表还原（went → go）', () => {
    const map = makeMap(['go'])
    expect(findWordInMap('went', map).name).toBe('go')
  })

  it.each([
    ['studies', 'study'], // -ies → -y
    ['runs', 'run'], // -s
    ['boxes', 'box'], // -es
    ['carried', 'carry'], // -ied → -y
    ['played', 'play'], // -ed
    ['enabled', 'enable'], // -d（strip -ed 失败后 strip -d）
    ['stopped', 'stop'], // -ed + 去双写
    ['running', 'run'], // -ing + 去双写
    ['making', 'make'], // -ing + 补 e
    ['studying', 'study'], // -ying → -y
    ['seriously', 'serious'], // -ly
    ['happily', 'happy'], // -ily → -y
    ['bigger', 'big'], // -er + 去双写
    ['easier', 'easy'], // -ier → -y
    ['biggest', 'big'], // -est + 去双写
  ])('%s → %s', (inflected, base) => {
    const map = makeMap([base])
    expect(findWordInMap(inflected, map).name).toBe(base)
  })

  it('所有 fallback 都未命中时返回 null', () => {
    const map = makeMap(['dog'])
    expect(findWordInMap('xyzqjing', map)).toBeNull()
  })
})
