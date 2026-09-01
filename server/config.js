// env 分离（向后兼容）：优先读 server/.env（服务端密钥独占、不进前端视野），
// 不存在则回退仓库根 .env.local（历史布局：本地开发前后端变量混放一文件）。
// 生产机沿用 /home/lingoforge/.env.local 手工维护的副本（rsync 排除该文件，不会被部署覆盖）。
// dotenv 不覆盖已存在的环境变量 —— 部署平台注入的 env 优先级最高。
const path = require('path')
const fs = require('fs')
const serverEnv = path.resolve(__dirname, '.env')
const rootEnvLocal = path.resolve(__dirname, '../.env.local')
require('dotenv').config({ path: fs.existsSync(serverEnv) ? serverEnv : rootEnvLocal })

module.exports = {
  PORT: process.env.PORT || 3001,
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT, 10) || 3306,
  DB_USER: process.env.DB_USER || 'root',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DB_NAME: process.env.DB_NAME || 'lingoforge',
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || '',
  DEEPSEEK_API_BASE: process.env.DEEPSEEK_API_BASE || 'https://api.deepseek.com',
  DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
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
