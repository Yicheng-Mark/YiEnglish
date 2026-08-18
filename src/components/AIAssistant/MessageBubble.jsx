import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import styles from './AICircleFloat.module.css'

// 单条消息气泡：流式期间只有最后一条消息对象会被替换（见各处的 flush 实现），
// 历史消息引用保持稳定从而被 memo 跳过，避免 ReactMarkdown 每帧重新解析全部历史
const MessageBubble = memo(function MessageBubble({ msg }) {
  return (
    <div className={`${styles.message} ${styles[msg.role]}`}>
      <div className={styles.bubble}>
        {msg.reasoningContent && (
          <details className={styles.thinkingBlock}>
            <summary>💭 思考过程</summary>
            <div className={styles.thinkingContent}>{msg.reasoningContent}</div>
          </details>
        )}
        {msg.role === 'assistant' ? (
          <div className={styles.markdown}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
          </div>
        ) : (
          <div>{msg.content}</div>
        )}
      </div>
    </div>
  )
})

export default MessageBubble
