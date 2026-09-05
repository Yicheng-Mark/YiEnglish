const express = require('express')
const bcrypt = require('bcryptjs')
const pool = require('../db')
const config = require('../config')
const authMiddleware = require('../middleware/auth')
const {
  checkLoginRateLimit,
  checkRegisterRateLimit,
  logAttempt,
} = require('../middleware/rateLimit')
const {
  issueTokens,
  clearCookies,
  hashToken,
  getClientIp,
  parseDeviceName,
  resolveDeviceId,
  ensureDeviceCookie,
  validateUsername,
  validatePassword,
  REFRESH_COOKIE,
} = require('../utils/tokens')
const { createRateLimiter } = require('../utils/apiRateLimit')

const router = express.Router()

// users.avatar_url 是 TEXT。个人中心会把头像裁成 200x200 JPEG data URL，通常约数万字节；
// 旧的 500 字符限制会让所有真实头像静默同步失败。给 TEXT 上限留出余量，并仅接受
// canvas 生成的 JPEG data URL 或 HTTPS URL，避免把任意 data/SVG/script scheme 存进资料。
const MAX_AVATAR_BYTES = 60000
const MAX_AVATAR_URL_LENGTH = 2048

function normalizeAvatar(value) {
  if (value === null) return { value: null }
  if (typeof value !== 'string') return { error: '头像格式无效' }

  if (/^https:\/\//i.test(value)) {
    return value.length <= MAX_AVATAR_URL_LENGTH ? { value } : { error: '头像地址过长' }
  }

  if (Buffer.byteLength(value, 'utf8') > MAX_AVATAR_BYTES) {
    return { error: '头像数据过大' }
  }
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(value)
  if (!match || match[1].length % 4 !== 0) return { error: '头像格式无效' }

  const bytes = Buffer.from(match[1], 'base64')
  const isJpeg =
    bytes.length >= 4 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[bytes.length - 2] === 0xff &&
    bytes[bytes.length - 1] === 0xd9
  return isJpeg ? { value } : { error: '头像格式无效' }
}

function toClientUser(user) {
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    avatar: user.avatar_url ?? null,
    dailyGoalMinutes: user.daily_goal_minutes ?? 30,
    signature: user.signature ?? null,
  }
}

// --- Validate activation code ---
// 激活码可直接兑换注册资格，需防在线爆破（checkRegisterRateLimit 只在注册段生效，拦不住此端点）
const activationCodeLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: '尝试次数过多，请稍后再试',
})
// refresh/logout/change-password 无专用限流：refresh 可未认证刷 DB、change-password 可刷
// bcrypt CPU。三者共用一个低阈值 IP 限流（30 次/分/IP）；login/register/recover 的
// 专用限流（checkLoginRateLimit / checkRegisterRateLimit）保持不变。
const authActionLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
})

router.post('/validate-activation-code', activationCodeLimiter, async (req, res, next) => {
  try {
    const { code } = req.body
    if (!code || typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({ valid: false, message: '请输入激活码' })
    }

    const [codes] = await pool.execute(
      `SELECT id, code, max_uses, current_uses, is_active, expires_at
       FROM experience_codes WHERE code = ? AND type = 'activation'`,
      [code.trim()]
    )
    if (codes.length === 0) {
      return res.json({ valid: false, message: '激活码无效' })
    }
    const actCode = codes[0]
    if (!actCode.is_active) {
      return res.json({ valid: false, message: '激活码已失效' })
    }
    if (actCode.expires_at && new Date(actCode.expires_at) < new Date()) {
      return res.json({ valid: false, message: '激活码已过期' })
    }
    if (actCode.max_uses > 0 && actCode.current_uses >= actCode.max_uses) {
      return res.json({ valid: false, message: '激活码已达使用上限' })
    }

    res.json({ valid: true })
  } catch (err) {
    next(err)
  }
})

