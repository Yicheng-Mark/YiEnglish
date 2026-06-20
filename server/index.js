const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const fs = require('fs')
const path = require('path')
const config = require('./config')
const pool = require('./db')
const errorHandler = require('./middleware/errorHandler')
const { cleanupStaleAttempts } = require('./middleware/rateLimit')
const { createRateLimiter } = require('./utils/apiRateLimit')

// 自动执行所有 migrate_*.sql。引入 schema_migrations 版本表：已执行的文件跳过，避免每次启动重复跑全部迁移。
// 失败时升级为 error 日志，但不中止启动（保持可用性）；失败的文件不记录版本，下次启动自动重试。
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

  const files = fs.readdirSync(sqlDir)
    .filter((f) => f.startsWith('migrate_') && f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    if (appliedSet.has(file)) continue
    const sql = fs.readFileSync(path.join(sqlDir, file), 'utf8')
    const statements = sql
      .split(';')
      .map((s) => s.trim().split('\n').filter((line) => !line.trim().startsWith('--')).join('\n').trim())
      .filter((s) => s && !s.startsWith('USE '))
    for (const stmt of statements) {
      try {
        await pool.query(stmt)
      } catch (err) {
        // ALTER ADD COLUMN 旧 MySQL 不支持 IF NOT EXISTS，忽略重复列
        if (err.code === 'ER_DUP_FIELDNAME') continue
        // 其余错误记录为 error 便于发现，但不中止启动（保持可用性）
        console.error(`[Migration] ${file} statement failed: ${err.message}`)
      }
    }
    // 跑完即记录版本：避免每次启动重复执行同一迁移、刷日志；
    // 真错误由上方 error 日志暴露，人工介入（不引入重试循环）。
    await pool.query('INSERT IGNORE INTO schema_migrations (version) VALUES (?)', [file])
    console.log(`[Migration] ${file} applied`)
  }
}

if (!config.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set. Refusing to start.')
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

const app = express()
// 生产经 Nginx 反代：信任一层代理，从 X-Forwarded-For 正确解析客户端真实 IP（限流/设备 IP 都依赖 req.ip）
app.set('trust proxy', 1)

const corsOrigins = config.ALLOWED_ORIGINS
  ? config.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
  : [config.FRONTEND_URL]
app.use(cors({ origin: corsOrigins, credentials: true }))
app.use(cookieParser())
app.use(express.json({ limit: '1mb' }))

// API routes
// 写接口通用限流：每 IP 每分钟 120 次（正常使用远低于此；打字进度为批量保存，频率低，不致误伤）
const writeLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 120 })
// 错误上报限流：每 IP 每分钟 30 次（前端已做去重，防恶意刷爆 pm2 日志）
const errorReportLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 30 })

app.use('/api/auth', authRoutes) // auth 有自己的 DB 登录限流，不重复挂
app.use('/api/progress', writeLimiter, progressRoutes)
app.use('/api/wordbooks', writeLimiter, wordbookRoutes)
app.use('/api/favorites', writeLimiter, favoritesRoutes)
app.use('/api/settings', writeLimiter, settingsRoutes)
app.use('/api/migrate', writeLimiter, migrateRoutes)
app.use('/api/review', writeLimiter, reviewRoutes)
app.use('/api/demo', demoRoutes) // demo 有自己的体验码限流，不重复挂
app.use('/api/client-error', errorReportLimiter, clientErrorRoutes)

// Serve static frontend in production
const distPath = path.resolve(__dirname, '../dist')
app.use(express.static(distPath))
app.get('{*path}', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

app.use(errorHandler)

app.listen(config.PORT, () => {
  console.log(`Server running on http://localhost:${config.PORT}`)

  // 启动时自动执行数据库迁移（CREATE TABLE IF NOT EXISTS，幂等安全）
  runMigrations().catch(err => console.error('[Migration] Failed:', err.message))

  // cleanup stale login attempts every 6 hours
  setInterval(cleanupStaleAttempts, 6 * 60 * 60 * 1000)
})
