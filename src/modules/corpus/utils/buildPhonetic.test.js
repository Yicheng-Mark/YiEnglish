// buildPhonetic 测试：把句子按 token 映射成音标串（词典命中取 us/uk 音标并剥离斜杠、
// 未命中回退小写单词、词形还原经 findWordInMap、非单词 token 原样保留、整体再包一层斜杠）。
// wordMap 为 Map<word, { usphone, ukphone, us, uk }>（与语料播放器构造一致）。
import { describe, it, expect } from 'vitest'
import { buildPhonetic } from './buildPhonetic.js'

const map = new Map([
  ['hello', { usphone: '/həˈloʊ/', ukphone: '/həˈləʊ/' }],
  ['world', { us: '/wɜːld/' }],
  ['good', { uk: 'ɡʊd' }],
  ['run', { usphone: 'rʌn' }],
])

describe('入参边界', () => {
  it('text 为空 → 返回空串', () => {
    expect(buildPhonetic('', map)).toBe('')
    expect(buildPhonetic(null, map)).toBe('')
  })

  it('wordMap 为空 → 返回空串', () => {
    expect(buildPhonetic('hello', null)).toBe('')
    expect(buildPhonetic('hello', undefined)).toBe('')
  })

  it('整句无可保留内容（纯空白 trim 后为空）→ 返回空串', () => {
    expect(buildPhonetic('   ', map)).toBe('')
  })
})

describe('词典命中', () => {
  it('默认 variant=us：取 usphone，剥离词典值首尾斜杠，整体再包一层斜杠', () => {
    expect(buildPhonetic('hello', map)).toBe('/həˈloʊ/')
  })

  it('variant=uk → 取 ukphone', () => {
    expect(buildPhonetic('hello', map, { variant: 'uk' })).toBe('/həˈləʊ/')
  })

  it('无 usphone/ukphone 时回退简键 us / uk', () => {
    expect(buildPhonetic('world', map)).toBe('/wɜːld/')
    expect(buildPhonetic('good', map, { variant: 'uk' })).toBe('/ɡʊd/')
  })

  it('词典未命中 → 回退小写单词本身', () => {
    expect(buildPhonetic('Xyzzyq', map)).toBe('/xyzzyq/')
  })

  it('词形还原走 findWordInMap（running → run）', () => {
    expect(buildPhonetic('running', map)).toBe('/rʌn/')
  })
})

describe('标点与空白', () => {
  it('非单词 token（标点）原样保留，多空白合并为单空格', () => {
    expect(buildPhonetic('hello,  world!', map)).toBe('/həˈloʊ, wɜːld!/')
  })

  it('混合命中与未命中的句子', () => {
    expect(buildPhonetic('hello xyzzyq', map)).toBe('/həˈloʊ xyzzyq/')
  })
})
