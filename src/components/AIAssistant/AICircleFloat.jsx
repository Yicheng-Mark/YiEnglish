import { useState, useRef, useEffect, useCallback, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bot,
  X,
  Maximize2,
  Send,
  Square,
  Trash2,
  BookOpen,
  MessageSquareText,
  GitCompare,
  Lightbulb,
} from 'lucide-react'
import { createChatStream } from '../../lib/chat-engine'
import {
  fetchStyles,
  fetchChatHistory,
  fetchChatUsage,
  deriveUsageUI,
  getPosition,
  setPosition as savePosition,
  clearMemory,
} from '../../lib/ai-settings'
import { useWordContext } from '../../contexts/WordContext'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import styles from './AICircleFloat.module.css'

/* ===== Quick action prompt builder ===== */
function buildQuickActionPrompt(actionType, word) {
  const w = word
  const phonetic = w.usphone || w.us || w.ukphone || w.uk || ''
  const trans = Array.isArray(w.trans) ? w.trans.join('；') : w.trans || ''
  const phrases = (w.phrases || [])
    .slice(0, 3)
    .map((p) => `${p.en} — ${p.cn}`)
    .join('\n')
  const prompts = {
    explain: `请详细解释单词 "${w.name}"：\n音标：/${phonetic}/\n释义：${trans}\n${phrases ? '常见搭配：\n' + phrases : ''}\n\n请从词根词缀、用法场景、同义词等方面进行全面解析。`,
    examples: `请为单词 "${w.name}"（${trans}）造3个实用例句，涵盖不同难度和场景。每个例句附上中文翻译和语法要点。`,
    compare: `请辨析单词 "${w.name}"（${trans}）和它容易混淆的近义词，说明它们在含义、用法、搭配上的区别，并各给一个例句。`,
    memory: `请为单词 "${w.name}"（${trans}，音标 /${phonetic}/）提供巧妙的记忆方法，包括词根词缀分析、联想记忆或谐音记忆等技巧。`,
  }
  return prompts[actionType] || prompts.explain
}

const QUICK_ACTIONS = [
  { key: 'explain', label: '解释单词', Icon: BookOpen },
  { key: 'examples', label: '例句与用法', Icon: MessageSquareText },
  { key: 'compare', label: '易混词辨析', Icon: GitCompare },
  { key: 'memory', label: '记忆技巧', Icon: Lightbulb },
]

