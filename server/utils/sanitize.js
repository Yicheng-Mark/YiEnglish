// 路由层共享的输入净化/夹取工具。
// 抽自 wordbooks.js / migrate.js / review.js 的逐行同构实现（行为不变，仅去重）：
//   - clampStr / toValidDate：wordbooks.js 与 migrate.js 原本逐字相同
//   - toTransJson：migrate.js 语义（字符串释义包单元素数组；非字符串/空白 → null）
//   - clampNum：review.js 原版
// 注意 review.js 另有一份「容忍毫秒时间戳」的本地 toValidDate，语义不同，勿强行统一到这里。

// 夹取可选字符串字段：null/非字符串/空串返回 null，超长截断到列宽
// （word_name/notation/us_audio/uk_audio 255、usphone/ukphone 100、dict_name 100）
function clampStr(v, max) {
  if (typeof v !== 'string' || !v) return null
  return v.slice(0, max)
}

// 无效日期返回 null（new Date(垃圾) 是 Invalid Date，mysql2 序列化会抛错）
function toValidDate(v) {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

// MySQL TIMESTAMP 列的安全范围（TIMESTAMP 上限 2038-01-19 03:14:07 UTC，取整日边界）。
// SM-2 连续 q=5 约 10 次即可让 interval 破 9000 天 → next_review 落到 2051 年，
// 超范围值入库触发 out of range → 整批 INSERT 500 且客户端重发永久失败。
const TIMESTAMP_MIN = new Date('1970-01-01T00:00:00.000Z')
const TIMESTAMP_MAX = new Date('2038-01-01T00:00:00.000Z')

// 把已解析的 Date 夹到 TIMESTAMP 列安全范围内（null 原样返回，走调用方各自的 fallback）。
// 边界：早于 1970-01-01 → 1970-01-01；晚于 2038-01-01 → 2038-01-01。
function clampTimestamp(d) {
  if (!d || Number.isNaN(d.getTime())) return d
  if (d.getTime() < TIMESTAMP_MIN.getTime()) return TIMESTAMP_MIN
  if (d.getTime() > TIMESTAMP_MAX.getTime()) return TIMESTAMP_MAX
  return d
}

// trans 列存 JSON 数组字符串：数组原样序列化，非空字符串包成单元素数组
// （老用户本地数据可能是字符串释义，直接丢弃会丢释义），其余 → null
function toTransJson(trans) {
  if (Array.isArray(trans)) return JSON.stringify(trans)
  if (typeof trans === 'string' && trans.trim()) return JSON.stringify([trans])
  return null
}

// 数值列夹取：非数字回退默认值，越界夹到列宽范围内
// （interval_days DECIMAL(6,2)、ease_factor DECIMAL(4,2)、repetitions/last_quality TINYINT UNSIGNED）
function clampNum(v, fallback, min, max) {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

module.exports = { clampStr, toValidDate, clampTimestamp, toTransJson, clampNum }
