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
  // 连接保活：防止空闲连接被 MySQL wait_timeout 关闭后复用触发 EPIPE/PROTOCOL_CONNECTION_LOST
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000, // 连接建立 10s 后开启 TCP keepalive 探测
  // 连接建立超时：避免 DB 抖动时空等过久（mysql2 pool 无 acquireTimeout 选项，
  // 连接获取由 waitForConnections + queueLimit 控制队列等待）
  connectTimeout: 10000, // 新建连接握手超时（ms）
})

module.exports = pool
