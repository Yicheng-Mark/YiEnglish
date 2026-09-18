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
  DEVICE_COOKIE,
} = require('../utils/tokens')
const { createRateLimiter } = require('../utils/apiRateLimit')
const { verifyTotpCounter, decryptTotpSecret } = require('../utils/totp')

// TOTP 防重放认领（RFC 6238 §5.2：验证成功的验证码不得被第二次接受）：
// 「计数器严格递增」的原子 UPDATE——并发两个请求携同一码时只放行先到者。
// affectedRows=0 表示该计数器已被消费（同窗重放）或时钟回拨，按验证失败拒绝。
async function claimTotpCounter(userId, counter) {
  const [claim] = await pool.execute(
    'UPDATE users SET totp_last_counter = ? WHERE id = ? AND (totp_last_counter IS NULL OR totp_last_counter < ?)',
    [counter, userId, counter]
  )
  return claim.affectedRows !== 0
}

// 找回密码 lookup 响应里的用户名打码：激活码本身即可定位账号，若再回显完整用户名，
// 拿到码的任何人就凑齐了 recover-reset 所需的两要素（码 + 用户名）。打码显示仅供
// 真实用户确认找对了账号，完整用户名必须由用户自己提供。
function maskUsername(username) {
  if (typeof username !== 'string' || username.length === 0) return ''
  if (username.length <= 2) return username[0] + '*'
  if (username.length <= 5) return username[0] + '***' + username[username.length - 1]
  const keep = Math.max(1, Math.floor(username.length / 4))
  return username.slice(0, keep) + '***' + username.slice(-keep)
}

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
  const obj = {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    avatar: user.avatar_url ?? null,
    dailyGoalMinutes: user.daily_goal_minutes ?? 30,
    signature: user.signature ?? null,
  }
  // SELECT 带出 subscription_expires_at 的调用方自动附到期字段（月/季/年卡；NULL=永久不附）
  if (user.subscription_expires_at) {
    obj.subscriptionExpiresAt = new Date(user.subscription_expires_at).toISOString()
  }
  // SELECT 带出 is_admin 的调用方自动附管理员标识（前端据此显示管理后台入口）
  if (user.is_admin) obj.isAdmin = true
  return obj
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

    // 验证激活码：失败按 code 维度计数，防止在线爆破有效码。
    // checkLoginRateLimit 同时在 code 维度（5 次失败/15min）与 IP 维度（20 次失败/15min，
    // ip_address 不区分 identifier）拦截——此前失败只 logAttempt 计数却从不检查，
    // 换不同假码打 /register 可无限探测激活码（validate 端点的内存限流拦不住直打 register）
    const registerCodeKey = 'register-code:' + activationCode.trim()
    await checkLoginRateLimit(registerCodeKey, ip)
    const [codes] = await pool.execute(
      `SELECT id, code, max_uses, current_uses, is_active, expires_at, trial_hours
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

    // hash 与查重并行：同名若提前返回不跑 hash，响应耗时差会暴露用户名是否已注册
    // （login 用 DUMMY_HASH 恒时比较防枚举，这里同理让两条路径都含 BCRYPT_ROUNDS 的成本）
    // 注意双层解构：Promise.all 的第一项是 mysql2 的 [rows, fields]
    const [[existing], hash] = await Promise.all([
      pool.execute('SELECT id FROM users WHERE username = ?', [username]),
      bcrypt.hash(password, config.BCRYPT_ROUNDS),
    ])
    if (existing.length > 0) {
      return res.status(400).json({ error: '注册失败，请稍后重试' })
    }
    const displayName =
      typeof nickname === 'string' && nickname.trim() ? nickname.trim().slice(0, 50) : username

    // INSERT 用户 → 原子消费激活码 → 记录来源：整段包事务，保证一致性。
    // 并发同用户名时 INSERT 抛 ER_DUP_ENTRY 由下方 catch 捕获返回 400，不再 500。
    const conn = await pool.getConnection()
    let userId
    let subscriptionExpiresAt = null
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

      // 记录激活码来源；trial_hours>0（月/季/年卡）同时写入订阅到期。JS 时间源与 demo 体验码一致，
      // 并截断到整秒：列是 TIMESTAMP(fsp=0)，MySQL 按四舍五入存亚秒，不截断会让 token 内嵌的
      // subExp 与 DB 权威值相差 ±500ms（到期边界上两道闸不一致）。
      // trial_hours=0（列 NOT NULL，无 NULL 态）→ 保持 NULL 即永久（存量码兼容）。
      subscriptionExpiresAt =
        actCode.trial_hours > 0
          ? new Date(Math.floor((Date.now() + actCode.trial_hours * 60 * 60 * 1000) / 1000) * 1000)
          : null
      await conn.execute(
        'UPDATE users SET activation_code_id = ?, subscription_expires_at = ? WHERE id = ?',
        [actCode.id, subscriptionExpiresAt, userId]
      )

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

    await issueTokens(
      res,
      userId,
      false,
      {
        deviceId: ensureDeviceCookie(req, res, resolveDeviceId(req)),
        deviceName: parseDeviceName(req.headers['user-agent']),
        ip,
      },
      subscriptionExpiresAt ? subscriptionExpiresAt.toISOString() : null
    )
    await logAttempt(`register:${ip}`, ip, true)

    res.json({
      user: toClientUser({
        id: userId,
        username,
        nickname: displayName,
        subscription_expires_at: subscriptionExpiresAt,
      }),
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
      'SELECT id, username, nickname, password_hash, avatar_url, daily_goal_minutes, signature, is_guest, is_admin, subscription_expires_at, totp_secret FROM users WHERE username = ?',
      [username]
    )

    const user = rows[0]
    const hashToCompare = user ? user.password_hash : DUMMY_HASH
    const match = await bcrypt.compare(password, hashToCompare)

    if (!user || !match) {
      await logAttempt(username, ip, false)
      return res.status(401).json({ error: '用户名或密码错误' })
    }

    // 订阅到期（月/季/年卡）：到期账号拒绝登录，不签发任何 token。
    // 密码校验之后才判，避免到期账号的用户名存在性被探测（同样是 401，无枚举差异）。
    // mysql2 返回的 subscription_expires_at 已是 Date，无需重复包装
    const subExpIso = user.subscription_expires_at
      ? user.subscription_expires_at.toISOString()
      : null
    if (user.subscription_expires_at && user.subscription_expires_at <= new Date()) {
      await logAttempt(username, ip, false)
      return res.status(401).json({ error: '账号已到期', code: 'SUBSCRIPTION_EXPIRED' })
    }

    // 访客行经 /login 登录（正常路径不可达：访客密码为服务端随机值，仅防御性兜底）。
    // 旧实现 issueTokens 一律按正式账号签发，访客行会拿到无 isGuest 标记的 token，
    // 中间件/前端将其视为正式用户。此处对齐 refresh：按 DB 身份签发，试用到期则拒绝。
    const isGuest = !!user.is_guest
    let trialExpiresAt = null
    if (isGuest) {
      const [trialRows] = await pool.execute(
        'SELECT expires_at FROM trial_activations WHERE user_id = ?',
        [user.id]
      )
      trialExpiresAt = trialRows[0]?.expires_at || null
      if (!trialExpiresAt || new Date(trialExpiresAt) <= new Date()) {
        await logAttempt(username, ip, false)
        return res.status(401).json({ error: '体验时间已结束', code: 'TRIAL_EXPIRED' })
      }
    }

    // 管理员两步验证（TOTP）：密码之外还需 6 位动态验证码，防密码泄露后管理端被接管。
    // 缺验证码返回 TOTP_REQUIRED（前端展示输入框重试），错误验证码返回 TOTP_INVALID；
    // 两种失败都计入 login 限流（5 次/15min/用户名），10^6 码空间下爆破不可行。
    // 防重放：验证命中后按计数器原子认领，同窗内同一码二次使用（肩窥/截屏）按失败拒绝
    //（RFC 6238 §5.2）；代价是同一 30s 窗口内不能两台设备先后登录，管理员场景可接受。
    // 密钥解密失败（JWT_SECRET 轮换后）等同验证失败——解锁走手工 SQL 置 NULL，见迁移说明。
    if (user.is_admin && user.totp_secret) {
      const totpCode = typeof req.body?.totpCode === 'string' ? req.body.totpCode.trim() : ''
      if (!/^\d{6}$/.test(totpCode)) {
        await logAttempt(username, ip, false)
        return res.status(401).json({ error: '请输入动态验证码', code: 'TOTP_REQUIRED' })
      }
      const secret = decryptTotpSecret(user.totp_secret)
      const matchedCounter = secret ? verifyTotpCounter(secret, totpCode) : null
      if (matchedCounter === null || !(await claimTotpCounter(user.id, matchedCounter))) {
        await logAttempt(username, ip, false)
        return res.status(401).json({ error: '动态验证码错误', code: 'TOTP_INVALID' })
      }
    }

    await logAttempt(username, ip, true)

    // 设备级会话名额：统计本设备以外的活跃设备，达上限则拒绝第 N+1 台登录。
    // ensureDeviceCookie：无设备 cookie 的"干净登录"先下发再复用同一 deviceId，
    // 否则每次登录生成新随机 id 写入 refresh_tokens，会误占设备名额导致锁号
    const deviceId = ensureDeviceCookie(req, res, resolveDeviceId(req))
    const device = { deviceId, deviceName: parseDeviceName(req.headers['user-agent']), ip }

    // 名额检查 + 会话写入放同一短事务（bcrypt 已在外层完成，锁只覆盖毫秒级 DB 操作）：
    // SELECT ... FOR UPDATE 锁住用户行，串行化同一账号的并发登录，消除「两台新设备
    // 同时通过 COUNT 检查再各自 INSERT」的超限竞态；issueTokens 的写入走
    // (user_id, device_id) 唯一键原子 upsert，同一设备重复登录覆盖旧行不占新名额。
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      // 事务内重读 max_devices：并发调上限时以最新值为准（初查 SELECT 的值可能已过期）
      const [lockRows] = await conn.execute(
        'SELECT max_devices FROM users WHERE id = ? FOR UPDATE',
        [user.id]
      )
      const maxDevices = lockRows[0]?.max_devices

      const [[{ cnt }]] = await conn.execute(
        `SELECT COUNT(*) AS cnt FROM refresh_tokens
         WHERE user_id = ? AND device_id <> '' AND device_id <> ? AND expires_at > NOW()`,
        [user.id, deviceId]
      )
      // 设备上限支持用户级覆盖：users.max_devices NULL=跟随全局默认，0=不限，>0=精确上限
      const deviceLimit = maxDevices ?? config.MAX_DEVICES_PER_USER
      if (deviceLimit > 0 && cnt >= deviceLimit) {
        await conn.rollback()
        return res.status(403).json({
          error: `该账号已在 ${cnt} 台其他设备登录（上限 ${deviceLimit} 台），请到已登录设备的「设置-登录设备管理」中退出一台后再试`,
          code: 'DEVICE_LIMIT_REACHED',
        })
      }

      // 顺带回收该账号已过期的会话行（过期行不占名额，纯清理）
      await conn.execute('DELETE FROM refresh_tokens WHERE user_id = ? AND expires_at <= NOW()', [
        user.id,
      ])

      await issueTokens(
        res,
        user.id,
        isGuest,
        device,
        isGuest ? new Date(trialExpiresAt).toISOString() : subExpIso,
        conn
      )

      await conn.commit()
    } catch (err) {
      await conn.rollback().catch(() => {})
      throw err
    } finally {
      conn.release()
    }

    const userObj = toClientUser(user)
    if (isGuest) {
      userObj.isTrial = true
      userObj.trialExpiresAt = new Date(trialExpiresAt).toISOString()
    }
    res.json({ user: userObj })
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

    // SELECT 仅用于读取轮换所需元数据（认领由下方守卫 DELETE 完成）
    const [rows] = await pool.execute(
      'SELECT id, user_id, device_id, device_name, ip, created_at FROM refresh_tokens WHERE token_hash = ? AND expires_at > NOW()',
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
      // 走到这里说明上方 SELECT 查到了行但 DELETE 认领失败——token 刚被并发的
      // 另一标签页认领，胜者已拿到新 cookie。此时若 clearCookies 会把胜者刚下发
      // 的新 refresh cookie 一并抹掉 → 双标签页间歇被登出。仅返回 401 响应体，
      // 不动 cookie（真无效 token 的 rows.length===0 分支仍照常清）。
      return res.status(401).json({ error: '请先登录' })
    }

    const [userRows] = await pool.execute(
      'SELECT id, username, nickname, avatar_url, daily_goal_minutes, signature, is_guest, is_admin, max_devices, subscription_expires_at FROM users WHERE id = ?',
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

    // 正式账号订阅到期（月/季/年卡）：到期即拒，清 cookie 强制下线——挂机页面的最后兜底闸
    let subExpIso = null
    if (!isGuest && userRows[0].subscription_expires_at) {
      const subExpiresAt = new Date(userRows[0].subscription_expires_at)
      if (subExpiresAt <= new Date()) {
        clearCookies(res)
        return res.status(401).json({ error: '账号已到期', code: 'SUBSCRIPTION_EXPIRED' })
      }
      subExpIso = subExpiresAt.toISOString()
    }

    // rotation 时沿用原会话的设备标识/IP，刷新 last_active_at（返回本会话行 id，
    // 供下方设备上限驱逐排除自身）
    const sessionId = await issueTokens(
      res,
      stored.user_id,
      isGuest,
      {
        deviceId: stored.device_id,
        deviceName: stored.device_name,
        ip: stored.ip,
      },
      isGuest ? (trialExpiresAt ? new Date(trialExpiresAt).toISOString() : null) : subExpIso
    )

    // 设备上限复检（驱逐制）：上限只拦「新登录」的话，调低上限后存量超额会话仍可
    // 无限续期。本会话刚完成轮换写入（last_active_at=NOW()，必为全账号最新），此后
    // 统计活跃会话总数，超出上限时把最旧的他台逐出台数差额——被踢设备下次 refresh
    // 因 token 行已删自然落到 401 清 cookie 分支，本台正常续期不受影响。
    // 旧实现按「比本会话更早创建的会话数 >= 上限」判 403，但轮换 upsert 会把
    // created_at 刷成 NOW()，多设备 FIFO 正常轮换时 olderCnt 恒 0 永不收敛，乱序时
    // 反而踢到最新设备；驱逐制只看 last_active_at，任意轮换顺序都单调收敛。
    // 统计口径与登录路径一致：只算 device_id <> '' 的未过期行；游客走独立试用体系不参与。
    if (!isGuest) {
      const deviceLimit = userRows[0].max_devices ?? config.MAX_DEVICES_PER_USER
      if (deviceLimit > 0) {
        const [[{ activeCnt }]] = await pool.execute(
          `SELECT COUNT(*) AS activeCnt FROM refresh_tokens
           WHERE user_id = ? AND device_id <> '' AND expires_at > NOW()`,
          [stored.user_id]
        )
        const excess = activeCnt - deviceLimit
        if (excess > 0) {
          // 单条 DELETE + 派生表子查询保持原子（MySQL 同表 DELETE 子查询需包一层）
          await pool.execute(
            `DELETE FROM refresh_tokens WHERE id IN (
               SELECT id FROM (
                 SELECT id FROM refresh_tokens
                 WHERE user_id = ? AND device_id <> '' AND expires_at > NOW() AND id <> ?
                 ORDER BY last_active_at ASC, id ASC
                 LIMIT ?
               ) AS victims
             )`,
            [stored.user_id, sessionId, excess]
          )
        }
      }
    }

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
      `SELECT id, username, nickname, avatar_url, daily_goal_minutes, signature, is_guest, is_admin, subscription_expires_at
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

    // 响应补齐 is_guest/is_admin/subscription_expires_at（对齐 /me 的口径）：
    // 前端 setUser 直接整体替换 user 对象，若响应缺 isTrial，访客改一次昵称后
    // 客户端 isTrial 标记即丢失 → TrialGuard 等沙箱闸全部失效（体验用户逃逸进主应用）；
    // 同理缺 isAdmin 会让管理员改资料后丢失管理后台入口
    const [rows] = await pool.execute(
      'SELECT id, username, nickname, avatar_url, daily_goal_minutes, signature, is_guest, is_admin, subscription_expires_at FROM users WHERE id = ?',
      [req.userId]
    )
    const u = rows[0]
    const userObj = toClientUser(u)
    if (u.is_guest) {
      const [trialRows] = await pool.execute(
        'SELECT expires_at FROM trial_activations WHERE user_id = ? LIMIT 1',
        [req.userId]
      )
      const trialExpiresAt = trialRows[0]?.expires_at || null
      userObj.isTrial = true
      userObj.trialExpiresAt = trialExpiresAt ? new Date(trialExpiresAt).toISOString() : null
    }
    res.json({
      user: userObj,
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
    // 用户名打码返回：完整用户名是 recover-reset 的第二因子，不能凭码直接拿到
    res.json({ found: true, usernameMasked: maskUsername(rows[0].username) })
  } catch (err) {
    next(err)
  }
})

