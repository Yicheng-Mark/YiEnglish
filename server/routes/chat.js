const { Router } = require('express')
const pool = require('../db')
const authMiddleware = require('../middleware/auth')
const requireFullAccount = require('../middleware/requireFullAccount')
const { streamChatToRes } = require('../services/deepseekProxy')
const { buildSystemPrompt } = require('../services/promptBuilder')
const { extractMemories } = require('../services/memoryExtractor')

const router = Router()

// 所有 chat 路由都需要正式账号（体验用户禁用 AI 助手）
const guarded = [authMiddleware, requireFullAccount]

const DAILY_CHAT_LIMIT = 10

// Helper: get today's usage from independent counter table
async function getTodayUsage(pool, userId) {
  const [[row]] = await pool.execute(
    'SELECT count FROM ai_usage WHERE user_id = ? AND date = CURDATE()',
    [userId]
  )
  const used = row?.count || 0
  return { used, limit: DAILY_CHAT_LIMIT, remaining: Math.max(0, DAILY_CHAT_LIMIT - used) }
}

// Helper: increment today's usage counter
async function incrementUsage(pool, userId) {
  await pool.execute(
    'INSERT INTO ai_usage (user_id, date, count) VALUES (?, CURDATE(), 1) ON DUPLICATE KEY UPDATE count = count + 1',
    [userId]
  )
}

// GET /api/chat/usage — get daily usage
router.get('/usage', guarded, async (req, res, next) => {
  try {
    const usage = await getTodayUsage(pool, req.userId)
    res.json(usage)
  } catch (err) {
    next(err)
  }
})

// POST /api/chat — SSE streaming chat
router.post('/', guarded, async (req, res, next) => {
  try {
    const { messages, styleKey: clientStyleKey } = req.body
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: '消息不能为空' })
    }

    const userId = req.userId

    // Daily limit check
    const usage = await getTodayUsage(pool, userId)
    if (usage.used >= DAILY_CHAT_LIMIT) {
      return res.status(429).json({ error: `今日AI助手对话次数已达上限（${DAILY_CHAT_LIMIT}次），明天再来吧！`, limit: DAILY_CHAT_LIMIT, used: usage.used })
    }

    // 1. Get user's active style + style settings in one query (merged)
    const [[userRows], [styleSettingRows], [memories], [history]] = await Promise.all([
      pool.execute('SELECT nickname FROM users WHERE id = ?', [userId]),
      pool.execute(
        'SELECT style_key, gender, custom_name, custom_prompt FROM user_style_settings WHERE user_id = ?',
        [userId]
      ),
      pool.execute(
        'SELECT category, content FROM conversation_memory WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
        [userId]
      ),
      pool.execute(
        'SELECT role, content FROM chat_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
        [userId]
      ),
    ])

    let styleKey = clientStyleKey
    if (!styleKey) {
      styleKey = styleSettingRows.length > 0 ? styleSettingRows[0].style_key : 'teacher'
    }
    const userNickname = userRows.length > 0 ? userRows[0].nickname : null
    const gender = styleSettingRows.length > 0 ? styleSettingRows[0].gender : null
    const customName = styleSettingRows.length > 0 ? styleSettingRows[0].custom_name : null
    const customPrompt = styleSettingRows.length > 0 ? styleSettingRows[0].custom_prompt : null
    const recentHistory = history.reverse()

    // 5. Build system prompt
    const systemPrompt = await buildSystemPrompt(pool, { styleKey, memories, userNickname, gender, customName, customPrompt })

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

    // Increment usage counter only after successful AI response
    await incrementUsage(pool, userId)

    // 9. Save assistant message
    if (fullText) {
      await pool.execute(
        'INSERT INTO chat_messages (user_id, role, content, reasoning_content, style_key) VALUES (?, ?, ?, ?, ?)',
        [userId, 'assistant', fullText, reasoningText || null, styleKey]
      )
    }

    // 10. Extract memories from this exchange (batch insert)
    if (userMsg.role === 'user' && fullText) {
      const newMemories = extractMemories(userMsg.content, fullText)
      if (newMemories.length > 0) {
        const placeholders = newMemories.map(() => '(?, ?, ?)').join(', ')
        const params = newMemories.flatMap((mem) => [userId, mem.category, mem.content])
        await pool.execute(
          `INSERT IGNORE INTO conversation_memory (user_id, category, content) VALUES ${placeholders}`,
          params
        )
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
router.get('/history', guarded, async (req, res, next) => {
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

// POST /api/chat/clear-memory — clear all conversation memory and chat history
router.post('/clear-memory', guarded, async (req, res, next) => {
  try {
    await pool.execute('DELETE FROM conversation_memory WHERE user_id = ?', [req.userId])
    await pool.execute('DELETE FROM chat_messages WHERE user_id = ?', [req.userId])
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

module.exports = router
