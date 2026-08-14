// AI 助手为正式账号功能：体验用户（is_guest=1）直接 403
// 前端依据 403 + code:TRIAL_FORBIDDEN 识别（lib/ai-settings.js fetchChatUsage）
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
