// 迁移 SQL 逐句切分（纯函数，抽自 index.js runMigrations）。
// 朴素 split(';') 会误切 CHECK 约束、INSERT 字面量、PREPARE 内嵌 SQL 等引号内的分号。
// 逐字符扫描，跟踪是否在 '...' 字符串内（'' 视为转义引号而非结束），仅在外层 ';' 处断句；
// 随后剔除 -- 注释行（不动字符串内的 --）、过滤 USE 语句与空语句，保持语句顺序。
function splitSqlStatements(sql) {
  const statements = []
  let buf = ''
  let inStr = false
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i]
    buf += ch
    if (ch === "'") {
      // 连续两个单引号 = 转义字面引号（''），不算字符串结束
      if (inStr && sql[i + 1] === "'") {
        buf += sql[i + 1]
        i++
        continue
      }
      inStr = !inStr
    } else if (ch === ';' && !inStr) {
      // 引号外分号 = 语句边界；把缓冲里的整段（含分号）交给清洗
      statements.push(buf)
      buf = ''
    }
  }
  if (buf.trim()) statements.push(buf)
  return statements
    .map((s) =>
      s
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
        .trim()
    )
    .filter((s) => s && !s.startsWith('USE '))
    .map((s) => (s.endsWith(';') ? s.slice(0, -1).trim() : s))
    .filter(Boolean)
}

module.exports = splitSqlStatements
