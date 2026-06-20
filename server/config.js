require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') })

module.exports = {
  PORT: process.env.PORT || 3001,
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT, 10) || 3306,
  DB_USER: process.env.DB_USER || 'root',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DB_NAME: process.env.DB_NAME || 'lingoforge',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || '',
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: process.env.JWT_SECRET,
  // 缩短 access 有效期：过期后前端自动用 refresh 续期（middleware 返回 TOKEN_EXPIRED，api.js 自动刷新），用户无感
  JWT_ACCESS_EXPIRES: process.env.JWT_ACCESS_EXPIRES || '30m',
  JWT_REFRESH_EXPIRES: process.env.JWT_REFRESH_EXPIRES || '7d',
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
  LOGIN_RATE_LIMIT_WINDOW: 15 * 60 * 1000,
  LOGIN_RATE_LIMIT_MAX: 5,
  REGISTER_RATE_LIMIT_WINDOW: 60 * 60 * 1000,
  REGISTER_RATE_LIMIT_MAX: 3,
  // 每个账号允许同时登录的设备上限，第 N+1 台登录直接拒绝
  MAX_DEVICES_PER_USER: parseInt(process.env.MAX_DEVICES_PER_USER, 10) || 2,
}