/* ===== Memoized ChatContent ===== */
const ChatContent = memo(function ChatContent({
  messages,
  currentReasoning,
  streaming,
  input,
  currentStyle,
  usage,
  onInputChange,
  onKeyDown,
  onSend,
  onStop,
  onClearHistory,
  onExpand,
  onClose,
  messagesEndRef,
  onPanelPointerDown,
  onPanelPointerMove,
  onPanelPointerUp,
  currentWord,
  onQuickAction,
  onRetryUsage,
}) {
  const displayName = currentStyle?.custom_name || currentStyle?.name || 'AI 助手'
  const usageUI = deriveUsageUI(usage, displayName)
  return (
    <>
      <div
        className={styles.panelHeader}
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
            <div className={styles.welcomeAvatar}>
              <Bot size={36} />
            </div>
            <h3>{displayName}</h3>
            {currentWord && !streaming && (
              <div className={styles.quickActions}>
                {QUICK_ACTIONS.map(({ key, label, Icon }) => (
                  <button key={key} onClick={() => onQuickAction(key)}>
                    <Icon size={14} style={{ marginRight: 6, flexShrink: 0 }} />
                    {label}
                  </button>
                ))}
              </div>
            )}
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
          return (
            <div key={idx} className={`${styles.message} ${styles[msg.role]}`}>
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
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={usageUI.placeholder}
          disabled={streaming || usageUI.inputDisabled}
        />
        {streaming ? (
          <button className={styles.sendBtn} onClick={onStop} title="停止">
            <Square size={16} />
          </button>
        ) : (
          <button
            className={styles.sendBtn}
            onClick={onSend}
            disabled={!input.trim() || usageUI.sendDisabled}
            title="发送"
          >
            <Send size={16} />
          </button>
        )}
        <span
          className={styles.usageHint}
          style={usageUI.retryable ? { cursor: 'pointer' } : undefined}
          onClick={usageUI.retryable ? onRetryUsage : undefined}
        >
          {usageUI.hint}
        </span>
      </div>
    </>
  )
})

export default function AICircleFloat() {
  const navigate = useNavigate()
  const { currentWord } = useWordContext()
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
  const [usage, setUsage] = useState({ status: 'loading' })
  const hideTimerRef = useRef(null)
  const prevWordRef = useRef(null)
  const chatGenRef = useRef(0)

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
    positionRef.current = position
  }, [position])

  // Load styles and chat history on mount
  useEffect(() => {
    fetchStyles().then((data) => {
      setCurrentStyle(data.current)
    })
    fetchChatHistory().then((history) => {
      setMessages(history)
    })
    fetchChatUsage().then(setUsage)
  }, [])

  // Re-fetch style when panel opens to pick up changes made elsewhere
  useEffect(() => {
    if (panelOpen) {
      fetchStyles().then((data) => {
        setCurrentStyle(data.current)
      })
      fetchChatUsage().then(setUsage)
    }
  }, [panelOpen])

  // 当单词切换时，清空 AI 上下文
  useEffect(() => {
    if (!currentWord?.name) return
    if (prevWordRef.current === null) {
      prevWordRef.current = currentWord.name
      return
    }
    if (currentWord.name !== prevWordRef.current) {
      prevWordRef.current = currentWord.name
      chatGenRef.current++
      abortRef.current?.()
      abortRef.current = null
      setStreaming(false)
      setCurrentReasoning('')
      streamingRef.current = { content: '', reasoning: '' }
      setMessages([])
      clearMemory().catch(() => {})
    }
  }, [currentWord?.name])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: streaming ? 'instant' : 'smooth' })
  }, [messages, streaming])

  // Panel positioning
  const panelH = 480,
    panelW = 360,
    btnSize = 52,
    pad = 8
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

  // 挂载时把持久化的位置钳制回当前视口内
  // （旧会话保存的坐标可能已超出现在的窗口尺寸，导致悬浮球渲染在屏幕外"消失"）
  useEffect(() => {
    const snapped = snapToEdge(positionRef.current.x, positionRef.current.y)
    positionRef.current = snapped
    setPosition(snapped)
    savePosition(snapped)
  }, [snapToEdge])

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
  const handlePointerDown = useCallback(
    (e) => {
      cancelHide()
      e.currentTarget.setPointerCapture(e.pointerId)
      dragRef.current = {
        isDragging: false,
        startX: e.clientX,
        startY: e.clientY,
        initialX: positionRef.current.x,
        initialY: positionRef.current.y,
      }
    },
    [cancelHide]
  )

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
      setPanelOpen((p) => !p)
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
  const handlePanelPointerDown = useCallback(
    (e) => {
      if (e.target.closest('button')) return
      e.currentTarget.setPointerCapture(e.pointerId)
      cancelHide()
      panelDragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        initialX: positionRef.current.x,
        initialY: positionRef.current.y,
      }
    },
    [cancelHide]
  )

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
      setPosition((prev) => {
        const snapped = snapToEdge(prev.x, prev.y)
        savePosition(snapped)
        return snapped
      })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [snapToEdge])

  // Send text to AI
  const sendText = useCallback(
    (text) => {
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

      const gen = chatGenRef.current
      const userMsg = { role: 'user', content: text }
      const updated = [...messagesRef.current, userMsg]
      setMessages(updated)
      setStreaming(true)
      streamingRef.current = { content: '', reasoning: '' }

      const assistantMsg = { role: 'assistant', content: '', reasoningContent: '' }
      setMessages((prev) => [...prev, assistantMsg])

      let rafId = null
      let pending = false

      const flush = () => {
        if (chatGenRef.current !== gen) return
        pending = false
        const sr = streamingRef.current
        setCurrentReasoning(sr.reasoning)
        setMessages((prev) => {
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
          if (chatGenRef.current !== gen) return
          streamingRef.current.content += token
          scheduleFlush()
        },
        onReasoning: (token) => {
          if (chatGenRef.current !== gen) return
          streamingRef.current.reasoning += token
          scheduleFlush()
        },
        onDone: () => {
          if (chatGenRef.current !== gen) return
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
          if (chatGenRef.current !== gen) return
          cancelAnimationFrame(rafId)
          const errMsg = { role: 'assistant', content: `Error: ${err.message}` }
          setMessages([...updated, errMsg])
          setStreaming(false)
          setCurrentReasoning('')
          if (err.isRateLimit) fetchChatUsage().then(setUsage)
        },
      })

      abortRef.current = abort
    },
    [currentStyle]
  )

  const handleSend = useCallback(() => {
    const text = inputRef.current.trim()
    if (!text) return
    setInput('')
    sendText(text)
  }, [sendText])

  const handleQuickAction = useCallback(
    (actionType) => {
      if (!currentWord) return
      sendText(buildQuickActionPrompt(actionType, currentWord))
    },
    [sendText, currentWord]
  )

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

  // usage 加载失败时，浮窗提示上的「点击重试」回调
  const handleRetryUsage = useCallback(() => {
    fetchChatUsage().then(setUsage)
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

  const handleExpand = useCallback(() => {
    setPanelOpen(false)
    navigate('/ai-assistant', { state: { messages: messagesRef.current } })
  }, [navigate])

  const hideOffset = isHidden ? (position.x < window.innerWidth / 2 ? -(52 - 14) : 52 - 14) : 0

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${!isDraggingState ? styles.smoothTransition : ''}`}
      style={{ transform: `translate(${position.x + hideOffset}px, ${position.y}px)` }}
    >
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
      {currentWord && !panelOpen && !isHidden && (
        <div className={styles.wordBadge}>{currentWord.name}</div>
      )}

      {panelOpen && (
        <div className={styles.chatPanel} style={panelStyle}>
          <ChatContent
            messages={messages}
            currentReasoning={currentReasoning}
            streaming={streaming}
            input={input}
            currentStyle={currentStyle}
            usage={usage}
            onRetryUsage={handleRetryUsage}
            onInputChange={handleSetInput}
            onKeyDown={handleKeyDown}
            onSend={handleSend}
            onStop={handleStop}
            onClearHistory={handleClearHistory}
            onExpand={handleExpand}
            onClose={handleClose}
            messagesEndRef={messagesEndRef}
            onPanelPointerDown={handlePanelPointerDown}
            onPanelPointerMove={handlePanelPointerMove}
            onPanelPointerUp={handlePanelPointerUp}
            currentWord={currentWord}
            onQuickAction={handleQuickAction}
          />
        </div>
      )}
    </div>
  )
}
