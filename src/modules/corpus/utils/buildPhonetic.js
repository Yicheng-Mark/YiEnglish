import { tokenizeEnglish } from './wordColorMap.js'
import { findWordInMap } from '../../../utils/wordLookup.js'

function stripSlashes(s) {
  if (!s) return s
  return String(s).trim().replace(/^\/+|\/+$/g, '')
}

export function buildPhonetic(text, wordMap, { variant = 'us' } = {}) {
  if (!text || !wordMap) return ''
  const tokens = tokenizeEnglish(text)
  if (tokens.length === 0) return ''
  const parts = []
  for (const tok of tokens) {
    if (!tok.isWord) {
      parts.push(tok.raw)
      continue
    }
    const w = findWordInMap(tok.lower, wordMap)
    const ipa = stripSlashes(w && (variant === 'uk' ? (w.ukphone || w.uk) : (w.usphone || w.us)))
    parts.push(ipa || tok.lower)
  }
  const joined = parts.join('').replace(/\s+/g, ' ').trim()
  if (!joined) return ''
  return `/${joined}/`
}