// --- Register ---
router.post('/register', async (req, res, next) => {
  try {
    const { username, password, nickname, activationCode } = req.body
    const ip = getClientIp(req)

    if (!activationCode || typeof activationCode !== 'string' || !activationCode.trim()) {
      return res.status(400).json({ error: '请输入激活码' })
    }
    if (!validateUsername(username)) {
      return res.status(400).json({ error: '用户名需 3-30 位，支持字母、数字、下划线、中文' })
    }
    if (!validatePassword(password)) {
      return res.status(400).json({ error: '密码需 8-128 位，至少包含一个字母和一个数字' })
    }

    // 限流前移到激活码查询之前：code 探测本身就要被拦（checkRegisterRateLimit 只在注册段生效）
    await checkRegisterRateLimit(ip)

    // 验证激活码：失败按 code 维度计数，防止在线爆破有效码
    const registerCodeKey = 'register-code:' + activationCode.trim()
    const [codes] = await pool.execute(
      `SELECT id, code, max_uses, current_uses, is_active, expires_at
       FROM experience_codes WHERE code = ? AND type = 'activation'`,
      [activationCode.trim()]
    )
    if (codes.length === 0) {
      await logAttempt(registerCodeKey, ip, false)
      return res.status(400).json({ error: '激活码无效' })
    }
    const actCode = codes[0]
    if (!actCode.is_active) {
      await logAttempt(registerCodeKey, ip, false)
      return res.status(400).json({ error: '激活码已失效' })
    }
    if (actCode.expires_at && new Date(actCode.expires_at) < new Date()) {
      await logAttempt(registerCodeKey, ip, false)
      return res.status(400).json({ error: '激活码已过期' })
    }
    if (actCode.max_uses > 0 && actCode.current_uses >= actCode.max_uses) {
      await logAttempt(registerCodeKey, ip, false)
      return res.status(400).json({ error: '激活码已达使用上限' })
    }

    const [existing] = await pool.execute('SELECT id FROM users WHERE username = ?', [username])
    if (existing.length > 0) {
      return res.status(400).json({ error: '注册失败，请稍后重试' })
    }

    const hash = await bcrypt.hash(password, config.BCRYPT_ROUNDS)
    const displayName =
      typeof nickname === 'string' && nickname.trim() ? nickname.trim().slice(0, 50) : username

    // INSERT 用户 → 原子消费激活码 → 记录来源：整段包事务，保证一致性。
    // 并发同用户名时 INSERT 抛 ER_DUP_ENTRY 由下方 catch 捕获返回 400，不再 500。
    const conn = await pool.getConnection()
    let userId
    try {
      await conn.beginTransaction()

      const [result] = await conn.execute(
        'INSERT INTO users (username, nickname, password_hash, email) VALUES (?, ?, ?, NULL)',
        [username, displayName, hash]
      )
      userId = result.insertId

      // 原子消费激活码（防竞态）
      const [updateResult] = await conn.execute(
        'UPDATE experience_codes SET current_uses = current_uses + 1 WHERE id = ? AND (max_uses = 0 OR current_uses < max_uses)',
        [actCode.id]
      )
      if (updateResult.affectedRows === 0) {
        // 码在并发下被耗尽 → 整事务回滚（含刚创建的用户行）
        await conn.rollback()
        return res.status(400).json({ error: '激活码已达使用上限' })
      }

      // 记录激活码来源
      await conn.execute('UPDATE users SET activation_code_id = ? WHERE id = ?', [
        actCode.id,
        userId,
      ])

      // 注册即建默认 settings 行，后续 GET /api/settings 可省去每次 INSERT IGNORE
      await conn.execute('INSERT INTO user_settings (user_id) VALUES (?)', [userId])

      await conn.commit()
    } catch (err) {
      await conn.rollback().catch(() => {})
      // 并发同用户名：预检都通过、INSERT 触发唯一约束冲突 → 400 而非 500
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: '注册失败，请稍后重试' })
      }
      throw err
    } finally {
      conn.release()
    }

    await issueTokens(res, userId, false, {
      deviceId: ensureDeviceCookie(req, res, resolveDeviceId(req)),
      deviceName: parseDeviceName(req.headers['user-agent']),
      ip,
    })
    await logAttempt(`register:${ip}`, ip, true)

    res.json({
      user: toClientUser({ id: userId, username, nickname: displayName }),
    })
  } catch (err) {
    next(err)
  }
})

