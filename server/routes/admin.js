// 管理后台路由：用户管理（列表/续期/设备上限）+ 激活码管理（列表/生成/停用/发放备注）+ 操作审计。
// 鉴权：authMiddleware（登录）+ requireAdmin（查库验 is_admin，非 admin 统一 404 防探测）。
// 审计：所有写操作落 admin_audit_log 一条（action/target/detail/ip），detail 为参数摘要 JSON。
// 风格对齐 settings.js / wordbooks.js：手工校验 + 早退 400 + next(err)。
const { Router } = require('express')
const crypto = require('crypto')
const pool = require('../db')
const authMiddleware = require('../middleware/auth')
const requireAdmin = require('../middleware/requireAdmin')
const { getClientIp } = require('../utils/tokens')
const {
  generateTotpSecret,
  isValidTotpSecret,
  verifyTotp,
  encryptTotpSecret,
  decryptTotpSecret,
} = require('../utils/totp')

const router = Router()

// --- helpers ---

function toInt(v, fallback) {
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : fallback
}

// 分页参数：page 从 1 起，pageSize 默认 20 上限 100
function parsePaging(query) {
  const page = Math.max(1, toInt(query.page, 1))
  const pageSize = Math.min(100, Math.max(1, toInt(query.pageSize, 20)))
  return { page, pageSize, offset: (page - 1) * pageSize }
}

async function writeAudit(req, action, targetType, targetId, detail) {
  // 审计失败不阻断业务（管理操作本身已成功），只记日志
  try {
    await pool.execute(
      'INSERT INTO admin_audit_log (admin_user_id, action, target_type, target_id, detail, ip) VALUES (?, ?, ?, ?, ?, ?)',
      [
        req.userId,
        action,
        targetType,
        targetId ?? null,
        detail ? JSON.stringify(detail).slice(0, 500) : null,
        getClientIp(req),
      ]
    )
  } catch (err) {
    console.error('[admin audit] write failed:', err.message)
  }
}

// --- 用户管理 ---

