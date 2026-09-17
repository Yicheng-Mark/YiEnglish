// 过期访客清理：试用到期超过 RETAIN_DAYS 天的访客账号整行删除。
// users 行删除经各表 FK ON DELETE CASCADE 级联清掉 refresh_tokens / trial_activations /
// 学习数据（word_progress 等 11 张表全部 CASCADE）——访客数据无保留价值，30 天窗口留排障。
// 统计口径不受影响（本来就排除 is_guest=1）。
// 归档：删除会把 trial_activations 行一并级联删掉，同 IP 终身领取上限（demo/redeem 按
// trial_activations.ip 计数）会随之「回血」。删除前先把待删行的 ip 计数 UPSERT 进
// trial_ip_totals（独立于 FK 链，不受 CASCADE 影响）。归档与删除放同一事务：
// 删除失败一并回滚，下轮重来不会重复累加。
const pool = require('../db')
const logger = require('./logger')

const RETAIN_DAYS = 30

async function cleanupExpiredGuests() {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // 归档待删行的 IP 计数（ip 为 NULL 的存量行不参与）
    await conn.execute(
      `INSERT INTO trial_ip_totals (ip, total)
       SELECT ip, COUNT(*) FROM trial_activations
       WHERE ip IS NOT NULL AND expires_at < DATE_SUB(NOW(), INTERVAL ${RETAIN_DAYS} DAY)
       GROUP BY ip
       ON DUPLICATE KEY UPDATE total = total + VALUES(total)`
    )

    const [result] = await conn.execute(
      `DELETE FROM users WHERE is_guest = 1 AND id IN (
         SELECT user_id FROM trial_activations
         WHERE expires_at < DATE_SUB(NOW(), INTERVAL ${RETAIN_DAYS} DAY))`
    )

    await conn.commit()
    if (result.affectedRows > 0) {
      logger.info({ removed: result.affectedRows }, '[guest cleanup] expired guests removed')
    }
    return result.affectedRows
  } catch (err) {
    await conn.rollback().catch(() => {})
    throw err
  } finally {
    conn.release()
  }
}

module.exports = { cleanupExpiredGuests, RETAIN_DAYS }
