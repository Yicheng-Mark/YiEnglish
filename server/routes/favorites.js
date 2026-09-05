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
    res.json({ dicts: rows.map((r) => r.dict_id) })
  } catch (err) {
    next(err)
  }
})

// POST /api/favorites/toggle
router.post('/toggle', authMiddleware, async (req, res, next) => {
  try {
    const { dictId } = req.body
    // dict_id 列 VARCHAR(50)：truthy 对象/超长串若放行，进入查询参数会触发 500，先做类型与长度校验
    const trimmedDictId = typeof dictId === 'string' ? dictId.trim() : ''
    if (!trimmedDictId) return res.status(400).json({ error: '缺少 dictId' })
    if (trimmedDictId.length > 50) return res.status(400).json({ error: 'dictId 过长' })

    const [existing] = await pool.execute(
      'SELECT 1 FROM user_favorite_dicts WHERE user_id = ? AND dict_id = ? LIMIT 1',
      [req.userId, trimmedDictId]
    )

    if (existing.length > 0) {
      await pool.execute('DELETE FROM user_favorite_dicts WHERE user_id = ? AND dict_id = ?', [
        req.userId,
        trimmedDictId,
      ])
      res.json({ isFavorite: false })
    } else {
      await pool.execute('INSERT INTO user_favorite_dicts (user_id, dict_id) VALUES (?, ?)', [
        req.userId,
        trimmedDictId,
      ])
      res.json({ isFavorite: true })
    }
  } catch (err) {
    next(err)
  }
})

module.exports = router
