// 主题白名单（单一事实来源，服务端侧）。
// 前端另有两份定义无法共享：index.html 的主题引导内联脚本必须在模块加载前执行（防闪烁），
// src/hooks/useUserConfig.js 在浏览器 bundle 内 —— 改主题时三处需人工同步。
const VALID_THEMES = ['light', 'gray', 'warm']

module.exports = { VALID_THEMES }
