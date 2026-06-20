// 极简内存限流器：单实例 PM2 下足够；零依赖；重启计数重置（限流本就是短期保护，可接受）。
// key 维度按客户端 IP；windowMs 窗口内超过 max 次则返回 429。
function createRateLimiter({ windowMs, max, message = '请求过于频繁，请稍后再试' }) {
  const hits = new Map()

  // 周期性清理过期条目，防止不同 IP 的残留 entry 造成内存无限增长
  const sweep = () => {
    const now = Date.now()
    for (const [k, v] of hits) {
      if (v.resetAt <= now) hits.delete(k)
    }
  }
  const timer = setInterval(sweep, windowMs)
  if (typeof timer.unref === 'function') timer.unref()

  return function rateLimiter(req, res, next) {
    const key =
      req.ip ||
      (req.headers['x-forwarded-for'] && req.headers['x-forwarded-for'].split(',')[0].trim()) ||
      '127.0.0.1'
    const now = Date.now()
    let entry = hits.get(key)
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs }
      hits.set(key, entry)
    }
    entry.count++
    if (entry.count > max) {
      return res.status(429).json({ error: message })
    }
    next()
  }
}

module.exports = { createRateLimiter }
