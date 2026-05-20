import { useState, useRef, useEffect, useCallback, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageCircle, X, Maximize2, Send, Square, Trash2 } from 'lucide-react'
import { createChatStream } from '../../lib/chat-engine'
import {
  PERSONAS,
  getPersona, setPersona as savePersona,
  getPosition, setPosition as savePosition,
  getMessages, setMessages as saveMessages, clearMessages as clearAllMessages,
} from '../../lib/ai-settings'
import styles from './AICircleFloat.module.css'

/* ===== Memoized ChatContent ===== */
const ChatContent = memo(function ChatContent({
  messages, currentReasoning, streaming, input, persona,
  onInputChange, onKeyDown, onSend, onStop, onPersonaChange,
  onClearHistory, onExpand, onClose, messagesEndRef,
}) {
  const personaObj = PERSONAS.find(p => p.key === persona) || PERSONAS[0]

  return (
    <>
      <div className={styles.panelHeader}>
        <div className={styles.personaTabs}>
          {PERSONAS.map(p => (
            <button
              key={p.key}
              className={`${styles.tab} ${persona === p.key ? styles.tabActive : ''}`}
              onClick={() => onPersonaChange(p.key)}
              title={p.name}
            >
              {p.avatar}
            </button>
          ))}
        </div>
        <div className={styles.headerActions}>
          <button className={styles.iconBtn} onClick={onClearHistory} title="清空记录">
            <Trash2 size={16} />
          </button>
          <button className={styles.iconBtn} onClick={onExpand} title="新页面打开">
            <Maximize2 size={16} />
          </button>
          <button className={styles.iconBtn} onClick={onClose} title="关闭">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.welcome}>
            <div className={styles.welcomeAvatar}>{personaObj.avatar}</div>
            <h3>{personaObj.name}</h3>
            <p>已就绪，开始对话吧</p>
            <div className={styles.quickActions}>
              <button onClick={() => onInputChange('帮我纠正这句英文的语法错误')}>
                📝 语法纠正
              </button>
              <button onClick={() => onInputChange('用简单的话解释这个词的意思')}>
                🔍 词汇讲解
              </button>
              <button onClick={() => onInputChange('模拟一段餐厅点餐的英语对话')}>
                🎭 场景模拟
              </button>
            </div>
          </div>
        )}
        {messages.map((msg, idx) => {
          const isStreamingEmpty = streaming
            && msg.role === 'assistant'
            && !msg.content && !msg.reasoningContent
            && idx === messages.length - 1
          if (isStreamingEmpty) return null
          return (
            <div key={idx} className={`${styles.message} ${styles[msg.role]}`}>
              <div className={styles.bubble}>
                {msg.reasoningContent && (
                  <details className={styles.thinkingBlock}>
                    <summary>💭 思考过程</summary>
                    <div className={styles.thinkingContent}>{msg.reasoningContent}</div>
                  </details>
                )}
                <div>{msg.content}</div>
              </div>
            </div>
          )
        })}
        {streaming && !currentReasoning && (
          <div className={styles.typingIndicator}><span /><span /><span /></div>
        )}
        {currentReasoning && (
          <div className={`${styles.message} ${styles.assistant}`}>
            <div className={styles.bubble}>
              <details className={styles.thinkingBlock} open>
                <summary>💭 思考中...</summary>
                <div className={styles.thinkingContent}>
                  {currentReasoning}<span className={styles.cursor}>▊</span>
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
          onChange={e => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={`和 ${personaObj.name} 对话...`}
          disabled={streaming}
        />
        {streaming ? (
          <button className={styles.sendBtn} onClick={onStop} title="停止">
            <Square size={16} />
          </button>
        ) : (
          <button className={styles.sendBtn} onClick={onSend} disabled={!input.trim()} title="发送">
            <Send size={16} />
          </button>
        )}
      </div>
    </>
  )
})

