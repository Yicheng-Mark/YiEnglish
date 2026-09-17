// 管理员闸：挂在 authMiddleware 之后。每请求查库验证 is_admin——不嵌入 JWT，
// 权限授予/收回即时生效，不依赖 access token 过期（30 分钟窗口）；管理流量低，
// 一次主键查询成本可忽略。
// 非 admin 统一 404：不向未授权者暴露管理端点的存在（防探测，与 demo /upgrade 410 同思路）。
const pool = require('../db')

async function requireAdmin(req, res, next) {
  try {
    const [rows] = await pool.execute('SELECT is_admin FROM users WHERE id = ?', [req.userId])
    if (rows.length === 0 || !rows[0].is_admin) {
      return res.status(404).json({ error: 'Not found' })
    }
    next()
  } catch (err) {
    next(err)
  }
}

module.exports = requireAdmin
