/** SHARED — Desktop + Mobile 共用，勿加平台特定逻辑 */
import { memo, useState, useCallback } from 'react'
import { getPosColor, tokenizeEnglish } from '../utils/wordColorMap.js'
import { getWordRect } from '../../../utils/wordTokenize.jsx'

// 词性着色 + 可点击查词的单词 token
function ColorizedTokenInner({ token, pos, onWordClick, showColor = true }) {
  const handleClick = useCallback(
    (e) => {
      e.stopPropagation()
      e.preventDefault()
      if (onWordClick) {
        onWordClick(token.lower, getWordRect(e.target), e.target)
      }
    },
    [token.lower, onWordClick]
  )

  const style = showColor && pos && pos !== 'unknown'
    ? { '--corpus-pos-color': getPosColor(pos), color: 'var(--corpus-pos-color)' }
    : undefined

  return (
    <span
      className="word-clickable corpus-word-pos cursor-pointer select-none"
      style={style}
      onClick={handleClick}
      title={token.lower}
    >
      {token.raw}
    </span>
  )
}

const ColorizedToken = memo(ColorizedTokenInner)
export default ColorizedToken

// Cloze 空白 token，未揭示=纯色块，揭示=彩色文本+下划线
function ClozeBlankInner({ token, pos }) {
  const [revealed, setRevealed] = useState(false)
  const style = { '--corpus-pos-color': getPosColor(pos || 'unknown') }
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation()
        setRevealed((v) => !v)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setRevealed((v) => !v)
        }
      }}
      className={`corpus-cloze-blank ${revealed ? 'is-revealed' : ''}`}
      style={style}
      title={revealed ? '点击重新隐藏' : '点击揭示答案'}
    >
      {revealed ? token.raw : ' '.repeat(Math.max(2, Math.min(token.raw.length, 12)))}
    </span>
  )
}

const ClozeBlank = memo(ClozeBlankInner)

// 给定文本 + posMap，渲染带词性颜色的可点击片段
// 可选 clozeIndices: Set<number> 表示哪些 token 索引要替换为空白
export function ColorizedText({
  text,
  paraKey = 't',
  posMap,
  onWordClick,
  showColor = true,
  clozeIndices = null,
}) {
  if (!text) return null
  const tokens = tokenizeEnglish(text)
  return (
    <>
      {tokens.map((tok, i) => {
        if (!tok.isWord) {
          return <span key={`${paraKey}-x-${i}`}>{tok.raw}</span>
        }
        const pos = posMap?.get(tok.lower) || 'unknown'
        if (clozeIndices && clozeIndices.has(i)) {
          return <ClozeBlank key={`${paraKey}-c-${i}`} token={tok} pos={pos} />
        }
        return (
          <ColorizedToken
            key={`${paraKey}-w-${i}`}
            token={tok}
            pos={pos}
            onWordClick={onWordClick}
            showColor={showColor}
          />
        )
      })}
    </>
  )
}
