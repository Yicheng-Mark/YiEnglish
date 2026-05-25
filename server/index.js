const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const path = require('path')
const config = require('./config')
const errorHandler = require('./middleware/errorHandler')
const { cleanupStaleAttempts } = require('./middleware/rateLimit')

if (!config.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set. Refusing to start.')
  process.exit(1)
}

const chatRoutes = require('./routes/chat')
const styleRoutes = require('./routes/style')
const memoryRoutes = require('./routes/memory')
const progressRoutes = require('./routes/progress')
const wordbookRoutes = require('./routes/wordbooks')
const favoritesRoutes = require('./routes/favorites')
const settingsRoutes = require('./routes/settings')
const migrateRoutes = require('./routes/migrate')
const reviewRoutes = require('./routes/review')
const authRoutes = require('./routes/auth')

const app = express()

const corsOrigins = config.ALLOWED_ORIGINS
  ? config.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
  : [config.FRONTEND_URL]
app.use(cors({ origin: corsOrigins, credentials: true }))
app.use(cookieParser())
app.use(express.json({ limit: '1mb' }))

// API routes
app.use('/api/auth', authRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/style', styleRoutes)
app.use('/api/memory', memoryRoutes)
app.use('/api/progress', progressRoutes)
app.use('/api/wordbooks', wordbookRoutes)
app.use('/api/favorites', favoritesRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/migrate', migrateRoutes)
app.use('/api/review', reviewRoutes)

// Serve static frontend in production
const distPath = path.resolve(__dirname, '../dist')
app.use(express.static(distPath))
app.get('{*path}', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

app.use(errorHandler)

app.listen(config.PORT, () => {
  console.log(`Server running on http://localhost:${config.PORT}`)

  // cleanup stale login attempts every 6 hours
  setInterval(cleanupStaleAttempts, 6 * 60 * 60 * 1000)
})
