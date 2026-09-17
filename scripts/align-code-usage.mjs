/**
 * 体验码/激活码使用计数对齐（一次性数据卫生工具）
 *
 * 背景：current_uses 与权威事实表可能漂移（生产曾出现 trial 码 current_uses=1
 * 但 trial_activations 已清空的偏差——清理时只删了激活记录没回调计数）。
 * 权威口径：
 *   trial 码      current_uses 应 = COUNT(trial_activations WHERE code_id)
 *   activation 码 current_uses 应 = COUNT(users WHERE activation_code_id)
 *
 * 用法：
 *   node scripts/align-code-usage.mjs            # dry-run，只打印差异
 *   node scripts/align-code-usage.mjs --apply    # 实际修正
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import mysql from 'mysql2/promise'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

// 环境加载对齐 server/config.js：优先 server/.env，回退根 .env.local；已存在的环境变量优先
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return false
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
  return true
}
if (!loadEnvFile(path.join(ROOT, 'server/.env'))) loadEnvFile(path.join(ROOT, '.env.local'))

const apply = process.argv.includes('--apply')

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'lingoforge',
})

const [rows] = await pool.query(`
  SELECT ec.id, ec.code, ec.type, ec.current_uses,
         (SELECT COUNT(*) FROM trial_activations t WHERE t.code_id = ec.id) AS trial_count,
         (SELECT COUNT(*) FROM users u WHERE u.activation_code_id = ec.id) AS reg_count
  FROM experience_codes ec
`)

const diffs = []
for (const r of rows) {
  const expected = r.type === 'trial' ? Number(r.trial_count) : Number(r.reg_count)
  if (Number(r.current_uses) !== expected) {
    diffs.push({ id: r.id, code: r.code, type: r.type, current: Number(r.current_uses), expected })
  }
}

if (diffs.length === 0) {
  console.log(`OK: 全部 ${rows.length} 个码的 current_uses 与事实表一致，无需修正`)
} else {
  console.log(`发现 ${diffs.length} / ${rows.length} 个码计数漂移：`)
  for (const d of diffs) {
    console.log(`  [${d.type}] ${d.code}: current_uses ${d.current} → ${d.expected}`)
  }
  if (apply) {
    for (const d of diffs) {
      await pool.execute('UPDATE experience_codes SET current_uses = ? WHERE id = ?', [
        d.expected,
        d.id,
      ])
    }
    console.log(`已修正 ${diffs.length} 个码`)
  } else {
    console.log('dry-run：加 --apply 执行修正')
  }
}

await pool.end()
