const { Router } = require('express')
const pool = require('../db')
const authMiddleware = require('../middleware/auth')
const { clampStr, toValidDate, toTransJson } = require('../utils/sanitize')
const { VALID_THEMES } = require('../utils/themes')

const router = Router()

// POST /api/migrate/local-to-server — one-time localStorage → MySQL migration
router.post('/local-to-server', authMiddleware, async (req, res, next) => {
  try {
    const { favoriteWords, errorBook, readingWords, corpusWords, favoriteDicts, config, theme } =
      req.body
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
        // 缺 name 的畸形条目直接跳过；各字段长度夹到列宽内
        // （word_name/notation 255、usphone/ukphone/us_audio/uk_audio 100/255）
        const values = words
          .filter((w) => w && typeof w.name === 'string' && w.name.trim())
          .map((w) => [
            userId,
            bookType,
            w.name.trim().slice(0, 255),
            toTransJson(w.trans),
            clampStr(w.notation, 255),
            clampStr(w.usphone, 100),
            clampStr(w.ukphone, 100),
            clampStr(w.us, 255),
            clampStr(w.uk, 255),
          ])
        if (values.length === 0) continue
        // mysql2 的 query()（非 execute）支持 VALUES ? 的嵌套数组展开：
        // SQL 为静态字符串，全部数据走参数
        await conn.query(
          'INSERT IGNORE INTO user_word_books (user_id, book_type, word_name, trans, notation, usphone, ukphone, us_audio, uk_audio) VALUES ?',
          [values]
        )
      }

      // 2. Error book（条目可能是 { name } 或 { word } 形态）
      if (Array.isArray(errorBook) && errorBook.length > 0) {
        // 同上：跳过缺名字的畸形条目；wrong_count SMALLINT UNSIGNED 上限 65535 夹取
        const values = errorBook
          .filter((w) => w && typeof (w.name || w.word) === 'string' && (w.name || w.word).trim())
          .map((w) => [
            userId,
            'error',
            (w.name || w.word).trim().slice(0, 255),
            toTransJson(w.trans),
            clampStr(w.notation, 255),
            clampStr(w.usphone, 100),
            clampStr(w.ukphone, 100),
            clampStr(w.us, 255),
            clampStr(w.uk, 255),
            Math.min(65535, Math.max(1, Math.floor(Number(w.wrongCount) || 1))),
            toValidDate(w.lastWrongTime) || new Date(),
            clampStr(w.dictName, 100),
          ])
        if (values.length > 0) {
          await conn.query(
            'INSERT IGNORE INTO user_word_books (user_id, book_type, word_name, trans, notation, usphone, ukphone, us_audio, uk_audio, wrong_count, last_wrong_at, dict_name) VALUES ?',
            [values]
          )
        }
      }

      // 3. Favorite dicts
      if (Array.isArray(favoriteDicts) && favoriteDicts.length > 0) {
        // user_favorite_dicts.dict_id VARCHAR(50)：超长的 id 直接跳过
        const values = favoriteDicts
          .filter((id) => typeof id === 'string' && id.trim() && id.trim().length <= 50)
          .map((id) => [userId, id.trim()])
        if (values.length > 0) {
          await conn.query('INSERT IGNORE INTO user_favorite_dicts (user_id, dict_id) VALUES ?', [
            values,
          ])
        }
      }

      // 4. Settings（列名全部来自下方硬编码键，值走参数）
      const settingsUpdate = {}
      if (config) {
        if (config.soundEnabled !== undefined)
          settingsUpdate.sound_enabled = config.soundEnabled ? 1 : 0
        if (config.showTranslation !== undefined)
          settingsUpdate.show_translation = config.showTranslation ? 1 : 0
        if (config.showPhonetic !== undefined)
          settingsUpdate.show_phonetic = config.showPhonetic ? 1 : 0
        if (config.hideEnglish !== undefined)
          settingsUpdate.dictation_mode = config.hideEnglish ? 1 : 0
        if (config.wordRepeatCount !== undefined) {
          // 与 settings.js 相同的 1-10 夹取，非数字回退默认 1
          settingsUpdate.word_repeat_count = Math.max(
            1,
            Math.min(10, Math.round(Number(config.wordRepeatCount) || 1))
          )
        }
        if (config.autoRemoveErrorWord !== undefined)
          settingsUpdate.auto_remove_error_word = config.autoRemoveErrorWord ? 1 : 0
      }
      if (theme && VALID_THEMES.includes(theme)) {
        settingsUpdate.theme = theme
      }

      if (Object.keys(settingsUpdate).length > 0) {
        // Ensure row exists
        await conn.execute('INSERT IGNORE INTO user_settings (user_id) VALUES (?)', [userId])
        await conn.query('UPDATE user_settings SET ? WHERE user_id = ?', [settingsUpdate, userId])
      }

      await conn.commit()
      res.json({ success: true })
    } catch (err) {
      await conn.rollback().catch(() => {})
      throw err
    } finally {
      conn.release()
    }
  } catch (err) {
    next(err)
  }
})

module.exports = router
