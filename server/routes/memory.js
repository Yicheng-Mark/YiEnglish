const { Router } = require('express')
const pool = require('../db')
const authMiddleware = require('../middleware/auth')
const requireFullAccount = require('../middleware/requireFullAccount')

const router = Router()

// memory 路由需要正式账号（体验用户禁用 AI 助手）
const guarded = [authMiddleware, requireFullAccount]

// GET /api/memory — get user's long-term memories
router.get('/', guarded, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, category, content, created_at FROM conversation_memory WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.userId]
    )
    res.json({ memories: rows })
  } catch (err) {
    next(err)
  }
})

module.exports = router
