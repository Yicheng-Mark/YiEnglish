const { Router } = require('express')
const pool = require('../db')
const authMiddleware = require('../middleware/auth')

const router = Router()

// 夹取可选字符串字段：null/非字符串/空串返回 null，超长截断到列宽
// （word_name/notation/us_audio/uk_audio 255、usphone/ukphone 100、dict_name 100）
function clampStr(v, max) {
  if (typeof v !== 'string' || !v) return null
  return v.slice(0, max)
}

// 无效日期返回 null（new Date(垃圾) 是 Invalid Date，mysql2 序列化会抛错）
function toValidDate(v) {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

// wrong_count SMALLINT UNSIGNED 上限 65535：非数字回退 1，越界夹取
function clampWrongCount(v) {
  return Math.min(65535, Math.max(1, Math.floor(Number(v) || 1)))
}
const VALID_BOOK_TYPES = ['favorite', 'error', 'reading', 'corpus']

function validateBookType(req, res, next) {
  const { bookType } = req.params
  if (!VALID_BOOK_TYPES.includes(bookType)) {
    return res.status(400).json({ error: `无效的词本类型: ${bookType}` })
  }
  next()
}

// trans 列存 JSON 数组字符串，但历史数据可能是普通字符串或截断的 JSON；
// 一行解析失败只降级该词的释义，不让整本词书 500
function parseTrans(trans) {
  if (typeof trans !== 'string') return trans || []
  try {
    const parsed = JSON.parse(trans)
    return Array.isArray(parsed) ? parsed : [String(trans)]
  } catch {
    return [trans]
  }
}

// GET /api/wordbooks/:bookType
router.get('/:bookType', authMiddleware, validateBookType, async (req, res, next) => {
  try {
    const { bookType } = req.params
    const [rows] = await pool.execute(
      'SELECT word_name, trans, notation, usphone, ukphone, us_audio, uk_audio, wrong_count, last_wrong_at, dict_name, created_at FROM user_word_books WHERE user_id = ? AND book_type = ? ORDER BY created_at DESC',
      [req.userId, bookType]
    )
    const words = rows.map((r) => {
      const w = {
        name: r.word_name,
        trans: parseTrans(r.trans),
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
    const { name, trans, notation, usphone, ukphone, us, uk, dictName, wrongCount, delta } =
      req.body
    // word_name VARCHAR(255)：非字符串/超长都会触发驱动层 500
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 255) {
      return res.status(400).json({ error: '无效的单词名称' })
    }

    const transJson = Array.isArray(trans)
      ? JSON.stringify(trans)
      : trans
        ? JSON.stringify([trans])
        : null
    // 客户端合批上报：wrongCount 为首次插入用的绝对值，delta 为本次新增的错误次数
    const insertCount = clampWrongCount(wrongCount)
    const deltaCount = clampWrongCount(delta)

    if (bookType === 'error') {
      await pool.execute(
        `INSERT INTO user_word_books (user_id, book_type, word_name, trans, notation, usphone, ukphone, us_audio, uk_audio, wrong_count, last_wrong_at, dict_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
         ON DUPLICATE KEY UPDATE
           wrong_count = LEAST(65535, wrong_count + ?),
           last_wrong_at = NOW(),
           trans = COALESCE(VALUES(trans), trans),
           notation = COALESCE(VALUES(notation), notation),
           dict_name = COALESCE(VALUES(dict_name), dict_name)`,
        [
          req.userId,
          bookType,
          name.trim(),
          transJson,
          clampStr(notation, 255),
          clampStr(usphone, 100),
          clampStr(ukphone, 100),
          clampStr(us, 255),
          clampStr(uk, 255),
          insertCount,
          clampStr(dictName, 100),
          deltaCount,
        ]
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
        [
          req.userId,
          bookType,
          name.trim(),
          transJson,
          clampStr(notation, 255),
          clampStr(usphone, 100),
          clampStr(ukphone, 100),
          clampStr(us, 255),
          clampStr(uk, 255),
        ]
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
    await pool.execute('DELETE FROM user_word_books WHERE user_id = ? AND book_type = ?', [
      req.userId,
      req.params.bookType,
    ])
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
    if (words.length > 2000) {
      return res.status(400).json({ error: '单次最多同步 2000 个单词' })
    }
    // 过滤缺 name/非字符串/超长条目，并按词名去重：
    // 批内重复词名会触发 uk_user_book_word 唯一键冲突，整批回滚导致同步永久失败
    const seen = new Set()
    const validWords = words.filter((w) => {
      if (!w || typeof w.name !== 'string' || !w.name.trim() || w.name.trim().length > 255)
        return false
      const key = w.name.trim()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      await conn.execute('DELETE FROM user_word_books WHERE user_id = ? AND book_type = ?', [
        req.userId,
        bookType,
      ])

      if (validWords.length > 0) {
        const values = validWords.map((w) => {
          const transJson = Array.isArray(w.trans)
            ? JSON.stringify(w.trans)
            : w.trans
              ? JSON.stringify([w.trans])
              : null
          return [
            req.userId,
            bookType,
            w.name.trim(),
            transJson,
            clampStr(w.notation, 255),
            clampStr(w.usphone, 100),
            clampStr(w.ukphone, 100),
            clampStr(w.us, 255),
            clampStr(w.uk, 255),
            bookType === 'error' ? clampWrongCount(w.wrongCount) : 1,
            bookType === 'error' ? toValidDate(w.lastWrongTime) || null : null,
            bookType === 'error' ? clampStr(w.dictName, 100) : null,
          ]
        })

        // query()（非 execute）支持 VALUES ? 嵌套数组展开：SQL 为静态字符串，全部数据走参数；
        // INSERT IGNORE 兜底并发/迁移路径已存在的行
        await conn.query(
          'INSERT IGNORE INTO user_word_books (user_id, book_type, word_name, trans, notation, usphone, ukphone, us_audio, uk_audio, wrong_count, last_wrong_at, dict_name) VALUES ?',
          [values]
        )
      }

      await conn.commit()
      res.json({ success: true, count: validWords.length })
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
