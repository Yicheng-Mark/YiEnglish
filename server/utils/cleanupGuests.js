// 过期访客清理：试用到期超过 RETAIN_DAYS 天的访客账号整行删除。
// users 行删除经各表 FK ON DELETE CASCADE 级联清掉 refresh_tokens / trial_activations /
// 学习数据（word_progress 等 11 张表全部 CASCADE）——访客数据无保留价值，30 天窗口留排障。
// 统计口径不受影响（本来就排除 is_guest=1）。
const pool = require('../db')
const logger = require('./logger')

const RETAIN_DAYS = 30

async function cleanupExpiredGuests() {
  const [result] = await pool.execute(
    `DELETE FROM users WHERE is_guest = 1 AND id IN (
       SELECT user_id FROM trial_activations
       WHERE expires_at < DATE_SUB(NOW(), INTERVAL ${RETAIN_DAYS} DAY))`
  )
  if (result.affectedRows > 0) {
    logger.info({ removed: result.affectedRows }, '[guest cleanup] expired guests removed')
  }
  return result.affectedRows
}

module.exports = { cleanupExpiredGuests, RETAIN_DAYS }
