const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const cookieParser = require('cookie-parser')
const fs = require('fs')
const path = require('path')
const config = require('./config')
const pool = require('./db')
const logger = require('./utils/logger')
const splitSqlStatements = require('./utils/splitSqlStatements')
const errorHandler = require('./middleware/errorHandler')
const { cleanupStaleAttempts } = require('./middleware/rateLimit')
const { cleanupExpiredGuests } = require('./utils/cleanupGuests')
const { createRateLimiter } = require('./utils/apiRateLimit')

// 自动执行所有 migrate_*.sql。引入 schema_migrations 版本表：已执行的文件跳过，避免每次启动重复跑全部迁移。
// 失败时升级为 error 日志，但不中止启动（保持可用性）；失败的文件不记录版本，下次启动自动重试。
// 执行顺序为不动点重试：文件名字母序存在依赖倒挂（如 migrate_activation_code.sql 的
// ALTER 目标表由排其后的 migrate_demo_trial.sql 创建），首轮必失败。不重命名/重排迁移
// 文件（schema_migrations 按文件名记历史，重排会导致生产重复执行），改为失败文件多轮
// 重试：每轮跑完后，只要本轮有文件成功（依赖已被补齐）就对剩余失败文件再跑一轮，最多
// 5 轮；仍失败的不记版本、不中止启动，下次启动自动重试。
async function runMigrations() {
  const sqlDir = path.join(__dirname, 'sql')

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `)
  const [applied] = await pool.query('SELECT version FROM schema_migrations')
  const appliedSet = new Set(applied.map((r) => r.version))

  const files = fs
    .readdirSync(sqlDir)
    .filter((f) => f.startsWith('migrate_') && f.endsWith('.sql'))
    .sort()

  // 单文件执行：全部语句成功记录版本并返回 true；任一语句失败不记版本，返回 false
  const applyMigrationFile = async (file) => {
    const sql = fs.readFileSync(path.join(sqlDir, file), 'utf8')
    const cleaned = splitSqlStatements(sql)
    let failed = false
    for (const stmt of cleaned) {
      try {
        await pool.query(stmt)
      } catch (err) {
        // ALTER ADD COLUMN/KEY 旧 MySQL 不支持 IF NOT EXISTS，忽略重复列/重复键名
        // （重复键名见于版本记录写入失败后的重跑：DDL 已生效但未记录，重跑撞 ER_DUP_KEYNAME）
        if (err.code === 'ER_DUP_FIELDNAME' || err.code === 'ER_DUP_KEYNAME') continue
        // 其余错误记录为 error 便于发现，但不中止启动（保持可用性）
        failed = true
        logger.error({ file, err: err.message }, '[Migration] statement failed')
      }
    }
    if (failed) {
      // 任一语句失败：不写 schema_migrations，避免把半成品 schema 固化为"已应用"。
      logger.error({ file }, '[Migration] 有语句失败，跳过版本记录，稍后重试')
      return false
    }
    // 全部语句成功才记录版本：避免每次启动重复执行同一迁移、刷日志。
    await pool.query('INSERT IGNORE INTO schema_migrations (version) VALUES (?)', [file])
    logger.info({ file }, '[Migration] applied')
    return true
  }

  let pending = files.filter((f) => !appliedSet.has(f))
  for (let round = 0; round < 5 && pending.length > 0; round++) {
    const failed = []
    let progressed = false
    for (const file of pending) {
      // 不动点：本轮只要有文件成功就值得再跑一轮（失败的依赖可能已被本轮补齐）；
      // 全部失败则提前收敛，不再空转
      const ok = await applyMigrationFile(file)
      if (ok) progressed = true
      else failed.push(file)
    }
    if (!progressed) break
    pending = failed
  }
}

if (!config.JWT_SECRET) {
  logger.error('FATAL: JWT_SECRET is not set. Refusing to start.')
  process.exit(1)
}

const progressRoutes = require('./routes/progress')
const wordbookRoutes = require('./routes/wordbooks')
const favoritesRoutes = require('./routes/favorites')
const settingsRoutes = require('./routes/settings')
const migrateRoutes = require('./routes/migrate')
const reviewRoutes = require('./routes/review')
const authRoutes = require('./routes/auth')
const demoRoutes = require('./routes/demo')
const clientErrorRoutes = require('./routes/clientError')
const adminRoutes = require('./routes/admin')
const contentRoutes = require('./routes/content')
// AI 助手下线（DeepSeek key 无额度），恢复时取消注释本块及下方 aiLimiter、三个 app.use 挂载
// 2026-09-11 路由与 services 文件已整体归档至 D:\AI助手归档，恢复时先复制回仓库
// const chatRoutes = require('./routes/chat')
// const styleRoutes = require('./routes/style')
// const memoryRoutes = require('./routes/memory')

const app = express()
// 生产经 Nginx 反代：信任一层代理，从 X-Forwarded-For 正确解析客户端真实 IP（限流/设备 IP 都依赖 req.ip）。
// 默认 1；服务不经反代直接暴露时应设 TRUST_PROXY=0，否则客户端可伪造 X-Forwarded-For 绕过 IP 限流
app.set('trust proxy', config.TRUST_PROXY)

// 安全响应头（X-Content-Type-Options / X-Frame-Options / Referrer-Policy / HSTS 等）。
// CSP 暂不启用：index.html 有防闪烁主题引导内联脚本、legacy 构建产物含 inline script、
// 语料视频走 OSS 外域（media-src）——直接上严格 CSP 会白屏/断视频，待统一 nonce 方案后再收紧。
// COEP 关闭：require-corp 会要求 OSS 视频响应带 CORP 头，当前 OSS 配置不满足。
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
)

const corsOrigins = config.ALLOWED_ORIGINS
  ? config.ALLOWED_ORIGINS.split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : [config.FRONTEND_URL]
app.use(cors({ origin: corsOrigins, credentials: true }))
app.use(cookieParser())
app.use(express.json({ limit: '1mb' }))

// API routes
// 写接口通用限流：每 IP 每分钟 120 次（正常使用远低于此；打字进度为批量保存，频率低，不致误伤）
const writeLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 120 })
// 错误上报限流：每 IP 每分钟 30 次（前端已做去重，防恶意刷爆 pm2 日志）
const errorReportLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 30 })
// AI 助手下线：限流器随路由挂载一并停用，恢复时取消注释
// AI 助手限流：每 IP 每分钟 30 次（每次对话都是一次 DeepSeek 付费调用，另有账号级每日 10 次限额）
// const aiLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 30 })

app.use('/api/auth', authRoutes) // auth 有自己的 DB 登录限流，不重复挂
app.use('/api/admin', writeLimiter, adminRoutes) // 管理后台：路由内逐条 authMiddleware + requireAdmin（查库验 is_admin）
app.use('/api/progress', writeLimiter, progressRoutes)
app.use('/api/wordbooks', writeLimiter, wordbookRoutes)
app.use('/api/favorites', writeLimiter, favoritesRoutes)
app.use('/api/settings', writeLimiter, settingsRoutes)
app.use('/api/migrate', writeLimiter, migrateRoutes)
app.use('/api/review', writeLimiter, reviewRoutes)
app.use('/api/demo', demoRoutes) // demo 有自己的体验码限流，不重复挂
app.use('/api/client-error', errorReportLimiter, clientErrorRoutes)
// 词库数据下发（认证 + 体验裁剪）：读路径，共享写接口的 120/min/IP 限流
app.use('/api/dictionaries', writeLimiter, contentRoutes)
// AI 助手下线：/api/chat|style|memory 不再挂载，请求落到下方 /api 404 兜底
// app.use('/api/chat', aiLimiter, chatRoutes) // chat 另有账号级每日 10 次限额
// app.use('/api/style', aiLimiter, styleRoutes)
// app.use('/api/memory', aiLimiter, memoryRoutes)

// Serve static frontend in production
const distPath = path.resolve(__dirname, '../dist')
app.use(express.static(distPath))
// 未知 API 路径直接 404：不落进下面的 SPA 通配（通配会返回 index.html + 200，掩盖前端调用错误）
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API not found' })
})
app.get('{*path}', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

app.use(errorHandler)

app.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, 'Server running')

  // 启动时自动执行数据库迁移（CREATE TABLE IF NOT EXISTS，幂等安全）
  runMigrations().catch((err) => logger.error({ err: err.message }, '[Migration] Failed'))

  // cleanup stale login attempts every 6 hours
  setInterval(cleanupStaleAttempts, 6 * 60 * 60 * 1000)
  // cleanup expired guest accounts every 24 hours (trial expired > 30 days, FK CASCADE)
  setInterval(cleanupExpiredGuests, 24 * 60 * 60 * 1000)
})
