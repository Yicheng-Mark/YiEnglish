const { Router } = require('express')
const pool = require('../db')
const authMiddleware = require('../middleware/auth')

const router = Router()

// GET /api/memory — get user's long-term memories
router.get('/', authMiddleware, async (req, res, next) => {
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
