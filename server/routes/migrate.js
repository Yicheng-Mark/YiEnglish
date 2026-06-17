const { Router } = require('express')
const pool = require('../db')
const authMiddleware = require('../middleware/auth')

const router = Router()

// POST /api/migrate/local-to-server — one-time localStorage → MySQL migration
router.post('/local-to-server', authMiddleware, async (req, res, next) => {
  try {
    const { favoriteWords, errorBook, readingWords, corpusWords, favoriteDicts, config, theme } = req.body
    const userId = req.userId
    const conn = await pool.getConnection()

    try {
      await conn.beginTransaction()

      // 1. Word books (favorite, reading, corpus)
      for (const [bookType, words] of [
        ['favorite', favoriteWords],
        ['reading', readingWords],
        ['corpus', corpusWords],
      ]) {
        if (!Array.isArray(words) || words.length === 0) continue
        const values = words.map(w => {
          const transJson = Array.isArray(w.trans) ? JSON.stringify(w.trans) : null
          return [userId, bookType, w.name, transJson, w.notation || null, w.usphone || null, w.ukphone || null, w.us || null, w.uk || null]
        })
        const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')
        await conn.execute(
          `INSERT IGNORE INTO user_word_books (user_id, book_type, word_name, trans, notation, usphone, ukphone, us_audio, uk_audio) VALUES ${placeholders}`,
          values.flat()
        )
      }

      // 2. Error book
      if (Array.isArray(errorBook) && errorBook.length > 0) {
        const values = errorBook.map(w => {
          const transJson = Array.isArray(w.trans) ? JSON.stringify(w.trans) : null
          const wrongCount = w.wrongCount || 1
          const lastWrongAt = w.lastWrongTime ? new Date(w.lastWrongTime) : new Date()
          return [userId, 'error', w.name || w.word, transJson, w.notation || null, w.usphone || null, w.ukphone || null, w.us || null, w.uk || null, wrongCount, lastWrongAt, w.dictName || null]
        })
        const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')
        await conn.execute(
          `INSERT IGNORE INTO user_word_books (user_id, book_type, word_name, trans, notation, usphone, ukphone, us_audio, uk_audio, wrong_count, last_wrong_at, dict_name) VALUES ${placeholders}`,
          values.flat()
        )
      }

      // 3. Favorite dicts
      if (Array.isArray(favoriteDicts) && favoriteDicts.length > 0) {
        const values = favoriteDicts.map(dictId => [userId, dictId])
        const placeholders = values.map(() => '(?, ?)').join(', ')
        await conn.execute(
          `INSERT IGNORE INTO user_favorite_dicts (user_id, dict_id) VALUES ${placeholders}`,
          values.flat()
        )
      }

      // 4. Settings
      const settingParts = []
      const settingValues = []
      if (config) {
        if (config.soundEnabled !== undefined) { settingParts.push('sound_enabled = ?'); settingValues.push(config.soundEnabled ? 1 : 0) }
        if (config.showTranslation !== undefined) { settingParts.push('show_translation = ?'); settingValues.push(config.showTranslation ? 1 : 0) }
        if (config.showPhonetic !== undefined) { settingParts.push('show_phonetic = ?'); settingValues.push(config.showPhonetic ? 1 : 0) }
        if (config.hideEnglish !== undefined) { settingParts.push('dictation_mode = ?'); settingValues.push(config.hideEnglish ? 1 : 0) }
        if (config.wordRepeatCount !== undefined) { settingParts.push('word_repeat_count = ?'); settingValues.push(config.wordRepeatCount) }
        if (config.autoRemoveErrorWord !== undefined) { settingParts.push('auto_remove_error_word = ?'); settingValues.push(config.autoRemoveErrorWord ? 1 : 0) }
      }
      if (theme) { settingParts.push('theme = ?'); settingValues.push(theme) }

      if (settingParts.length > 0) {
        // Ensure row exists
        await conn.execute('INSERT IGNORE INTO user_settings (user_id) VALUES (?)', [userId])
        settingValues.push(userId)
        await conn.execute(
          `UPDATE user_settings SET ${settingParts.join(', ')} WHERE user_id = ?`,
          settingValues
        )
      }

      await conn.commit()
      res.json({ success: true })
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