// 用户列表：scope=real|guest（默认全部）；filter=expiring（7 天内到期）|expired（已到期）；search 模糊用户名/昵称
router.get('/users', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const { scope, filter, search } = req.query
    const { page, pageSize, offset } = parsePaging(req.query)

    const where = []
    const params = []
    if (scope === 'real') where.push('u.is_guest = 0')
    else if (scope === 'guest') where.push('u.is_guest = 1')
    if (filter === 'expiring') {
      where.push(
        'u.subscription_expires_at IS NOT NULL AND u.subscription_expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY)'
      )
    } else if (filter === 'expired') {
      where.push('u.subscription_expires_at IS NOT NULL AND u.subscription_expires_at <= NOW()')
    }
    if (search && typeof search === 'string' && search.trim()) {
      where.push('(u.username LIKE ? OR u.nickname LIKE ?)')
      const kw = `%${search.trim().slice(0, 30)}%`
      params.push(kw, kw)
    }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : ''

    const [rows] = await pool.execute(
      `SELECT u.id, u.username, u.nickname, u.is_guest, u.is_admin, u.subscription_expires_at, u.max_devices, u.created_at,
              (u.totp_secret IS NOT NULL) AS has_totp,
              (SELECT MAX(rt.last_active_at) FROM refresh_tokens rt WHERE rt.user_id = u.id) AS last_active_at,
              (SELECT COUNT(*) FROM refresh_tokens rt2 WHERE rt2.user_id = u.id) AS device_count
       FROM users u ${whereSql} ORDER BY u.id DESC LIMIT ${pageSize} OFFSET ${offset}`,
      params
    )
    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total FROM users u ${whereSql}`,
      params
    )

    res.json({
      users: rows.map((u) => ({
        id: u.id,
        username: u.username,
        nickname: u.nickname,
        isGuest: !!u.is_guest,
        isAdmin: !!u.is_admin,
        hasTotp: !!u.has_totp,
        subscriptionExpiresAt: u.subscription_expires_at
          ? new Date(u.subscription_expires_at).toISOString()
          : null,
        maxDevices: u.max_devices,
        deviceCount: u.device_count,
        lastActiveAt: u.last_active_at ? new Date(u.last_active_at).toISOString() : null,
        createdAt: u.created_at ? new Date(u.created_at).toISOString() : null,
      })),
      total: countRows[0].total,
      page,
      pageSize,
    })
  } catch (err) {
    next(err)
  }
})

// 续期/转永久：{ days: 30 } 在当前到期与现在中较晚者基础上加 N 天（未到期续期不吃亏）；
// { permanent: true } 直接置 NULL（永久）。days 白名单 1-3650。
// 与 CLAUDE.md 手工 SQL 语义对齐：用户下次 refresh 拿到新 subExp 自动恢复，无需重启。
// 目标用户预检：访客走试用体系不支持订阅操作；永久账号（sub IS NULL）拒绝 days 续期——
// GREATEST(NOW(), COALESCE(NULL, NOW())) 会以 NOW()+N 天覆盖 NULL，把永久静默降级为限时卡。
router.post('/users/:id/subscription', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const userId = toInt(req.params.id, 0)
    if (!userId || userId < 1) return res.status(400).json({ error: '无效的用户 ID' })

    const [targetRows] = await pool.execute(
      'SELECT is_guest, subscription_expires_at FROM users WHERE id = ?',
      [userId]
    )
    if (targetRows.length === 0) return res.status(404).json({ error: '用户不存在' })
    if (targetRows[0].is_guest) {
      return res.status(400).json({ error: '访客账号走试用体系，不支持订阅续期' })
    }

    const { days, permanent } = req.body || {}
    if (permanent === true) {
      // 存在性已由预检确认；置 NULL 幂等（重复转永久 affectedRows 可为 0，不算失败）
      await pool.execute(
        'UPDATE users SET subscription_expires_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [userId]
      )
      await writeAudit(req, 'renew_subscription', 'user', userId, { permanent: true })
      return res.json({ ok: true })
    }

    if (targetRows[0].subscription_expires_at === null) {
      return res.status(400).json({ error: '该账号为永久账号，无需续期' })
    }
    const d = toInt(days, 0)
    if (d < 1 || d > 3650) return res.status(400).json({ error: 'days 需为 1-3650 的整数' })
    // INTERVAL ? DAY 不支持占位符，整数校验后拼接
    await pool.execute(
      `UPDATE users SET subscription_expires_at = DATE_ADD(GREATEST(NOW(), COALESCE(subscription_expires_at, NOW())), INTERVAL ${d} DAY),
              updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [userId]
    )
    await writeAudit(req, 'renew_subscription', 'user', userId, { days: d })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// 设备登录上限：{ value: null } 恢复全局默认；{ value: 0 } 不限；{ value: N } 精确上限（1-10）
