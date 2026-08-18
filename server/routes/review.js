const { Router } = require('express')
const pool = require('../db')
const authMiddleware = require('../middleware/auth')

const router = Router()

// 数值列夹取：非数字回退默认值，越界夹到列宽范围内
// （interval_days DECIMAL(6,2)、ease_factor DECIMAL(4,2)、repetitions/last_quality TINYINT UNSIGNED）
function clampNum(v, fallback, min, max) {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

// 时间戳（毫秒/Date/日期串）规整为合法 Date，无效返回 null
function toValidDate(v) {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  const d = Number.isFinite(n) ? new Date(n) : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

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
    // word_name VARCHAR(255)、dict_id VARCHAR(50)：脏输入会触发驱动层 500
    if (typeof wordName !== 'string' || !wordName.trim() || wordName.trim().length > 255) {
      return res.status(400).json({ error: '无效的单词名称' })
    }

    await pool.execute(
      `INSERT IGNORE INTO user_review_cards (user_id, word_name, dict_id, next_review, interval_days, ease_factor, repetitions)
       VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY), 1.00, 2.50, 0)`,
      [req.userId, wordName.trim(), typeof dictId === 'string' ? dictId.slice(0, 50) : '']
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
    if (cards.length > 2000) {
      return res.status(400).json({ error: '单次最多同步 2000 张卡片' })
    }

    // 输入规整：缺 wordName/超长的条目跳过，数值/时间戳夹到列宽范围内，
    // 脏数据直接进 SQL 会触发驱动层 500 且整个批次失败
    const validCards = cards
      .filter(
        (c) => c && typeof c.wordName === 'string' && c.wordName.trim() && c.wordName.length <= 255
      )
      .map((c) => [
        req.userId,
        c.wordName.trim(),
        typeof c.dictId === 'string' ? c.dictId.slice(0, 50) : '',
        toValidDate(c.nextReview) || new Date(Date.now() + 86400000),
        clampNum(c.interval, 1, 0, 9999.99),
        clampNum(c.easeFactor, 2.5, 0, 99.99),
        Math.round(clampNum(c.repetitions, 0, 0, 255)),
        toValidDate(c.lastReviewAt),
        Math.round(clampNum(c.lastQuality, 0, 0, 255)),
      ])
    if (validCards.length > 0) {
      // query()（非 execute）支持 VALUES ? 嵌套数组展开：SQL 为静态字符串，全部数据走参数
      await pool.query(
        `INSERT INTO user_review_cards (user_id, word_name, dict_id, next_review, interval_days, ease_factor, repetitions, last_review_at, last_quality)
         VALUES ?
         ON DUPLICATE KEY UPDATE
           next_review = VALUES(next_review),
           interval_days = VALUES(interval_days),
           ease_factor = VALUES(ease_factor),
           repetitions = VALUES(repetitions),
           last_review_at = VALUES(last_review_at),
           last_quality = VALUES(last_quality)`,
        [validCards]
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
