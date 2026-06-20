function errorHandler(err, req, res, _next) {
  console.error('[Error]', err.message || err)
  const status = err.status || 500
  // 5xx 不回传内部错误细节（SQL 报错/栈片段等），仅记录服务端日志，防止信息泄漏
  if (status >= 500) {
    return res.status(status).json({ error: '服务器内部错误，请稍后再试' })
  }
  const message = err.message || '请求处理失败'
  res.status(status).json({ error: message })
}

module.exports = errorHandler
