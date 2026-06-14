// 单词打字用规范化名称：连字符 → 空格。
// 移动端软键盘主面板没有连字符键（藏在符号子面板里），用户无法输入；
// 同时输入代理（Typing.handleInputChange）会过滤掉非字母字符，连字符根本到不了比对逻辑。
// 复合词（如 pencil-box / ice-cream / good-bye）改用空格，空格在主面板可直接输入。
// 仅用于「显示」和「打字比对」，原始 name（错误本/收藏/进度/发音）保持不变。
export function normalizeWordName(name) {
  return (name || '').replace(/-/g, ' ');
}
