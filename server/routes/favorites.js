const { Router } = require('express')
const pool = require('../db')
const authMiddleware = require('../middleware/auth')

const router = Router()

// GET /api/favorites
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT dict_id FROM user_favorite_dicts WHERE user_id = ? ORDER BY created_at',
      [req.userId]
    )
    res.json({ dicts: rows.map(r => r.dict_id) })
  } catch (err) {
    next(err)
  }
})

// POST /api/favorites/toggle
router.post('/toggle', authMiddleware, async (req, res, next) => {
  try {
    const { dictId } = req.body
    if (!dictId) return res.status(400).json({ error: '缺少 dictId' })

    const [existing] = await pool.execute(
      'SELECT 1 FROM user_favorite_dicts WHERE user_id = ? AND dict_id = ? LIMIT 1',
      [req.userId, dictId]
    )

    if (existing.length > 0) {
      await pool.execute(
        'DELETE FROM user_favorite_dicts WHERE user_id = ? AND dict_id = ?',
        [req.userId, dictId]
      )
      res.json({ isFavorite: false })
    } else {
      await pool.execute(
        'INSERT INTO user_favorite_dicts (user_id, dict_id) VALUES (?, ?)',
        [req.userId, dictId]
      )
      res.json({ isFavorite: true })
    }
  } catch (err) {
    next(err)
  }
})

module.exports = router
