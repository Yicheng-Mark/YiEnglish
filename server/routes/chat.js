const { Router } = require('express')
const pool = require('../db')
const authMiddleware = require('../middleware/auth')
const { streamChatToRes } = require('../services/deepseekProxy')
const { buildSystemPrompt } = require('../services/promptBuilder')
const { extractMemories } = require('../services/memoryExtractor')

const router = Router()

// POST /api/chat — SSE streaming chat
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { messages, styleKey: clientStyleKey } = req.body
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: '消息不能为空' })
    }

    const userId = req.userId

    // 1. Get user's active style
    let styleKey = clientStyleKey
    if (!styleKey) {
      const [styleRows] = await pool.execute(
        'SELECT style_key FROM user_style_settings WHERE user_id = ?',
        [userId]
      )
      styleKey = styleRows.length > 0 ? styleRows[0].style_key : 'teacher'
    }

    // 2. Fetch user info
    const [userRows] = await pool.execute(
      'SELECT nickname FROM users WHERE id = ?',
      [userId]
    )
    const userNickname = userRows.length > 0 ? userRows[0].nickname : null

    // 2b. Fetch gender from style settings
    const [genderRows] = await pool.execute(
      'SELECT gender FROM user_style_settings WHERE user_id = ?',
      [userId]
    )
    const gender = genderRows.length > 0 ? genderRows[0].gender : null

    // 3. Fetch long-term memories
    const [memories] = await pool.execute(
      'SELECT category, content FROM conversation_memory WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
      [userId]
    )

    // 4. Fetch recent chat history for context (last 10 messages)
    const [history] = await pool.execute(
      'SELECT role, content FROM chat_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
      [userId]
    )
    const recentHistory = history.reverse()

    // 5. Build system prompt
    const systemPrompt = await buildSystemPrompt(pool, { styleKey, memories, userNickname, gender })

    // 6. Save user message
    const userMsg = messages[messages.length - 1]
    if (userMsg.role === 'user') {
      await pool.execute(
        'INSERT INTO chat_messages (user_id, role, content, style_key) VALUES (?, ?, ?, ?)',
        [userId, 'user', userMsg.content, styleKey]
      )
    }

    // 7. Compose full API messages
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...recentHistory.map(m => ({ role: m.role, content: m.content })),
      ...messages,
    ]

    // 8. Stream response
    const { fullText, reasoningText } = await streamChatToRes(apiMessages, res)

    // 9. Save assistant message
    if (fullText) {
      await pool.execute(
        'INSERT INTO chat_messages (user_id, role, content, reasoning_content, style_key) VALUES (?, ?, ?, ?, ?)',
        [userId, 'assistant', fullText, reasoningText || null, styleKey]
      )
    }

    // 10. Extract memories from this exchange
    if (userMsg.role === 'user' && fullText) {
      const newMemories = extractMemories(userMsg.content, fullText)
      for (const mem of newMemories) {
        // Check for similar existing memory to avoid duplicates
        const [existing] = await pool.execute(
          'SELECT id FROM conversation_memory WHERE user_id = ? AND category = ? AND content = ?',
          [userId, mem.category, mem.content]
        )
        if (existing.length === 0) {
          await pool.execute(
            'INSERT INTO conversation_memory (user_id, category, content) VALUES (?, ?, ?)',
            [userId, mem.category, mem.content]
          )
        }
      }
    }
  } catch (err) {
    if (!res.headersSent) {
      next(err)
    } else {
      console.error('[Chat Error after headers sent]', err.message)
    }
  }
})

// GET /api/chat/history — get recent messages
router.get('/history', authMiddleware, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100)
    const [rows] = await pool.execute(
      'SELECT role, content, reasoning_content, style_key, created_at FROM chat_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      [req.userId, limit]
    )
    res.json({ messages: rows.reverse() })
  } catch (err) {
    next(err)
  }
})

module.exports = router