// --- Login ---
const DUMMY_HASH = '$2a$12$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body
    const ip = getClientIp(req)

    // username/password 必须是非空字符串：truthy 对象（如 {}）若放行，会原样进入
    // DB 查询参数 / bcrypt.compare → 500。此处只挡类型/空值，不做格式校验
    //（用户名不存在与密码错误统一 401 文案，避免枚举）。
    if (
      typeof username !== 'string' ||
      !username.trim() ||
      typeof password !== 'string' ||
      !password
    ) {
      return res.status(400).json({ error: '请输入用户名和密码' })
    }

    await checkLoginRateLimit(username, ip)

    const [rows] = await pool.execute(
      'SELECT id, username, nickname, password_hash, avatar_url, daily_goal_minutes, signature FROM users WHERE username = ?',
      [username]
    )

    const user = rows[0]
    const hashToCompare = user ? user.password_hash : DUMMY_HASH
    const match = await bcrypt.compare(password, hashToCompare)

    if (!user || !match) {
      await logAttempt(username, ip, false)
      return res.status(401).json({ error: '用户名或密码错误' })
    }

    await logAttempt(username, ip, true)

    // 设备级会话名额：统计本设备以外的活跃设备，达上限则拒绝第 N+1 台登录。
    // ensureDeviceCookie：无设备 cookie 的"干净登录"先下发再复用同一 deviceId，
    // 否则每次登录生成新随机 id 写入 refresh_tokens，会误占设备名额导致锁号
    const deviceId = ensureDeviceCookie(req, res, resolveDeviceId(req))
    const device = { deviceId, deviceName: parseDeviceName(req.headers['user-agent']), ip }

    const [[{ cnt }]] = await pool.execute(
      `SELECT COUNT(*) AS cnt FROM refresh_tokens
       WHERE user_id = ? AND device_id <> '' AND device_id <> ? AND expires_at > NOW()`,
      [user.id, deviceId]
    )
    if (cnt >= config.MAX_DEVICES_PER_USER) {
      return res.status(403).json({
        error: `该账号已在 ${config.MAX_DEVICES_PER_USER} 台设备登录，请到已登录设备的「设置-登录设备管理」中退出一台后再试`,
        code: 'DEVICE_LIMIT_REACHED',
      })
    }

    // 替换本设备旧行：同一设备重复登录不占新名额
    await pool.execute('DELETE FROM refresh_tokens WHERE user_id = ? AND device_id = ?', [
      user.id,
      deviceId,
    ])

    await issueTokens(res, user.id, false, device)

    res.json({
      user: toClientUser(user),
    })
  } catch (err) {
    next(err)
  }
})

