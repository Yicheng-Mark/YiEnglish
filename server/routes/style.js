const { Router } = require('express')
const pool = require('../db')
const authMiddleware = require('../middleware/auth')

const router = Router()

// GET /api/style — get current style + all available styles
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    // Get all active styles
    const [allStyles] = await pool.execute(
      'SELECT style_key, name, avatar, description FROM style_modes WHERE is_active = 1 ORDER BY sort_order'
    )

    // Get user's current style + custom_name + gender
    const [userStyle] = await pool.execute(
      'SELECT style_key, custom_name, gender FROM user_style_settings WHERE user_id = ?',
      [req.userId]
    )
    const currentKey = userStyle.length > 0 ? userStyle[0].style_key : 'teacher'
    const current = allStyles.find(s => s.style_key === currentKey) || allStyles[0]

    // Override name with custom_name if set
    if (current && userStyle.length > 0) {
      if (userStyle[0].custom_name) current.custom_name = userStyle[0].custom_name
      if (userStyle[0].gender) current.gender = userStyle[0].gender
    }

    res.json({ current, all: allStyles })
  } catch (err) {
    next(err)
  }
})

// POST /api/style — switch active style
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { styleKey, customName, gender } = req.body
    if (!styleKey) {
      return res.status(400).json({ error: 'styleKey 不能为空' })
    }

    // Validate style exists
    const [styleRows] = await pool.execute(
      'SELECT style_key, name, avatar FROM style_modes WHERE style_key = ? AND is_active = 1',
      [styleKey]
    )
    if (styleRows.length === 0) {
      return res.status(400).json({ error: '无效的风格' })
    }

    // Upsert user style (keep existing custom_name/gender unless new ones provided)
    await pool.execute(
      `INSERT INTO user_style_settings (user_id, style_key, custom_name, gender) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE style_key = VALUES(style_key), custom_name = COALESCE(VALUES(custom_name), custom_name), gender = COALESCE(VALUES(gender), gender)`,
      [req.userId, styleKey, customName || null, gender || null]
    )

    res.json({ styleKey, name: styleRows[0].name, avatar: styleRows[0].avatar })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/style/name — update custom name only
router.patch('/name', authMiddleware, async (req, res, next) => {
  try {
    const { customName } = req.body
    if (typeof customName !== 'string' || customName.trim().length === 0) {
      return res.status(400).json({ error: '名称不能为空' })
    }
    if (customName.trim().length > 50) {
      return res.status(400).json({ error: '名称不能超过50个字符' })
    }

    const [userStyle] = await pool.execute(
      'SELECT style_key FROM user_style_settings WHERE user_id = ?',
      [req.userId]
    )
    if (userStyle.length === 0) {
      return res.status(400).json({ error: '请先选择一个 AI 伙伴' })
    }

    await pool.execute(
      'UPDATE user_style_settings SET custom_name = ? WHERE user_id = ?',
      [customName.trim(), req.userId]
    )

    res.json({ customName: customName.trim() })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/style/gender — update gender only
router.patch('/gender', authMiddleware, async (req, res, next) => {
  try {
    const validGenders = ['male', 'female']
    const { gender } = req.body
    if (!gender || !validGenders.includes(gender)) {
      return res.status(400).json({ error: '性别值无效' })
    }

    const [userStyle] = await pool.execute(
      'SELECT style_key FROM user_style_settings WHERE user_id = ?',
      [req.userId]
    )
    if (userStyle.length === 0) {
      return res.status(400).json({ error: '请先选择一个 AI 伙伴' })
    }

    await pool.execute(
      'UPDATE user_style_settings SET gender = ? WHERE user_id = ?',
      [gender, req.userId]
    )

    res.json({ gender })
  } catch (err) {
    next(err)
  }
})

module.exports = router
