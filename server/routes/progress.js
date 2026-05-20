const { Router } = require('express')
const pool = require('../db')
const authMiddleware = require('../middleware/auth')

const router = Router()

// GET /api/progress/:dictId - 获取用户在某个词库中每章的完成进度
router.get('/:dictId', authMiddleware, async (req, res, next) => {
  try {
    const { dictId } = req.params
    const [rows] = await pool.execute(
      'SELECT chapter_id, COUNT(*) as completed_count FROM word_progress WHERE user_id = ? AND dict_id = ? GROUP BY chapter_id',
      [req.userId, dictId]
    )
    const chapters = {}
    for (const row of rows) {
      chapters[row.chapter_id] = row.completed_count
    }
    res.json({ chapters })
  } catch (err) {
    next(err)
  }
})

// POST /api/progress - 批量保存完成的单词
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { dictId, chapterId, words } = req.body
    if (!dictId || chapterId === undefined || !Array.isArray(words) || words.length === 0) {
      return res.status(400).json({ error: '参数缺失' })
    }

    const values = words.map(w => [req.userId, dictId, chapterId, w])
    const placeholders = values.map(() => '(?, ?, ?, ?)').join(', ')
    const flat = values.flat()

    await pool.execute(
      `INSERT IGNORE INTO word_progress (user_id, dict_id, chapter_id, word_name) VALUES ${placeholders}`,
      flat
    )

    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/progress/:dictId - 重置某个词库的所有进度
router.delete('/:dictId', authMiddleware, async (req, res, next) => {
  try {
    const { dictId } = req.params
    await pool.execute(
      'DELETE FROM word_progress WHERE user_id = ? AND dict_id = ?',
      [req.userId, dictId]
    )
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

module.exports = router