export default function AICircleFloat() {
  const navigate = useNavigate()
  const [panelOpen, setPanelOpen] = useState(false)
  const [messages, setMessages] = useState(() => getMessages())
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [persona, setPersonaState] = useState(() => getPersona())
  const [position, setPosition] = useState(() => getPosition())
  const [isNearEdge, setIsNearEdge] = useState(false)
  const [isHidden, setIsHidden] = useState(false)
  const [isDraggingState, setIsDraggingState] = useState(false)
  const [currentReasoning, setCurrentReasoning] = useState('')
  const hideTimerRef = useRef(null)

  // Refs for drag (bypass setState during drag for smooth movement)
  const positionRef = useRef(position)
  const dragRef = useRef(null)
  const containerRef = useRef(null)
  const messagesEndRef = useRef(null)
  const abortRef = useRef(null)
  const streamingRef = useRef({ content: '', reasoning: '' })

  // Keep positionRef in sync with state (for non-drag operations)
  useEffect(() => { positionRef.current = position }, [position])

  // Mutable refs for values needed in callbacks without re-creating them
  const messagesRef = useRef(messages)
  const inputRef = useRef(input)
  const streamingRef2 = useRef(streaming)
  const personaRef = useRef(persona)
  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { inputRef.current = input }, [input])
  useEffect(() => { streamingRef2.current = streaming }, [streaming])
  useEffect(() => { personaRef.current = persona }, [persona])

  // 主题监听
  const [theme, setTheme] = useState(() =>
    document.documentElement.getAttribute('data-theme') || 'light'
  )

  useEffect(() => {
    const read = () => setTheme(document.documentElement.getAttribute('data-theme') || 'light')
    const observer = new MutationObserver(read)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  // 自动滚动 — 只在 messages 变化时触发
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: streaming ? 'instant' : 'smooth' })
  }, [messages, streaming])

  // 面板定位 — 自动适配视口边界
  const panelH = 480, panelW = 360, btnSize = 52, pad = 8
  const showBelow = position.y < panelH + 12
  const showLeft = position.x > window.innerWidth / 2
  let panelPx = showLeft ? position.x + btnSize - panelW : position.x
  let panelPy = showBelow ? position.y + btnSize + 12 : position.y - panelH - 12
  panelPx = Math.max(pad, Math.min(panelPx, window.innerWidth - panelW - pad))
  panelPy = Math.max(pad, Math.min(panelPy, window.innerHeight - panelH - pad))
  const panelStyle = {
    left: panelPx - position.x,
    top: panelPy - position.y,
    right: 'auto',
    bottom: 'auto',
    transformOrigin: `${showBelow ? 'top' : 'bottom'} ${showLeft ? 'right' : 'left'}`,
  }

  // 磁吸边缘
  const snapToEdge = useCallback((x, y) => {
    const margin = 16
    const size = 52
    const maxX = window.innerWidth - size - margin
    const maxY = window.innerHeight - size - margin
    let nx = Math.max(margin, Math.min(x, maxX))
    let ny = Math.max(margin, Math.min(y, maxY))
    const nearLeft = nx < 70
    const nearRight = nx > window.innerWidth - 70 - size
    if (nearLeft) nx = margin
    if (nearRight) nx = maxX
    setIsNearEdge(nearLeft || nearRight)
    return { x: nx, y: ny }
  }, [])

  // 边缘隐藏
  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => setIsHidden(true), 2000)
  }, [])

  const cancelHide = useCallback(() => {
    clearTimeout(hideTimerRef.current)
    setIsHidden(false)
  }, [])

  useEffect(() => {
    if (!isNearEdge) {
      clearTimeout(hideTimerRef.current)
      setIsHidden(false)
    }
  }, [isNearEdge])

  useEffect(() => {
    if (!panelOpen && isNearEdge) scheduleHide()
  }, [panelOpen, isNearEdge, scheduleHide])

  useEffect(() => {
    return () => clearTimeout(hideTimerRef.current)
  }, [])

  // 拖拽 — 使用 ref + 直接 DOM 操作，避免每帧 setState
  const handlePointerDown = useCallback((e) => {
    cancelHide()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      isDragging: false,
      startX: e.clientX,
      startY: e.clientY,
      initialX: positionRef.current.x,
      initialY: positionRef.current.y,
    }
  }, [cancelHide])

  const handlePointerMove = useCallback((e) => {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    if (!dragRef.current.isDragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      dragRef.current.isDragging = true
      setIsDraggingState(true)
      setPanelOpen(false)
    }
    if (dragRef.current.isDragging) {
      const nx = dragRef.current.initialX + dx
      const ny = dragRef.current.initialY + dy
      // 直接操作 DOM，不经过 React 渲染
      positionRef.current = { x: nx, y: ny }
      if (containerRef.current) {
        containerRef.current.style.transform = `translate(${nx}px, ${ny}px)`
      }
    }
  }, [])

  const handlePointerUp = useCallback(() => {
    if (!dragRef.current) return
    const wasDrag = dragRef.current.isDragging
    dragRef.current = null
    if (wasDrag) {
      const snapped = snapToEdge(positionRef.current.x, positionRef.current.y)
      positionRef.current = snapped
      setPosition(snapped)
      savePosition(snapped)
      setIsDraggingState(false)
      const size = 52
      if (snapped.x < 70 || snapped.x > window.innerWidth - 70 - size) {
        scheduleHide()
      }
    } else {
      setPanelOpen(p => !p)
    }
  }, [snapToEdge, scheduleHide])

  const handleButtonEnter = useCallback(() => {
    clearTimeout(hideTimerRef.current)
    setIsHidden(false)
  }, [])

  const handleButtonLeave = useCallback(() => {
    if (isNearEdge && !panelOpen) {
      hideTimerRef.current = setTimeout(() => setIsHidden(true), 1500)
    }
  }, [isNearEdge, panelOpen])

  // 点击外部关闭面板
  useEffect(() => {
    if (!panelOpen) return
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setPanelOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [panelOpen])

  // 窗口缩放时重新定位
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => {
        const snapped = snapToEdge(prev.x, prev.y)
        savePosition(snapped)
        return snapped
      })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [snapToEdge])

  // 发送消息
  const handleSend = useCallback(() => {
    const text = inputRef.current.trim()
    if (!text || streamingRef2.current) return

    const userMsg = { role: 'user', content: text }
    const updated = [...messagesRef.current, userMsg]
    setMessages(updated)
    setInput('')
    setStreaming(true)
    streamingRef.current = { content: '', reasoning: '' }

    const personaObj = PERSONAS.find(p => p.key === personaRef.current) || PERSONAS[0]
    const apiMessages = [
      { role: 'system', content: personaObj.systemPrompt },
      ...updated.map(m => ({ role: m.role, content: m.content })),
    ]

    const assistantMsg = { role: 'assistant', content: '', reasoningContent: '' }
    setMessages(prev => [...prev, assistantMsg])

    let rafId = null
    let pending = false

    const flush = () => {
      pending = false
      const sr = streamingRef.current
      setCurrentReasoning(sr.reasoning)
      setMessages(prev => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last?.role === 'assistant') {
          last.content = sr.content
          last.reasoningContent = sr.reasoning
        }
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
      messages: apiMessages,
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
        const all = [...updated, final]
        setMessages(all)
        saveMessages(all)
        setStreaming(false)
        setCurrentReasoning('')
      },
      onError: (err) => {
        cancelAnimationFrame(rafId)
        const errMsg = { role: 'assistant', content: `Error: ${err.message}` }
        const all = [...updated, errMsg]
        setMessages(all)
        setStreaming(false)
        setCurrentReasoning('')
      },
    })

    abortRef.current = abort
  }, [])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    setStreaming(false)
    setCurrentReasoning('')
  }, [])

  const handlePersonaChange = useCallback((key) => {
    setPersonaState(key)
    savePersona(key)
    setMessages([])
    saveMessages([])
  }, [])

  const handleClearHistory = useCallback(() => {
    setMessages([])
    clearAllMessages()
  }, [])

  const handleClose = useCallback(() => {
    setPanelOpen(false)
  }, [])

  const handleSetInput = useCallback((val) => {
    if (typeof val === 'string') setInput(val)
  }, [])

  const handleExpand = useCallback(() => {
    saveMessages(messagesRef.current)
    setPanelOpen(false)
    navigate('/ai-assistant')
  }, [navigate])

  const hideOffset = isHidden
    ? (position.x < window.innerWidth / 2 ? -(52 - 14) : (52 - 14))
    : 0

  return (
    <div ref={containerRef}
      className={`${styles.container} ${!isDraggingState ? styles.smoothTransition : ''}`}
      style={{ transform: `translate(${position.x + hideOffset}px, ${position.y}px)` }}>

      <button
        className={`${styles.floatButton} ${isNearEdge ? styles.nearEdge : ''} ${isHidden ? styles.hidden : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerEnter={handleButtonEnter}
        onPointerLeave={handleButtonLeave}
        aria-label="AI助手"
      >
        <MessageCircle className={styles.floatIcon} />
      </button>

      {panelOpen && (
        <div className={styles.chatPanel} style={panelStyle}>
          <ChatContent
            messages={messages} currentReasoning={currentReasoning}
            streaming={streaming} input={input} persona={persona}
            onInputChange={handleSetInput}
            onKeyDown={handleKeyDown} onSend={handleSend}
            onStop={handleStop} onPersonaChange={handlePersonaChange}
            onClearHistory={handleClearHistory} onExpand={handleExpand}
            onClose={handleClose} messagesEndRef={messagesEndRef}
          />
        </div>
      )}
    </div>
  )
}
