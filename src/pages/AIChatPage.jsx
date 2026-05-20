import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Send, Square, Trash2 } from 'lucide-react'
import { createChatStream } from '../lib/chat-engine'
import {
  PERSONAS,
  getPersona, setPersona as savePersona,
  getMessages, setMessages as saveMessages, clearMessages as clearAllMessages,
} from '../lib/ai-settings'
import styles from '../components/AIAssistant/AICircleFloat.module.css'

export default function AIChatPage() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState(() => getMessages())
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [persona, setPersonaState] = useState(() => getPersona())
  const [currentReasoning, setCurrentReasoning] = useState('')
  const messagesEndRef = useRef(null)
  const abortRef = useRef(null)
  const streamingRef = useRef({ content: '', reasoning: '' })

  const messagesRef = useRef(messages)
  const inputRef = useRef(input)
  const streamingRef2 = useRef(streaming)
  const personaRef = useRef(persona)
  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { inputRef.current = input }, [input])
  useEffect(() => { streamingRef2.current = streaming }, [streaming])
  useEffect(() => { personaRef.current = persona }, [persona])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: streaming ? 'instant' : 'smooth' })
  }, [messages, streaming])

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

  const personaObj = PERSONAS.find(p => p.key === persona) || PERSONAS[0]

  return (
    <div className={styles.fullScreenOverlay}>
      <div className={styles.pageHeader}>
        <button className={styles.iconBtn} onClick={() => navigate(-1)} title="返回">
          <ArrowLeft size={20} />
        </button>
        <div className={styles.personaTabs}>
          {PERSONAS.map(p => (
            <button
              key={p.key}
              className={`${styles.tab} ${persona === p.key ? styles.tabActive : ''}`}
              onClick={() => handlePersonaChange(p.key)}
              title={p.name}
            >
              {p.avatar}
            </button>
          ))}
        </div>
        <button className={styles.iconBtn} onClick={handleClearHistory} title="清空记录">
          <Trash2 size={16} />
        </button>
      </div>

      <div className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.welcome}>
            <div className={styles.welcomeAvatar}>{personaObj.avatar}</div>
            <h3>{personaObj.name}</h3>
            <p>已就绪，开始对话吧</p>
            <div className={styles.quickActions}>
              <button onClick={() => setInput('帮我纠正这句英文的语法错误')}>
                📝 语法纠正
              </button>
              <button onClick={() => setInput('用简单的话解释这个词的意思')}>
                🔍 词汇讲解
              </button>
              <button onClick={() => setInput('模拟一段餐厅点餐的英语对话')}>
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
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`和 ${personaObj.name} 对话...`}
          disabled={streaming}
        />
        {streaming ? (
          <button className={styles.sendBtn} onClick={handleStop} title="停止">
            <Square size={16} />
          </button>
        ) : (
          <button className={styles.sendBtn} onClick={handleSend} disabled={!input.trim()} title="发送">
            <Send size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
