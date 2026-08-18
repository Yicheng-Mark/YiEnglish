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

    // 输入校验：脏元素直接进 SQL 会触发驱动层报错（500），
    // 超大数组可拼出巨型批量 INSERT，都必须在入口拦下
    // 上限与列宽对齐：word_progress.dict_id VARCHAR(50)，超过会触发 ER_DATA_TOO_LONG
    if (typeof dictId !== 'string' || !dictId.trim() || dictId.trim().length > 50) {
      return res.status(400).json({ error: '无效的词库标识' })
    }
    const dictIdTrimmed = dictId.trim()
    const chapterNum = Number(chapterId)
    if (!Number.isInteger(chapterNum) || chapterNum < 0 || chapterNum > 10000) {
      return res.status(400).json({ error: '无效的章节标识' })
    }
    if (words.length > 500) {
      return res.status(400).json({ error: '单次最多提交 500 个单词' })
    }
    const wordNames = []
    for (const w of words) {
      if (typeof w !== 'string' || !w.trim() || w.length > 100) {
        return res.status(400).json({ error: '单词列表包含非法元素' })
      }
      wordNames.push(w.trim())
    }

    const values = wordNames.map((name) => [req.userId, dictIdTrimmed, chapterNum, name])

    // 用 query() 而非 execute()：mysql2 的 query 支持 VALUES ? 的嵌套数组展开，
    // SQL 是静态字符串，全部用户输入走参数，单次往返完成批量写入
    await pool.query(
      'INSERT IGNORE INTO word_progress (user_id, dict_id, chapter_id, word_name) VALUES ?',
      [values]
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
    await pool.execute('DELETE FROM word_progress WHERE user_id = ? AND dict_id = ?', [
      req.userId,
      dictId,
    ])
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

module.exports = router
