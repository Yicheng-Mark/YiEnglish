const { Router } = require('express')
const pool = require('../db')
const authMiddleware = require('../middleware/auth')
const { VALID_THEMES } = require('../utils/themes')

const router = Router()
const CLIENT_TO_DB = {
  soundEnabled: 'sound_enabled',
  showTranslation: 'show_translation',
  showPhonetic: 'show_phonetic',
  hideEnglish: 'dictation_mode',
  wordRepeatCount: 'word_repeat_count',
  autoRemoveErrorWord: 'auto_remove_error_word',
  theme: 'theme',
}

// GET /api/settings
// 注册时已建 user_settings 行（见 auth.js /register），故正常只 SELECT。
// 老用户（注册早于该改动）可能无行 → SELECT 不到时兜底 INSERT 一次，避免 500。
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    let [rows] = await pool.execute('SELECT * FROM user_settings WHERE user_id = ?', [req.userId])

    // 历史老用户兜底：SELECT 不到才 INSERT，避免每次请求都写库
    if (rows.length === 0) {
      await pool.execute('INSERT IGNORE INTO user_settings (user_id) VALUES (?)', [req.userId])
      ;[rows] = await pool.execute('SELECT * FROM user_settings WHERE user_id = ?', [req.userId])
    }

    const row = rows[0]
    if (!row) {
      // 极端兜底：INSERT 后仍无行（理论上不该发生），返回 500 让上层排查
      return res.status(500).json({ error: '设置读取失败' })
    }

    res.json({
      soundEnabled: !!row.sound_enabled,
      showTranslation: !!row.show_translation,
      showPhonetic: !!row.show_phonetic,
      hideEnglish: !!row.dictation_mode,
      wordRepeatCount: row.word_repeat_count,
      autoRemoveErrorWord: !!row.auto_remove_error_word,
      theme: row.theme,
    })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/settings
router.patch('/', authMiddleware, async (req, res, next) => {
  try {
    const updates = req.body
    const setClauses = []
    const values = []

    for (const [clientKey, dbCol] of Object.entries(CLIENT_TO_DB)) {
      if (updates[clientKey] === undefined) continue

      let val = updates[clientKey]

      if (dbCol === 'theme') {
        if (!VALID_THEMES.includes(val)) continue
      } else if (dbCol === 'word_repeat_count') {
        val = Math.max(1, Math.min(10, Math.round(val)))
      } else {
        val = val ? 1 : 0
      }

      setClauses.push(`${dbCol} = ?`)
      values.push(val)
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: '没有有效的更新字段' })
    }

    values.push(req.userId)
    await pool.execute(
      `UPDATE user_settings SET ${setClauses.join(', ')} WHERE user_id = ?`,
      values
    )

    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

module.exports = router
