// 主题白名单（单一事实来源，服务端侧）。
// 前端另有两份定义无法共享：index.html 的主题引导内联脚本必须在模块加载前执行（防闪烁），
// src/hooks/useUserConfig.js 在浏览器 bundle 内 —— 改主题时三处需人工同步。
// 暗夜（gray）已下线：存量用户存的 gray 由前端白名单统一回落 light，服务端不再接受该值。
const VALID_THEMES = ['light', 'warm']

module.exports = { VALID_THEMES }
