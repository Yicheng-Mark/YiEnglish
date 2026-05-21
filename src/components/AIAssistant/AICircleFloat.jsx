import { useState, useRef, useEffect, useCallback, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, X, Maximize2, Send, Square, Trash2, MessageCircle, Mic } from 'lucide-react'
import { createChatStream } from '../../lib/chat-engine'
import {
  fetchStyles, fetchChatHistory,
  getPosition, setPosition as savePosition,
} from '../../lib/ai-settings'
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition'
import { useAuth } from '../../hooks/useAuth'
import styles from './AICircleFloat.module.css'

/* ===== Memoized ChatContent ===== */
const ChatContent = memo(function ChatContent({
  messages, currentReasoning, streaming, input, currentStyle,
  onInputChange, onKeyDown, onSend, onStop,
  onClearHistory, onExpand, onClose, messagesEndRef,
  onPanelPointerDown, onPanelPointerMove, onPanelPointerUp,
  micSupported, isListening, onMicToggle,
}) {
  const displayName = currentStyle?.custom_name || currentStyle?.name || 'AI 助手'
  return (
    <>
      <div className={styles.panelHeader}
        onPointerDown={onPanelPointerDown}
        onPointerMove={onPanelPointerMove}
        onPointerUp={onPanelPointerUp}
      >
        <div className={styles.headerTitle}>
          <Bot size={22} className={styles.headerIcon} />
          <span className={styles.headerName}>{displayName}</span>
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
            <div className={styles.welcomeAvatar}><Bot size={36} /></div>
            <h3>{displayName}</h3>
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
          placeholder={isListening ? '正在聆听...' : `和 ${displayName} 对话...`}
          disabled={streaming}
        />
        {micSupported && !streaming && (
          <button
            className={`${styles.micBtn} ${isListening ? styles.micBtnRecording : ''}`}
            onClick={onMicToggle}
            title={isListening ? '停止录音' : '语音输入'}
          >
            <Mic size={16} />
          </button>
        )}
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
  const { isAuthenticated } = useAuth()
  const [panelOpen, setPanelOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [currentStyle, setCurrentStyle] = useState(null)
  const [position, setPosition] = useState(() => getPosition())
  const [isNearEdge, setIsNearEdge] = useState(false)
  const [isHidden, setIsHidden] = useState(false)
  const [isDraggingState, setIsDraggingState] = useState(false)
  const [currentReasoning, setCurrentReasoning] = useState('')
  const hideTimerRef = useRef(null)

  // Speech recognition
  const { isSupported: micSupported, isListening, transcript, startListening, stopListening } = useSpeechRecognition()

  // Refs
  const positionRef = useRef(position)
  const dragRef = useRef(null)
  const panelDragRef = useRef(null)
  const containerRef = useRef(null)
  const messagesEndRef = useRef(null)
  const abortRef = useRef(null)
  const streamingRef = useRef({ content: '', reasoning: '' })

  const messagesRef = useRef(messages)
  const inputRef = useRef(input)
  const streamingRef2 = useRef(streaming)
  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { inputRef.current = input }, [input])
  useEffect(() => { streamingRef2.current = streaming }, [streaming])
  useEffect(() => { positionRef.current = position }, [position])

  // Load styles and chat history on mount
  useEffect(() => {
    fetchStyles().then(data => {
      setCurrentStyle(data.current)
    })
    if (isAuthenticated) {
      fetchChatHistory().then(history => {
        setMessages(history)
      })
    }
  }, [])

  // Re-fetch style when panel opens to pick up changes made elsewhere
  useEffect(() => {
    if (panelOpen) {
      fetchStyles().then(data => {
        setCurrentStyle(data.current)
      })
    }
  }, [panelOpen])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: streaming ? 'instant' : 'smooth' })
  }, [messages, streaming])

  // Panel positioning
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

  // Snap to edge
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

  // Edge hide
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

  // Drag
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

  // Panel drag — moves the entire container (button + panel together)
  const handlePanelPointerDown = useCallback((e) => {
    if (e.target.closest('button')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    cancelHide()
    panelDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: positionRef.current.x,
      initialY: positionRef.current.y,
    }
  }, [cancelHide])

  const handlePanelPointerMove = useCallback((e) => {
    if (!panelDragRef.current) return
    const dx = e.clientX - panelDragRef.current.startX
    const dy = e.clientY - panelDragRef.current.startY
    const nx = panelDragRef.current.initialX + dx
    const ny = panelDragRef.current.initialY + dy
    positionRef.current = { x: nx, y: ny }
    if (containerRef.current) {
      containerRef.current.style.transform = `translate(${nx}px, ${ny}px)`
    }
  }, [])

  const handlePanelPointerUp = useCallback(() => {
    if (!panelDragRef.current) return
    panelDragRef.current = null
    const snapped = snapToEdge(positionRef.current.x, positionRef.current.y)
    positionRef.current = snapped
    setPosition(snapped)
    savePosition(snapped)
    const size = 52
    if (snapped.x < 70 || snapped.x > window.innerWidth - 70 - size) {
      scheduleHide()
    }
  }, [snapToEdge, scheduleHide])

  // Click outside to close
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

  // Resize reposition
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

  // Send message
  const handleSend = useCallback(() => {
    const text = inputRef.current.trim()
    if (!text || streamingRef2.current) return

    const userMsg = { role: 'user', content: text }
    const updated = [...messagesRef.current, userMsg]
    setMessages(updated)
    setInput('')
    setStreaming(true)
    streamingRef.current = { content: '', reasoning: '' }

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
        const errMsg = { role: 'assistant', content: `Error: ${err.message}` }
        setMessages([...updated, errMsg])
        setStreaming(false)
        setCurrentReasoning('')
      },
    })

    abortRef.current = abort
  }, [currentStyle])

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

  const handleClearHistory = useCallback(() => {
    setMessages([])
  }, [])

  const handleClose = useCallback(() => {
    setPanelOpen(false)
  }, [])

  const handleSetInput = useCallback((val) => {
    if (typeof val === 'string') setInput(val)
  }, [])

  // Mic toggle
  const handleMicToggle = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopListening])

  // Sync transcript to input when speech recognition completes
  useEffect(() => {
    if (!isListening && transcript) {
      setInput(transcript)
    }
  }, [isListening, transcript])

  const handleExpand = useCallback(() => {
    setPanelOpen(false)
    navigate('/ai-assistant', { state: { messages: messagesRef.current } })
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
        <Bot className={styles.floatIcon} />
      </button>

      {panelOpen && (
        <div className={styles.chatPanel} style={panelStyle}>
          <ChatContent
            messages={messages} currentReasoning={currentReasoning}
            streaming={streaming} input={input}
            currentStyle={currentStyle}
            onInputChange={handleSetInput}
            onKeyDown={handleKeyDown} onSend={handleSend}
            onStop={handleStop}
            onClearHistory={handleClearHistory} onExpand={handleExpand}
            onClose={handleClose} messagesEndRef={messagesEndRef}
            onPanelPointerDown={handlePanelPointerDown}
            onPanelPointerMove={handlePanelPointerMove}
            onPanelPointerUp={handlePanelPointerUp}
            micSupported={micSupported} isListening={isListening}
            onMicToggle={handleMicToggle}
          />
        </div>
      )}
    </div>
  )
}
