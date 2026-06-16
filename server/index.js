const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const fs = require('fs')
const path = require('path')
const config = require('./config')
const pool = require('./db')
const errorHandler = require('./middleware/errorHandler')
const { cleanupStaleAttempts } = require('./middleware/rateLimit')

// 自动执行所有 migrate_*.sql（CREATE TABLE IF NOT EXISTS，幂等）
async function runMigrations() {
  const sqlDir = path.join(__dirname, 'sql')
  const files = fs.readdirSync(sqlDir)
    .filter(f => f.startsWith('migrate_') && f.endsWith('.sql'))
    .sort()
  for (const file of files) {
    const sql = fs.readFileSync(path.join(sqlDir, file), 'utf8')
    const statements = sql
      .split(';')
      .map(s => s.trim().split('\n').filter(line => !line.trim().startsWith('--')).join('\n').trim())
      .filter(s => s && !s.startsWith('USE '))
    for (const stmt of statements) {
      try {
        await pool.query(stmt)
      } catch (err) {
        // ALTER TABLE ADD COLUMN 在旧 MySQL 不支持 IF NOT EXISTS，忽略重复列
        if (err.code === 'ER_DUP_FIELDNAME') continue
        console.warn(`[Migration] ${file}: ${err.message}`)
      }
    }
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

const corsOrigins = config.ALLOWED_ORIGINS
  ? config.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
  : [config.FRONTEND_URL]
app.use(cors({ origin: corsOrigins, credentials: true }))
app.use(cookieParser())
app.use(express.json({ limit: '1mb' }))

// API routes
app.use('/api/auth', authRoutes)
app.use('/api/progress', progressRoutes)
app.use('/api/wordbooks', wordbookRoutes)
app.use('/api/favorites', favoritesRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/migrate', migrateRoutes)
app.use('/api/review', reviewRoutes)
app.use('/api/demo', demoRoutes)
app.use('/api/client-error', clientErrorRoutes)

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
