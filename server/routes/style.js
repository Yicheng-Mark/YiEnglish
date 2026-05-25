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

    // Get user's current style + custom_name + gender + custom_prompt
    const [userStyle] = await pool.execute(
      'SELECT style_key, custom_name, gender, custom_prompt FROM user_style_settings WHERE user_id = ?',
      [req.userId]
    )
    const currentKey = userStyle.length > 0 ? userStyle[0].style_key : 'teacher'
    const current = allStyles.find(s => s.style_key === currentKey) || allStyles[0]

    // Override name with custom_name if set
    if (current && userStyle.length > 0) {
      if (userStyle[0].custom_name) current.custom_name = userStyle[0].custom_name
      if (userStyle[0].gender) current.gender = userStyle[0].gender
      if (userStyle[0].custom_prompt) current.custom_prompt = userStyle[0].custom_prompt
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
    if (customName.trim().length > 12) {
      return res.status(400).json({ error: '名称不能超过12个字符' })
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

    await pool.execute(
      `INSERT INTO user_style_settings (user_id, style_key, gender) VALUES (?, 'teacher', ?)
       ON DUPLICATE KEY UPDATE gender = VALUES(gender)`,
      [req.userId, gender]
    )

    res.json({ gender })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/style/custom-prompt — update custom personality prompt
router.patch('/custom-prompt', authMiddleware, async (req, res, next) => {
  try {
    const { customPrompt } = req.body
    if (typeof customPrompt !== 'string') {
      return res.status(400).json({ error: 'customPrompt 必须是字符串' })
    }
    const trimmed = customPrompt.trim()
    if (trimmed.length > 500) {
      return res.status(400).json({ error: '自定义描述不能超过500个字符' })
    }

    const [userStyle] = await pool.execute(
      'SELECT style_key FROM user_style_settings WHERE user_id = ?',
      [req.userId]
    )
    if (userStyle.length === 0) {
      return res.status(400).json({ error: '请先选择一个 AI 伙伴' })
    }

    const value = trimmed.length > 0 ? trimmed : null
    await pool.execute(
      'UPDATE user_style_settings SET custom_prompt = ? WHERE user_id = ?',
      [value, req.userId]
    )

    res.json({ customPrompt: value })
  } catch (err) {
    next(err)
  }
})

// POST /api/style/reset-personality — reset custom prompt (custom style only)
router.post('/reset-personality', authMiddleware, async (req, res, next) => {
  try {
    const [userStyle] = await pool.execute(
      'SELECT style_key FROM user_style_settings WHERE user_id = ?',
      [req.userId]
    )
    if (userStyle.length === 0 || userStyle[0].style_key !== 'custom') {
      return res.status(400).json({ error: '只有自定义性格可以重置' })
    }
    await pool.execute(
      'UPDATE user_style_settings SET custom_prompt = NULL WHERE user_id = ?',
      [req.userId]
    )
    res.json({ success: true, styleKey: 'custom' })
  } catch (err) {
    next(err)
  }
})

// POST /api/style/reset — reset to default settings
router.post('/reset', authMiddleware, async (req, res, next) => {
  try {
    await pool.execute(
      `INSERT INTO user_style_settings (user_id, style_key, custom_name, gender, custom_prompt)
       VALUES (?, 'teacher', NULL, NULL, NULL)
       ON DUPLICATE KEY UPDATE style_key = 'teacher', custom_name = NULL, gender = NULL, custom_prompt = NULL`,
      [req.userId]
    )
    res.json({ styleKey: 'teacher', customName: null, gender: null, customPrompt: null })
  } catch (err) {
    next(err)
  }
})

module.exports = router