router.post('/users/:id/max-devices', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const userId = toInt(req.params.id, 0)
    if (!userId || userId < 1) return res.status(400).json({ error: '无效的用户 ID' })

    const { value } = req.body || {}
    if (value === null || value === 'null') {
      await pool.execute(
        'UPDATE users SET max_devices = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [userId]
      )
      await writeAudit(req, 'set_max_devices', 'user', userId, { value: null })
      return res.json({ ok: true })
    }
    const v = toInt(value, -1)
    if (v < 0 || v > 10) return res.status(400).json({ error: 'value 需为 null、0（不限）或 1-10' })
    const [result] = await pool.execute(
      'UPDATE users SET max_devices = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [v, userId]
    )
    if (result.affectedRows === 0) return res.status(404).json({ error: '用户不存在' })
    await writeAudit(req, 'set_max_devices', 'user', userId, { value: v })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// --- 激活码管理 ---

const CODE_STATUS_SQL = {
  available: '(ec.is_active = 1 AND (ec.max_uses = 0 OR ec.current_uses < ec.max_uses))',
  exhausted: '(ec.max_uses > 0 AND ec.current_uses >= ec.max_uses)',
  disabled: '(ec.is_active = 0)',
}

// 激活码列表：type=trial|activation（默认 activation）；status=available|exhausted|disabled（默认全部）
router.get('/codes', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const { page, pageSize, offset } = parsePaging(req.query)
    const type = req.query.type === 'trial' ? 'trial' : 'activation'
    const statusSql = CODE_STATUS_SQL[req.query.status] || ''

    const where = ['ec.type = ?']
    const params = [type]
    if (statusSql) where.push(statusSql)
    const whereSql = 'WHERE ' + where.join(' AND ')

    const [rows] = await pool.execute(
      `SELECT ec.id, ec.code, ec.description, ec.type, ec.trial_hours, ec.max_uses, ec.current_uses, ec.is_active,
              ec.issued_note, ec.expires_at, ec.created_at,
              (SELECT COUNT(*) FROM users u WHERE u.activation_code_id = ec.id) AS registered_users
       FROM experience_codes ec ${whereSql} ORDER BY ec.id DESC LIMIT ${pageSize} OFFSET ${offset}`,
      params
    )
    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total FROM experience_codes ec ${whereSql}`,
      params
    )

    res.json({
      codes: rows.map((c) => ({
        id: c.id,
        code: c.code,
        description: c.description,
        type: c.type,
        trialHours: c.trial_hours,
        maxUses: c.max_uses,
        currentUses: c.current_uses,
        isActive: !!c.is_active,
        issuedNote: c.issued_note,
        expiresAt: c.expires_at ? new Date(c.expires_at).toISOString() : null,
        createdAt: c.created_at ? new Date(c.created_at).toISOString() : null,
        registeredUsers: c.registered_users,
      })),
      total: countRows[0].total,
      page,
      pageSize,
    })
  } catch (err) {
    next(err)
  }
})

// 生成激活码：{ trialHours: 0|720|2160|8760, count: 1-200, maxUses: 0-1000, description }
// 码格式：lf-<12 位随机大写字母数字>，注册链接形态 /activate/lf-XXXXXXXXXXXX
router.post('/codes', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const { trialHours, count, maxUses, description } = req.body || {}
    const hours = toInt(trialHours, -1)
    if (![0, 720, 2160, 8760].includes(hours)) {
      return res
        .status(400)
        .json({ error: 'trialHours 需为 0（永久）/720（月）/2160（季）/8760（年）' })
    }
    const n = toInt(count, 0)
    if (n < 1 || n > 200) return res.status(400).json({ error: 'count 需为 1-200' })
    const mu = toInt(maxUses, 1)
    if (mu < 0 || mu > 1000) return res.status(400).json({ error: 'maxUses 需为 0-1000' })
    const desc = typeof description === 'string' ? description.trim().slice(0, 255) : ''

    const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 去掉易混淆的 I/O/0/1
    const codes = []
    for (let i = 0; i < n; i++) {
      const bytes = crypto.randomBytes(12)
      let code = 'lf-'
      for (let j = 0; j < 12; j++) code += CODE_CHARS[bytes[j] % CODE_CHARS.length]
      codes.push(code)
    }

    // mysql2 的 execute（prepared statement）不支持 VALUES ? 嵌套数组展开，
    // 动态拼占位符：每行 5 个 ?，参数全部走占位（码值不进 SQL 文本）
    const placeholders = codes.map(() => '(?, ?, ?, ?, ?)').join(', ')
    const flatParams = codes.flatMap((c) => [c, desc, 'activation', mu, hours])

    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      await conn.execute(
        `INSERT INTO experience_codes (code, description, type, max_uses, trial_hours) VALUES ${placeholders}`,
        flatParams
      )
      await conn.commit()
    } catch (err) {
      await conn.rollback().catch(() => {})
      // 极小概率随机码撞 uk_code（32^12 空间）→ 提示重试即可
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: '随机码碰撞，请重试' })
      }
      throw err
    } finally {
      conn.release()
    }

    await writeAudit(req, 'create_codes', 'code', null, {
      trialHours: hours,
      count: n,
      maxUses: mu,
      description: desc,
    })
    res.status(201).json({ codes })
  } catch (err) {
    next(err)
  }
})

// 改码：{ isActive?, issuedNote?, description? }（白名单字段，缺省不动）
router.patch('/codes/:id', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const codeId = toInt(req.params.id, 0)
    if (!codeId || codeId < 1) return res.status(400).json({ error: '无效的码 ID' })

    const { isActive, issuedNote, description } = req.body || {}
    const sets = []
    const params = []
    if (typeof isActive === 'boolean') {
      sets.push('is_active = ?')
      params.push(isActive ? 1 : 0)
    }
    if (typeof issuedNote === 'string') {
      sets.push('issued_note = ?')
      params.push(issuedNote.trim().slice(0, 255) || null)
    }
    if (typeof description === 'string') {
      sets.push('description = ?')
      params.push(description.trim().slice(0, 255) || '')
    }
    if (sets.length === 0) return res.status(400).json({ error: '无可更新字段' })

    params.push(codeId)
    const [result] = await pool.execute(
      `UPDATE experience_codes SET ${sets.join(', ')} WHERE id = ?`,
      params
    )
    if (result.affectedRows === 0) return res.status(404).json({ error: '码不存在' })
    await writeAudit(req, 'update_code', 'code', codeId, { isActive, issuedNote, description })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// --- 两步验证（TOTP）管理：仅作用于当前管理员本人 ---
// 流程：setup 生成密钥（不入库）→ 用户在验证器 App 添加 → enable 携带密钥+当前验证码落库；
// disable 需出示当前验证码（防止会话被劫持后直接关掉第二因子）。

// 当前管理员的 2FA 状态
router.get('/totp/status', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT totp_secret FROM users WHERE id = ?', [req.userId])
    if (rows.length === 0) return res.status(404).json({ error: '用户不存在' })
    res.json({ enabled: !!rows[0].totp_secret })
  } catch (err) {
    next(err)
  }
})

// 生成新密钥（仅返回，不落库；enable 时才持久化）
router.post('/totp/setup', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const secret = generateTotpSecret()
    const [rows] = await pool.execute('SELECT username FROM users WHERE id = ?', [req.userId])
    const otpauthUrl = `otpauth://totp/LingoForge:${encodeURIComponent(
      rows[0]?.username || ''
    )}?secret=${secret}&issuer=LingoForge&algorithm=SHA1&digits=6&period=30`
    res.json({ secret, otpauthUrl })
  } catch (err) {
    next(err)
  }
})

// 启用：校验验证码与密钥匹配后加密落库
router.post('/totp/enable', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const { secret, code } = req.body || {}
    if (!isValidTotpSecret(secret)) {
      return res.status(400).json({ error: '密钥格式无效' })
    }
    if (typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
      return res.status(400).json({ error: '请输入 6 位动态验证码' })
    }
    if (!verifyTotp(secret, code.trim())) {
      return res.status(400).json({ error: '动态验证码错误，请确认验证器时间与密钥一致' })
    }
    await pool.execute(
      'UPDATE users SET totp_secret = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [encryptTotpSecret(secret), req.userId]
    )
    await writeAudit(req, 'totp_enable', 'user', req.userId, null)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// 停用：需出示当前验证码
router.post('/totp/disable', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const { code } = req.body || {}
    const [rows] = await pool.execute('SELECT totp_secret FROM users WHERE id = ?', [req.userId])
    if (rows.length === 0 || !rows[0].totp_secret) {
      return res.status(400).json({ error: '两步验证未启用' })
    }
    if (
      typeof code !== 'string' ||
      !verifyTotp(decryptTotpSecret(rows[0].totp_secret) || '', code.trim())
    ) {
      return res.status(400).json({ error: '动态验证码错误' })
    }
    await pool.execute(
      'UPDATE users SET totp_secret = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [req.userId]
    )
    await writeAudit(req, 'totp_disable', 'user', req.userId, null)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// --- 审计 ---

router.get('/audit', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const { page, pageSize, offset } = parsePaging(req.query)
    const [rows] = await pool.execute(
      `SELECT a.id, a.admin_user_id, a.action, a.target_type, a.target_id, a.detail, a.ip, a.created_at,
              u.username AS admin_username
       FROM admin_audit_log a LEFT JOIN users u ON u.id = a.admin_user_id
       ORDER BY a.id DESC LIMIT ${pageSize} OFFSET ${offset}`
    )
    const [countRows] = await pool.execute('SELECT COUNT(*) AS total FROM admin_audit_log')
    res.json({
      logs: rows.map((r) => ({
        id: r.id,
        adminUsername: r.admin_username,
        action: r.action,
        targetType: r.target_type,
        targetId: r.target_id,
        detail: r.detail,
        ip: r.ip,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
      })),
      total: countRows[0].total,
      page,
      pageSize,
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