// --- Refresh ---
router.post('/refresh', authActionLimiter, async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE]
    if (!refreshToken) {
      return res.status(401).json({ error: '请先登录' })
    }

    const tokenHash = hashToken(refreshToken)

    const [rows] = await pool.execute(
      'SELECT id, user_id, device_id, device_name, ip FROM refresh_tokens WHERE token_hash = ? AND expires_at > NOW()',
      [tokenHash]
    )

    if (rows.length === 0) {
      clearCookies(res)
      return res.status(401).json({ error: '请先登录' })
    }

    const stored = rows[0]

    // rotation：原子抢占删除。旧实现"先 SELECT 再按 id DELETE"存在窗口期，并发携带同一
    // cookie 时可双双通过 SELECT、各自删行成功，签发两套并行会话。
    // 改为单条带过期守卫的 DELETE 作为唯一认领手段：affectedRows=0 说明该 token 已被
    // 并发请求认领或已过期 → 拒绝（401）。上方 SELECT 仅用于读取签发新 token 所需元数据。
    const [claimed] = await pool.execute(
      'DELETE FROM refresh_tokens WHERE token_hash = ? AND expires_at > NOW()',
      [tokenHash]
    )
    if (claimed.affectedRows === 0) {
      clearCookies(res)
      return res.status(401).json({ error: '请先登录' })
    }

    const [userRows] = await pool.execute(
      'SELECT id, username, nickname, avatar_url, daily_goal_minutes, signature, is_guest FROM users WHERE id = ?',
      [stored.user_id]
    )

    if (userRows.length === 0) {
      clearCookies(res)
      return res.status(401).json({ error: '请先登录' })
    }

    const isGuest = !!userRows[0].is_guest

    // 体验用户：试用到期则拒绝刷新，防止页面加载的会话检查绕过强制下线
    let trialExpiresAt = null
    if (isGuest) {
      const [trialRows] = await pool.execute(
        'SELECT expires_at FROM trial_activations WHERE user_id = ?',
        [stored.user_id]
      )
      trialExpiresAt = trialRows[0]?.expires_at || null
      if (!trialExpiresAt || new Date(trialExpiresAt) <= new Date()) {
        clearCookies(res)
        return res.status(401).json({ error: '体验时间已结束', code: 'TRIAL_EXPIRED' })
      }
    }

    // rotation 时沿用原会话的设备标识/IP，刷新 last_active_at
    await issueTokens(
      res,
      stored.user_id,
      isGuest,
      {
        deviceId: stored.device_id,
        deviceName: stored.device_name,
        ip: stored.ip,
      },
      isGuest && trialExpiresAt ? new Date(trialExpiresAt).toISOString() : null
    )

    const userObj = toClientUser(userRows[0])
    if (isGuest) {
      userObj.isTrial = true
      userObj.trialExpiresAt = trialExpiresAt ? new Date(trialExpiresAt).toISOString() : null
    }

    res.json({ user: userObj })
  } catch (err) {
    next(err)
  }
})

// --- Logout ---
router.post('/logout', authActionLimiter, async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE]
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken)
      await pool
        .execute('DELETE FROM refresh_tokens WHERE token_hash = ?', [tokenHash])
        .catch(() => {})
    }
    clearCookies(res)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// --- Me (requires auth) ---
// 正式用户（is_guest=0）跳过 trial_activations JOIN，避免每请求无谓 JOIN。
// 访客（is_guest=1）才查试用状态。字段结构保持兼容：非访客不带 isTrial/trialExpiresAt（与原行为一致）。
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    // 先只查 users（无 JOIN），拿到 is_guest 后再决定是否补充查 trial
    const [rows] = await pool.execute(
      `SELECT id, username, nickname, avatar_url, daily_goal_minutes, signature, is_guest
       FROM users
       WHERE id = ?`,
      [req.userId]
    )
    if (rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' })
    }
    const u = rows[0]
    const userObj = toClientUser(u)
    // 仅访客额外查一次试用到期（单列查询，比每请求 LEFT JOIN 全表更省）
    if (u.is_guest) {
      const [trialRows] = await pool.execute(
        'SELECT expires_at FROM trial_activations WHERE user_id = ? LIMIT 1',
        [req.userId]
      )
      const trialExpiresAt = trialRows[0]?.expires_at || null
      userObj.isTrial = true
      userObj.trialExpiresAt = trialExpiresAt ? new Date(trialExpiresAt).toISOString() : null
    }
    res.json({ user: userObj })
  } catch (err) {
    next(err)
  }
})

