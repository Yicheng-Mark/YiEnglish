const { Router } = require('express')
const pool = require('../db')
const authMiddleware = require('../middleware/auth')

const router = Router()
const VALID_BOOK_TYPES = ['favorite', 'error', 'reading', 'corpus']

function validateBookType(req, res, next) {
  const { bookType } = req.params
  if (!VALID_BOOK_TYPES.includes(bookType)) {
    return res.status(400).json({ error: `无效的词本类型: ${bookType}` })
  }
  next()
}

// GET /api/wordbooks/:bookType
router.get('/:bookType', authMiddleware, validateBookType, async (req, res, next) => {
  try {
    const { bookType } = req.params
    const [rows] = await pool.execute(
      'SELECT word_name, trans, notation, usphone, ukphone, us_audio, uk_audio, wrong_count, last_wrong_at, dict_name, created_at FROM user_word_books WHERE user_id = ? AND book_type = ? ORDER BY created_at DESC',
      [req.userId, bookType]
    )
    const words = rows.map(r => {
      const w = {
        name: r.word_name,
        trans: typeof r.trans === 'string' ? JSON.parse(r.trans) : r.trans,
        notation: r.notation || '',
        usphone: r.usphone || '',
        ukphone: r.ukphone || '',
        us: r.us_audio || '',
        uk: r.uk_audio || '',
      }
      if (bookType === 'error') {
        w.wrongCount = r.wrong_count
        w.lastWrongTime = r.last_wrong_at ? new Date(r.last_wrong_at).getTime() : null
        w.dictName = r.dict_name || ''
        w.addTime = new Date(r.created_at).getTime()
      } else {
        w.addTime = new Date(r.created_at).getTime()
      }
      return w
    })
    res.json({ words })
  } catch (err) {
    next(err)
  }
})

// GET /api/wordbooks/:bookType/count
router.get('/:bookType/count', authMiddleware, validateBookType, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM user_word_books WHERE user_id = ? AND book_type = ?',
      [req.userId, req.params.bookType]
    )
    res.json({ count: rows[0].count })
  } catch (err) {
    next(err)
  }
})

// GET /api/wordbooks/:bookType/has/:wordName
router.get('/:bookType/has/:wordName', authMiddleware, validateBookType, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT 1 FROM user_word_books WHERE user_id = ? AND book_type = ? AND word_name = ? LIMIT 1',
      [req.userId, req.params.bookType, req.params.wordName]
    )
    res.json({ exists: rows.length > 0 })
  } catch (err) {
    next(err)
  }
})

// POST /api/wordbooks/:bookType — add word
router.post('/:bookType', authMiddleware, validateBookType, async (req, res, next) => {
  try {
    const { bookType } = req.params
    const { name, trans, notation, usphone, ukphone, us, uk, dictName } = req.body
    if (!name) return res.status(400).json({ error: '缺少单词名称' })

    const transJson = Array.isArray(trans) ? JSON.stringify(trans) : (trans ? JSON.stringify([trans]) : null)

    if (bookType === 'error') {
      await pool.execute(
        `INSERT INTO user_word_books (user_id, book_type, word_name, trans, notation, usphone, ukphone, us_audio, uk_audio, wrong_count, last_wrong_at, dict_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), ?)
         ON DUPLICATE KEY UPDATE
           wrong_count = wrong_count + 1,
           last_wrong_at = NOW(),
           trans = COALESCE(VALUES(trans), trans),
           notation = COALESCE(VALUES(notation), notation),
           dict_name = COALESCE(VALUES(dict_name), dict_name)`,
        [req.userId, bookType, name, transJson, notation || null, usphone || null, ukphone || null, us || null, uk || null, dictName || null]
      )
    } else {
      await pool.execute(
        `INSERT INTO user_word_books (user_id, book_type, word_name, trans, notation, usphone, ukphone, us_audio, uk_audio)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           trans = COALESCE(VALUES(trans), trans),
           notation = COALESCE(VALUES(notation), notation),
           usphone = COALESCE(VALUES(usphone), usphone),
           ukphone = COALESCE(VALUES(ukphone), ukphone),
           us_audio = COALESCE(VALUES(us_audio), us_audio),
           uk_audio = COALESCE(VALUES(uk_audio), uk_audio)`,
        [req.userId, bookType, name, transJson, notation || null, usphone || null, ukphone || null, us || null, uk || null]
      )
    }

    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/wordbooks/:bookType/:wordName
router.delete('/:bookType/:wordName', authMiddleware, validateBookType, async (req, res, next) => {
  try {
    await pool.execute(
      'DELETE FROM user_word_books WHERE user_id = ? AND book_type = ? AND word_name = ?',
      [req.userId, req.params.bookType, req.params.wordName]
    )
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/wordbooks/:bookType — clear all (query param ?clearAll=true)
router.delete('/:bookType', authMiddleware, validateBookType, async (req, res, next) => {
  try {
    if (req.query.clearAll !== 'true') {
      return res.status(400).json({ error: '需要 clearAll=true 参数' })
    }
    await pool.execute(
      'DELETE FROM user_word_books WHERE user_id = ? AND book_type = ?',
      [req.userId, req.params.bookType]
    )
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// PUT /api/wordbooks/:bookType — batch replace (for enrich sync)
router.put('/:bookType', authMiddleware, validateBookType, async (req, res, next) => {
  try {
    const { bookType } = req.params
    const { words } = req.body
    if (!Array.isArray(words)) return res.status(400).json({ error: '缺少 words 数组' })

    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      await conn.execute(
        'DELETE FROM user_word_books WHERE user_id = ? AND book_type = ?',
        [req.userId, bookType]
      )

      if (words.length > 0) {
        const values = words.map(w => {
          const transJson = Array.isArray(w.trans) ? JSON.stringify(w.trans) : (w.trans ? JSON.stringify([w.trans]) : null)
          return [
            req.userId, bookType, w.name, transJson,
            w.notation || null, w.usphone || null, w.ukphone || null,
            w.us || null, w.uk || null,
            bookType === 'error' ? (w.wrongCount || 1) : 1,
            bookType === 'error' && w.lastWrongTime ? new Date(w.lastWrongTime) : null,
            bookType === 'error' ? (w.dictName || null) : null,
          ]
        })

        const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')
        const flat = values.flat()
        await conn.execute(
          `INSERT INTO user_word_books (user_id, book_type, word_name, trans, notation, usphone, ukphone, us_audio, uk_audio, wrong_count, last_wrong_at, dict_name) VALUES ${placeholders}`,
          flat
        )
      }

      await conn.commit()
      res.json({ success: true, count: words.length })
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  } catch (err) {
    next(err)
  }
})

module.exports = router
