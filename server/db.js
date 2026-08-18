const mysql = require('mysql2/promise')
const config = require('./config')

const pool = mysql.createPool({
  host: config.DB_HOST,
  port: config.DB_PORT,
  user: config.DB_USER,
  password: config.DB_PASSWORD,
  database: config.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  // 【时区假设 · 勿盲目改动】各路由用 NOW() 写入 DATETIME、用 new Date('YYYY-MM-DD HH:mm:ss')
  // 本地解析读取，二者一致的前提是 Node 进程与 MySQL 会话处于同一时区。
  // 当前部署为单机同 host（Node + MySQL80 同装一机），假设天然成立。
  // 若未来拆分跨时区部署，必须先统一为 UTC 存储（连接加 timezone: 'Z' 并迁移存量行），
  // 否则试用到期/激活码过期等判断会偏差数小时。
  // 连接保活：防止空闲连接被 MySQL wait_timeout 关闭后复用触发 EPIPE/PROTOCOL_CONNECTION_LOST
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000, // 连接建立 10s 后开启 TCP keepalive 探测
  // 连接建立超时：避免 DB 抖动时空等过久（mysql2 pool 无 acquireTimeout 选项，
  // 连接获取由 waitForConnections + queueLimit 控制队列等待）
  connectTimeout: 10000, // 新建连接握手超时（ms）
})

module.exports = pool
