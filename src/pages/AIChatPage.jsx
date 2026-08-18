import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Send, Square, Trash2, Bot } from 'lucide-react'
import { createChatStream } from '../lib/chat-engine'
import { fetchStyles, fetchChatHistory, fetchChatUsage, deriveUsageUI } from '../lib/ai-settings'
import MessageBubble from '../components/AIAssistant/MessageBubble'
import styles from '../components/AIAssistant/AICircleFloat.module.css'

export default function AIChatPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const passedMessages = location.state?.messages
  const [messages, setMessages] = useState(() =>
    Array.isArray(passedMessages) ? passedMessages : []
  )
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [currentStyle, setCurrentStyle] = useState(null)
  const [currentReasoning, setCurrentReasoning] = useState('')
  const [usage, setUsage] = useState({ status: 'loading' })
  const messagesEndRef = useRef(null)
  const abortRef = useRef(null)
  const streamingRef = useRef({ content: '', reasoning: '' })

  const messagesRef = useRef(messages)
  const inputRef = useRef(input)
  const streamingRef2 = useRef(streaming)
  const usageRef = useRef(usage)
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])
  useEffect(() => {
    inputRef.current = input
  }, [input])
  useEffect(() => {
    streamingRef2.current = streaming
  }, [streaming])
  useEffect(() => {
    usageRef.current = usage
  }, [usage])

  useEffect(() => {
    fetchStyles()
      .then((data) => {
        setCurrentStyle(data.current)
      })
      .catch(() => {})
    fetchChatUsage()
      .then(setUsage)
      .catch(() => setUsage({ status: 'error' }))
    if (passedMessages === undefined) {
      fetchChatHistory()
        .then((history) => {
          // 历史晚到时本地可能已有用户刚发出的消息：整体覆盖会踩掉进行中的对话
          // （含流式输出），此时跳过——服务端历史下次进入页面再加载
          if (messagesRef.current.length === 0) setMessages(history)
        })
        .catch(() => {})
    }
  }, [])

  // 卸载时中止进行中的流：离开页面后不再消耗网络与服务端用量
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: streaming ? 'instant' : 'smooth' })
  }, [messages, streaming])

  const displayName = currentStyle?.custom_name || currentStyle?.name || 'AI 助手'
  const usageUI = deriveUsageUI(usage, displayName)

  const handleSend = useCallback(() => {
    const text = inputRef.current.trim()
    if (!text || streamingRef2.current) return
    if (usageRef.current.status === 'ok' && usageRef.current.remaining <= 0) return

    // Optimistic decrement — update ref immediately to prevent race conditions
    // 仅在已成功加载用量（ok）时乐观自减；loading/error/forbidden 不动用量
    if (usageRef.current.status === 'ok') {
      usageRef.current = {
        ...usageRef.current,
        used: usageRef.current.used + 1,
        remaining: Math.max(0, usageRef.current.remaining - 1),
      }
      setUsage({ ...usageRef.current })
    }

    const userMsg = { role: 'user', content: text }
    const updated = [...messagesRef.current, userMsg]
    setMessages(updated)
    setInput('')
    setStreaming(true)
    streamingRef.current = { content: '', reasoning: '' }

    const assistantMsg = { role: 'assistant', content: '', reasoningContent: '' }
    setMessages((prev) => [...prev, assistantMsg])

    let rafId = null
    let pending = false

    const flush = () => {
      pending = false
      const sr = streamingRef.current
      setCurrentReasoning(sr.reasoning)
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last?.role !== 'assistant') return prev
        // 用新对象替换最后一条（而非原地改写），让 MessageBubble 的 memo
        // 只对正在流式输出的这一条重渲染
        const next = prev.slice(0, -1)
        next.push({ ...last, content: sr.content, reasoningContent: sr.reasoning })
        return next
      })
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
    }

    const scheduleFlush = () => {
      if (!pending) {
        pending = true
        rafId = requestAnimationFrame(flush)
      }
    }

    const { abort } = createChatStream({
      messages: [{ role: 'user', content: text }],
      styleKey: currentStyle?.style_key,
      onToken: (token) => {
        streamingRef.current.content += token
        scheduleFlush()
      },
      onReasoning: (token) => {
        streamingRef.current.reasoning += token
        scheduleFlush()
      },
      onDone: () => {
        cancelAnimationFrame(rafId)
        const final = {
          role: 'assistant',
          content: streamingRef.current.content,
          reasoningContent: streamingRef.current.reasoning,
        }
        setMessages([...updated, final])
        setStreaming(false)
        setCurrentReasoning('')
      },
      onError: (err) => {
        cancelAnimationFrame(rafId)
        const msg =
          err instanceof TypeError ? '网络连接失败，请检查网络后重试' : err.message || '请求失败'
        const errMsg = { role: 'assistant', content: msg }
        setMessages([...updated, errMsg])
        setStreaming(false)
        setCurrentReasoning('')
        if (err.isRateLimit) fetchChatUsage().then(setUsage)
      },
    })

    abortRef.current = abort
  }, [currentStyle])

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    setStreaming(false)
    setCurrentReasoning('')
  }, [])

  const handleClearHistory = useCallback(() => {
    setMessages([])
  }, [])

  return (
    <div className={styles.fullScreenOverlay}>
      <div className={styles.pageHeader}>
        <button className={styles.iconBtn} onClick={() => navigate(-1)} title="返回">
          <ArrowLeft size={20} />
        </button>
        <div className={styles.headerTitle}>
          <Bot size={22} className={styles.headerIcon} />
          <span className={styles.headerName}>{displayName}</span>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.iconBtn} onClick={handleClearHistory} title="清空记录">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.welcome}>
            <div className={styles.welcomeAvatar}>
              <Bot size={36} />
            </div>
            <h3>{displayName}</h3>
          </div>
        )}
        {messages.map((msg, idx) => {
          const isStreamingEmpty =
            streaming &&
            msg.role === 'assistant' &&
            !msg.content &&
            !msg.reasoningContent &&
            idx === messages.length - 1
          if (isStreamingEmpty) return null
          return <MessageBubble key={idx} msg={msg} />
        })}
        {streaming && !currentReasoning && (
          <div className={styles.typingIndicator}>
            <span />
            <span />
            <span />
          </div>
        )}
        {currentReasoning && (
          <div className={`${styles.message} ${styles.assistant}`}>
            <div className={styles.bubble}>
              <details className={styles.thinkingBlock} open>
                <summary>💭 思考中...</summary>
                <div className={styles.thinkingContent}>
                  {currentReasoning}
                  <span className={styles.cursor}>▊</span>
                </div>
              </details>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className={styles.inputArea}>
        <input
          className={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={usageUI.placeholder}
          disabled={streaming || usageUI.inputDisabled}
        />
        {streaming ? (
          <button className={styles.sendBtn} onClick={handleStop} title="停止">
            <Square size={16} />
          </button>
        ) : (
          <button
            className={styles.sendBtn}
            onClick={handleSend}
            disabled={!input.trim() || usageUI.sendDisabled}
            title="发送"
          >
            <Send size={16} />
          </button>
        )}
        <span
          className={styles.usageHint}
          style={usageUI.retryable ? { cursor: 'pointer' } : undefined}
          onClick={usageUI.retryable ? () => fetchChatUsage().then(setUsage) : undefined}
        >
          {usageUI.hint}
        </span>
      </div>
    </div>
  )
}