// --- Update profile (requires auth) ---
router.patch('/profile', authMiddleware, async (req, res, next) => {
  try {
    const { nickname, signature, dailyGoalMinutes, avatarUrl } = req.body
    const sets = []
    const values = []

    if (nickname !== undefined) {
      const trimmed = String(nickname).trim()
      if (trimmed.length < 1 || trimmed.length > 50) {
        return res.status(400).json({ error: '昵称需 1-50 个字符' })
      }
      sets.push('nickname = ?')
      values.push(trimmed)
    }
    if (avatarUrl !== undefined) {
      const avatar = normalizeAvatar(avatarUrl)
      if (avatar.error) return res.status(400).json({ error: avatar.error })
      sets.push('avatar_url = ?')
      values.push(avatar.value)
    }
    if (signature !== undefined) {
      const sig = String(signature)
      if (sig.length > 200) {
        return res.status(400).json({ error: '签名不能超过 200 个字符' })
      }
      sets.push('signature = ?')
      values.push(sig)
    }
    if (dailyGoalMinutes !== undefined) {
      const n = Number(dailyGoalMinutes)
      if (!Number.isInteger(n) || n < 5 || n > 300) {
        return res.status(400).json({ error: '每日目标需在 5-300 分钟之间' })
      }
      sets.push('daily_goal_minutes = ?')
      values.push(n)
    }

    if (sets.length === 0) {
      return res.status(400).json({ error: '没有需要更新的字段' })
    }

    values.push(req.userId)
    await pool.execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, values)

    const [rows] = await pool.execute(
      'SELECT id, username, nickname, avatar_url, daily_goal_minutes, signature FROM users WHERE id = ?',
      [req.userId]
    )
    const u = rows[0]
    res.json({
      user: toClientUser(u),
    })
  } catch (err) {
    next(err)
  }
})

// --- Change password (requires auth) ---
router.post('/change-password', authActionLimiter, authMiddleware, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: '请输入当前密码和新密码' })
    }
    if (!validatePassword(newPassword)) {
      return res.status(400).json({ error: '新密码需 8-128 位，至少包含一个字母和一个数字' })
    }

    const [rows] = await pool.execute('SELECT password_hash FROM users WHERE id = ?', [req.userId])
    if (rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' })
    }

    const match = await bcrypt.compare(currentPassword, rows[0].password_hash)
    if (!match) {
      return res.status(400).json({ error: '当前密码错误' })
    }

    const hash = await bcrypt.hash(newPassword, config.BCRYPT_ROUNDS)
    await pool.execute(
      'UPDATE users SET password_hash = ?, password_changed_at = NOW() WHERE id = ?',
      [hash, req.userId]
    )

    // force re-login on all devices
    await pool.execute('DELETE FROM refresh_tokens WHERE user_id = ?', [req.userId])

    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// --- 找回密码：凭注册链接查找关联账号（只读，不修改）---
router.post('/recover-lookup', async (req, res, next) => {
  try {
    const { code } = req.body
    const ip = getClientIp(req)

    if (!code || typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({ error: '请输入激活码' })
    }

    const codeKey = 'recover:' + code.trim()
    await checkLoginRateLimit(codeKey, ip)

    // 通过 activation_code_id 反查注册账号；不校验 is_active/expires_at/uses，
    // 这些只管"新注册"，已注册账号的找回权利不随码失效而消失
    const [rows] = await pool.execute(
      `SELECT u.id, u.username FROM users u
       JOIN experience_codes ec ON u.activation_code_id = ec.id
       WHERE ec.code = ? AND ec.type = 'activation'`,
      [code.trim()]
    )

    if (rows.length === 0) {
      await logAttempt(codeKey, ip, false)
      return res.status(404).json({ error: '未找到关联账号' })
    }
    if (rows.length > 1) {
      // 一码一账号不变量下不应发生；防御性返回
      return res.status(409).json({ error: '该链接关联多个账号，请联系客服' })
    }

    await logAttempt(codeKey, ip, true)
    res.json({ found: true, username: rows[0].username })
  } catch (err) {
    next(err)
  }
})

