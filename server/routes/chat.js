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

// Helper: 原子占用一次当日额度（防并发竞态）
// 检查与计数之间的流式窗口长达数十秒，check-then-increment 会被并发绕过；
// ODKU + IF 条件把"检查+自增"压进单条语句：affectedRows=0 表示行已存在且 count 已达上限
async function reserveUsage(pool, userId) {
  const [result] = await pool.execute(
    `INSERT INTO ai_usage (user_id, date, count) VALUES (?, CURDATE(), 1)
     ON DUPLICATE KEY UPDATE count = IF(count < ?, count + 1, count)`,
    [userId, DAILY_CHAT_LIMIT]
  )
  return result.affectedRows > 0
}

// Helper: 上游失败时退还占用的额度
async function refundUsage(pool, userId) {
  await pool.execute(
    'UPDATE ai_usage SET count = GREATEST(0, count - 1) WHERE user_id = ? AND date = CURDATE()',
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

    // 客户端消息白名单化：只接受 user/assistant 角色与字符串内容，
    // 防止恶意客户端注入 role:'system' 覆盖系统提示词；超长内容截断
    const MAX_MSG_LEN = 8000
    const safeMessages = messages
      .filter((m) => m && typeof m.content === 'string' && m.content.trim())
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content.length > MAX_MSG_LEN ? m.content.slice(0, MAX_MSG_LEN) : m.content,
      }))
      // 条数上限：1MB body 可塞上百条伪历史全量发给 DeepSeek，只保留最近 20 条
      .slice(-20)
    if (safeMessages.length === 0) {
      return res.status(400).json({ error: '消息不能为空' })
    }

    const userId = req.userId

    // Daily limit: 先原子占位、失败再退款（见 reserveUsage 注释）
    const reserved = await reserveUsage(pool, userId)
    if (!reserved) {
      const usage = await getTodayUsage(pool, userId)
      return res.status(429).json({
        error: `今日AI助手对话次数已达上限（${DAILY_CHAT_LIMIT}次），明天再来吧！`,
        limit: DAILY_CHAT_LIMIT,
        used: usage.used,
      })
    }

    // 1. Get user's active style + style settings in one query (merged)
    const [[userRows], [styleSettingRows], [memories], [history], [styleRows]] = await Promise.all([
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
      // 白名单校验客户端 styleKey（chat_messages.style_key VARCHAR(30) + style_modes 外键约束，
      // 非法 key 会触发驱动层 500 或污染数据；无效回退用户已存人设或默认 teacher，与 style.js POST 同标）
      typeof clientStyleKey === 'string' &&
      clientStyleKey.trim() &&
      clientStyleKey.trim().length <= 30
        ? pool.execute('SELECT style_key FROM style_modes WHERE style_key = ? AND is_active = 1', [
            clientStyleKey.trim(),
          ])
        : Promise.resolve([[]]),
    ])

    let styleKey =
      typeof clientStyleKey === 'string' &&
      clientStyleKey.trim() &&
      clientStyleKey.trim().length <= 30 &&
      styleRows.length > 0
        ? styleRows[0].style_key
        : null
    if (!styleKey) {
      styleKey = styleSettingRows.length > 0 ? styleSettingRows[0].style_key : 'teacher'
    }
    const userNickname = userRows.length > 0 ? userRows[0].nickname : null
    const gender = styleSettingRows.length > 0 ? styleSettingRows[0].gender : null
    const customName = styleSettingRows.length > 0 ? styleSettingRows[0].custom_name : null
    const customPrompt = styleSettingRows.length > 0 ? styleSettingRows[0].custom_prompt : null
    const recentHistory = history.reverse()

    // 5. Build system prompt
    const systemPrompt = await buildSystemPrompt(pool, {
      styleKey,
      memories,
      userNickname,
      gender,
      customName,
      customPrompt,
    })

    // 6. Save user message
    const userMsg = safeMessages[safeMessages.length - 1]
    if (userMsg.role === 'user') {
      await pool.execute(
        'INSERT INTO chat_messages (user_id, role, content, style_key) VALUES (?, ?, ?, ?)',
        [userId, 'user', userMsg.content, styleKey]
      )
    }

    // 7. Compose full API messages
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...recentHistory.map((m) => ({ role: m.role, content: m.content })),
      ...safeMessages,
    ]

    // 8. Stream response
    const { fullText, reasoningText, failed } = await streamChatToRes(apiMessages, res)

    // 额度已在入口原子占位；上游失败/流中断时退还（failed=true 不能空烧用户的每日额度）
    if (failed) {
      await refundUsage(pool, userId)
    }

    // 9. Save assistant message
    if (fullText) {
      await pool.execute(
        'INSERT INTO chat_messages (user_id, role, content, reasoning_content, style_key) VALUES (?, ?, ?, ?, ?)',
        [userId, 'assistant', fullText, reasoningText || null, styleKey]
      )
    }

    // 10. Extract memories from this exchange (usually 0-2 entries, insert one by one)
    if (userMsg.role === 'user' && fullText) {
      const newMemories = extractMemories(userMsg.content, fullText)
      for (const mem of newMemories) {
        await pool.execute(
          'INSERT IGNORE INTO conversation_memory (user_id, category, content) VALUES (?, ?, ?)',
          [userId, mem.category, mem.content]
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
    // 夹取到 [1, 100]：parseInt 对负数/0/NaN 的结果直接进 SQL 会触发语法错误（500）
    const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 50, 100))
    // 用 pool.query 而非 execute：MySQL 8 预编译语句不支持 LIMIT ? 占位符（ER_WRONG_ARGUMENTS）
    const [rows] = await pool.query(
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
