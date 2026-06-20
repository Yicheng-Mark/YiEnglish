// 极简限流器（默认纯内存 Map）。
//
// 【key 维度】按客户端 IP；windowMs 窗口内超过 max 次则返回 429。
//
// 【部署约束 · 重要】memory driver 仅在「单实例」下成立：
//   - 单实例 PM2（fork mode）/ 单容器：计数准确。
//   - PM2 cluster mode（多 worker）、K8s/多容器副本、Vercel serverless 等「多实例」场景下，
//     每个实例各自维护一份 Map，实际配额会被放大为 max × 实例数，限流形同失效。
//   - 横向扩展前，必须切换到 driver='redis' 后端（见 createRateLimiter 的 driver 参数），
//     在共享存储中做原子计数，才能恢复真正的全局限流。
//   - 重启进程会重置内存计数（限流本就是短期保护，可接受）；Redis 后端则不受重启影响。
//
function createRateLimiter({
  windowMs,
  max,
  message = '请求过于频繁，请稍后再试',
  driver = 'memory',
  redis, // driver='redis' 时传入已建立的 redis 客户端（如 ioredis 实例）；memory driver 忽略
}) {
  if (driver === 'redis') {
    // 预留接口，暂不实现，避免误用导致多实例下假性限流。
    void redis // 预留：driver='redis' 时使用的客户端实例；当前未实现，显式标记避免 lint 误报
    //
    // 未来实现要点（二选一）：
    //   1) 固定窗口（最简单）：每个窗口一个 key，INCR 后用 EXPIRE 保证过期。
    //        INCR ratelimit:<route>:<ip>:<windowStart>  -> n
    //        EXPIRE ratelimit:<route>:<ip>:<windowStart> windowMs/1000
    //        n > max 即拒绝。注意 INCR + EXPIRE 非原子时首次 INCR 才设置 EXPIRE（n===1）。
    //   2) 滑动窗口（更平滑）：用 Lua 脚本在 Redis 侧原子完成 ZREMRANGEBYSCORE + ZADD + ZCARD。
    //   还需把本中间件改为异步（async function + await redis...），Express 5 / promise 中间件即可。
    throw new Error(
      'Redis 限流尚未实现，当前请使用 memory driver；横向扩展时补齐（见 apiRateLimit.js 顶部说明）'
    )
  }

  // ---- memory driver（默认，行为与历史版本完全一致）----
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