// --- 找回密码：重置用户名与密码，并自动登录 ---
router.post('/recover-reset', async (req, res, next) => {
  try {
    const { code, username, password } = req.body
    const ip = getClientIp(req)

    if (!code || typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({ error: '请输入激活码' })
    }
    if (!validateUsername(username)) {
      return res.status(400).json({ error: '用户名需 3-30 位，支持字母、数字、下划线、中文' })
    }
    if (!validatePassword(password)) {
      return res.status(400).json({ error: '密码需 8-128 位，至少包含一个字母和一个数字' })
    }

    await checkRegisterRateLimit(ip)

    // 与 recover-lookup 同款限流：code 维度 + IP 维度，失败必须计数，
    // 否则可无限爆破激活码（一个有效码即可重置关联账号的用户名密码）
    const codeKey = 'recover:' + code.trim()
    await checkLoginRateLimit(codeKey, ip)

    const [rows] = await pool.execute(
      `SELECT u.id, u.username FROM users u
       JOIN experience_codes ec ON u.activation_code_id = ec.id
       WHERE ec.code = ? AND ec.type = 'activation'`,
      [code.trim()]
    )
    if (rows.length === 0) {
      await logAttempt(codeKey, ip, false)
      return res.status(404).json({ error: '未找到关联账号' })
    }
    if (rows.length > 1) {
      return res.status(409).json({ error: '该链接关联多个账号，请联系客服' })
    }
    const userId = rows[0].id

    // 唯一性预检（排除自身）
    const [existing] = await pool.execute('SELECT id FROM users WHERE username = ? AND id != ?', [
      username,
      userId,
    ])
    if (existing.length > 0) {
      return res.status(409).json({ error: '用户名已被占用' })
    }

    const hash = await bcrypt.hash(password, config.BCRYPT_ROUNDS)

    try {
      await pool.execute(
        'UPDATE users SET username = ?, password_hash = ?, password_changed_at = NOW() WHERE id = ?',
        [username, hash, userId]
      )
    } catch (err) {
      // 唯一索引兜底，防 TOCTOU
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: '用户名已被占用' })
      }
      throw err
    }

    // 踢掉其他设备的登录态
    await pool.execute('DELETE FROM refresh_tokens WHERE user_id = ?', [userId])

    await issueTokens(res, userId, false, {
      deviceId: ensureDeviceCookie(req, res, resolveDeviceId(req)),
      deviceName: parseDeviceName(req.headers['user-agent']),
      ip,
    })
    await logAttempt(codeKey, ip, true)

    const [updated] = await pool.execute(
      'SELECT id, username, nickname, avatar_url, daily_goal_minutes, signature FROM users WHERE id = ?',
      [userId]
    )
    res.json({ user: toClientUser(updated[0]) })
  } catch (err) {
    next(err)
  }
})

// --- 设备管理：列出当前账号的登录设备（requires auth）---
router.get('/devices', authMiddleware, async (req, res, next) => {
  try {
    const deviceId = typeof req.query.deviceId === 'string' ? req.query.deviceId.trim() : ''
    const [rows] = await pool.execute(
      `SELECT id, device_name, ip, last_active_at,
              (device_id = ?) AS is_current
       FROM refresh_tokens
       WHERE user_id = ? AND device_id <> '' AND expires_at > NOW()
       ORDER BY last_active_at DESC`,
      [deviceId, req.userId]
    )
    res.json({
      devices: rows.map((r) => ({
        id: r.id,
        name: r.device_name || '未知设备',
        ip: r.ip,
        lastActiveAt: r.last_active_at ? new Date(r.last_active_at).toISOString() : null,
        isCurrent: !!r.is_current,
      })),
    })
  } catch (err) {
    next(err)
  }
})

// --- 设备管理：退出指定设备（requires auth）---
// 删除该设备的刷新令牌行，名额立即释放；被踢设备的访问令牌最长 3 天后随过期失效
router.delete('/devices/:id', authMiddleware, async (req, res, next) => {
  try {
    const sessionId = Number(req.params.id)
    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      return res.status(400).json({ error: '无效的设备会话' })
    }
    const [result] = await pool.execute('DELETE FROM refresh_tokens WHERE id = ? AND user_id = ?', [
      sessionId,
      req.userId,
    ])
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '设备会话不存在或已退出' })
    }
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

module.exports = router
