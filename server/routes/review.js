const { Router } = require('express')
const pool = require('../db')
const authMiddleware = require('../middleware/auth')

const router = Router()

// GET /api/review
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT word_name, dict_id, next_review, interval_days, ease_factor, repetitions, last_review_at, last_quality FROM user_review_cards WHERE user_id = ?',
      [req.userId]
    )
    const cards = {}
    for (const r of rows) {
      cards[r.word_name] = {
        wordName: r.word_name,
        dictId: r.dict_id,
        nextReview: new Date(r.next_review).getTime(),
        interval: Number(r.interval_days),
        easeFactor: Number(r.ease_factor),
        repetitions: r.repetitions,
        lastReviewAt: r.last_review_at ? new Date(r.last_review_at).getTime() : null,
        lastQuality: r.last_quality,
      }
    }
    res.json({ cards })
  } catch (err) {
    next(err)
  }
})

// POST /api/review/add
router.post('/add', authMiddleware, async (req, res, next) => {
  try {
    const { wordName, dictId } = req.body
    if (!wordName) return res.status(400).json({ error: '缺少单词名称' })

    await pool.execute(
      `INSERT INTO user_review_cards (user_id, word_name, dict_id, next_review, interval_days, ease_factor, repetitions)
       VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY), 1.00, 2.50, 0)
       ON DUPLICATE KEY UPDATE word_name = word_name`,
      [req.userId, wordName, dictId || '']
    )
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// POST /api/review/upsert
router.post('/upsert', authMiddleware, async (req, res, next) => {
  try {
    const { cards } = req.body
    if (!Array.isArray(cards) || cards.length === 0) {
      return res.status(400).json({ error: '缺少 cards 数组' })
    }

    for (const c of cards) {
      if (!c.wordName) continue
      await pool.execute(
        `INSERT INTO user_review_cards (user_id, word_name, dict_id, next_review, interval_days, ease_factor, repetitions, last_review_at, last_quality)
         VALUES (?, ?, ?, FROM_UNIXTIME(? / 1000), ?, ?, ?, FROM_UNIXTIME(? / 1000), ?)
         ON DUPLICATE KEY UPDATE
           next_review = VALUES(next_review),
           interval_days = VALUES(interval_days),
           ease_factor = VALUES(ease_factor),
           repetitions = VALUES(repetitions),
           last_review_at = VALUES(last_review_at),
           last_quality = VALUES(last_quality)`,
        [
          req.userId, c.wordName, c.dictId || '',
          c.nextReview,
          c.interval, c.easeFactor, c.repetitions,
          c.lastReviewAt, c.lastQuality,
        ]
      )
    }
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/review
router.delete('/', authMiddleware, async (req, res, next) => {
  try {
    await pool.execute('DELETE FROM user_review_cards WHERE user_id = ?', [req.userId])
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

module.exports = router
