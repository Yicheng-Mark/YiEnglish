// 行内元素的 getBoundingClientRect 会包含 line-height 带来的额外空间，
// getClientRects()[0] 通常更贴近实际渲染的文本边界。
export function getWordRect(target) {
  if (!target) return null
  if (typeof target.getClientRects === 'function') {
    const rects = target.getClientRects()
    if (rects && rects.length > 0) return rects[0]
  }
  return typeof target.getBoundingClientRect === 'function'
    ? target.getBoundingClientRect()
    : null
}

export const isValidWord = (str) => {
  if (!str || typeof str !== 'string') return false
  return /[a-zA-Z]/.test(str)
}

export const cleanWordForLookup = (raw) => {
  if (!raw) return ''
  return raw.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, '').toLowerCase()
}

export const tokenizeText = (text, paraIndex, onWordClick, keyPrefix = 'plain') => {
  const elements = []
  const regex = /[a-zA-Z]+(?:['-][a-zA-Z0-9]+)*/g
  let match
  let lastIndex = 0

  while ((match = regex.exec(text)) !== null) {
    const rawWord = match[0]
    const index = match.index

    if (index > lastIndex) {
      elements.push(
        <span key={`${paraIndex}-${keyPrefix}-pre-${lastIndex}`} className="non-clickable">
          {text.slice(lastIndex, index)}
        </span>
      )
    }

    const lookupWord = cleanWordForLookup(rawWord)

    if (isValidWord(lookupWord)) {
      elements.push(
        <span
          key={`${paraIndex}-${keyPrefix}-word-${index}`}
          className="word-clickable cursor-pointer hover:underline hover:opacity-80 transition-opacity"
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            onWordClick(lookupWord, getWordRect(e.target), e.target)
          }}
          title={lookupWord}
        >
          {rawWord}
        </span>
      )
    } else {
      elements.push(
        <span key={`${paraIndex}-${keyPrefix}-txt-${index}`}>{rawWord}</span>
      )
    }

    lastIndex = index + rawWord.length
  }

  if (lastIndex < text.length) {
    elements.push(
      <span key={`${paraIndex}-${keyPrefix}-post-${lastIndex}`} className="non-clickable">
        {text.slice(lastIndex)}
      </span>
    )
  }

  return elements
}
