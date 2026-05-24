function authMiddleware(req, res, next) {
  req.userId = 1
  next()
}

module.exports = authMiddleware
