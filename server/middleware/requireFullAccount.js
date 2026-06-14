// 阻止体验用户访问需正式账号的接口（AI 助手全部功能）
// 必须挂在 authMiddleware 之后，依赖其设置的 req.isGuest
function requireFullAccount(req, res, next) {
  if (req.isGuest) {
    return res.status(403).json({
      error: 'AI 助手为正式账号功能，体验期间暂不可用',
      code: 'TRIAL_FORBIDDEN',
    })
  }
  next()
}

module.exports = requireFullAccount
