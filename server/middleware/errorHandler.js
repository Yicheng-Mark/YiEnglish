function errorHandler(err, req, res, _next) {
  console.error('[Error]', err.message || err)
  const status = err.status || 500
  const message = err.message || '服务器内部错误'
  res.status(status).json({ error: message })
}

module.exports = errorHandler