// --- 找回密码：验证当前用户名 + 重置密码（可选改用户名），并自动登录 ---
router.post('/recover-reset', async (req, res, next) => {
  try {
    const { code, currentUsername, password, newUsername, totpCode } = req.body
    const ip = getClientIp(req)

    if (!code || typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({ error: '请输入激活码' })
    }
    // 双要素：激活码（注册链接）+ 当前用户名。仅凭码不再能重置任意关联账号——
    // 码可能经转售/截图外泄，用户名必须由账号本人提供
    if (
      typeof currentUsername !== 'string' ||
      !currentUsername.trim() ||
      currentUsername.trim().length > 30
    ) {
      return res.status(400).json({ error: '请输入该账号的当前用户名' })
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
      `SELECT u.id, u.username, u.is_guest, u.is_admin, u.totp_secret, u.subscription_expires_at FROM users u
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

    // 第二要素校验：当前用户名须与关联账号一致。
    // 与 login 同口径按不区分大小写比对（users 表 utf8mb4_unicode_ci 排序规则下
    // WHERE username = ? 本就不区分大小写），避免凭码枚举出大小写变体差异
    if (rows[0].username.toLowerCase() !== currentUsername.trim().toLowerCase()) {
      await logAttempt(codeKey, ip, false)
      return res.status(400).json({ error: '当前用户名与该激活码关联的账号不符' })
    }

    // 可选改名：提供且不同于当前用户名时校验合法性；缺省/相同则保持不变
    const wantRename =
      typeof newUsername === 'string' &&
      newUsername.trim() &&
      newUsername.trim() !== rows[0].username
    if (wantRename && !validateUsername(newUsername.trim())) {
      return res.status(400).json({ error: '用户名需 3-30 位，支持字母、数字、下划线、中文' })
    }

    // 访客行兜底（防御性，与 login 的同类兜底对称）：正常路径访客不写 activation_code_id
    // 而到不了这里，但手工 SQL 误操作或未来代码回归使访客行关联激活码时，必须拒绝——
    // 下方 issueTokens 按 isGuest=false 签发，且访客行 subscription_expires_at 为 NULL
    // （=永久语义），放行等于凭体验码白嫖一个永久正式账号
    if (rows[0].is_guest) {
      await logAttempt(codeKey, ip, false)
      return res.status(400).json({ error: '该激活码未关联正式账号' })
    }

    // 订阅到期（月/季/年卡）：到期账号不允许通过找回密码恢复访问——找回权利不随码失效，
    // 但账号本身的到期优先。不拦的话：到期 → 找回密码自动登录 → 拿到无 subExp 的会话，
    // 绕过 login/middleware 两道闸（refresh 闸要等 30 分钟 token 过期才生效）
    const subExpIso = rows[0].subscription_expires_at
      ? new Date(rows[0].subscription_expires_at).toISOString()
      : null
    if (
      rows[0].subscription_expires_at &&
      new Date(rows[0].subscription_expires_at) <= new Date()
    ) {
      await logAttempt(codeKey, ip, false)
      return res.status(401).json({ error: '账号已到期', code: 'SUBSCRIPTION_EXPIRED' })
    }

    // 管理员两步验证（与 login 同款，含防重放认领）：管理员账号经找回路径重置也必须
    // 出示动态验证码，否则「码 + 用户名」两要素对启用 2FA 的管理员仍不构成完整接管，
    // 规则出现豁口。重放（已用过的验证码）同样拒绝——找回是接管入口，要求最严
    if (rows[0].is_admin && rows[0].totp_secret) {
      const code6 = typeof totpCode === 'string' ? totpCode.trim() : ''
      if (!/^\d{6}$/.test(code6)) {
        await logAttempt(codeKey, ip, false)
        return res.status(401).json({ error: '请输入动态验证码', code: 'TOTP_REQUIRED' })
      }
      const secret = decryptTotpSecret(rows[0].totp_secret)
      const matchedCounter = secret ? verifyTotpCounter(secret, code6) : null
      if (matchedCounter === null || !(await claimTotpCounter(userId, matchedCounter))) {
        await logAttempt(codeKey, ip, false)
        return res.status(401).json({ error: '动态验证码错误', code: 'TOTP_INVALID' })
      }
    }

    // 唯一性预检（排除自身，仅在要求改名时）
    if (wantRename) {
      const [existing] = await pool.execute('SELECT id FROM users WHERE username = ? AND id != ?', [
        newUsername.trim(),
        userId,
      ])
      if (existing.length > 0) {
        return res.status(409).json({ error: '用户名已被占用' })
      }
    }

    const hash = await bcrypt.hash(password, config.BCRYPT_ROUNDS)

    try {
      await pool.execute(
        wantRename
          ? 'UPDATE users SET username = ?, password_hash = ?, password_changed_at = NOW() WHERE id = ?'
          : 'UPDATE users SET password_hash = ?, password_changed_at = NOW() WHERE id = ?',
        wantRename ? [newUsername.trim(), hash, userId] : [hash, userId]
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

    await issueTokens(
      res,
      userId,
      false,
      {
        deviceId: ensureDeviceCookie(req, res, resolveDeviceId(req)),
        deviceName: parseDeviceName(req.headers['user-agent']),
        ip,
      },
      subExpIso
    )
    await logAttempt(codeKey, ip, true)

    const [updated] = await pool.execute(
      'SELECT id, username, nickname, avatar_url, daily_goal_minutes, signature, subscription_expires_at FROM users WHERE id = ?',
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
    // 当前设备标识只认服务端签发的 HttpOnly cookie（与 refresh_tokens.device_id 同源，
    // 都是 DEVICE_COOKIE）。旧实现读 req.query.deviceId——前端 localStorage 自生成 id
    // 与 DB 里 cookie 来源的 device_id 是两套值，永不相等，is_current 恒 false。
    const deviceId =
      typeof req.cookies?.[DEVICE_COOKIE] === 'string' ? req.cookies[DEVICE_COOKIE].trim() : ''
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
