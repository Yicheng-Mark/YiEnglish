const pino = require('pino')

// 生产（pm2）输出 JSON 行，便于日志聚合与 grep；开发环境开启 pretty 提升可读性。
// 不在生产开 transport —— 独立 worker 线程带来性能开销，pm2 收集原始 JSON 行即可。
const isDev = process.env.NODE_ENV !== 'production'

const logger = pino(
  isDev
    ? {
        level: process.env.LOG_LEVEL || 'info',
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
        },
      }
    : {
        level: process.env.LOG_LEVEL || 'info',
      }
)

module.exports = logger
