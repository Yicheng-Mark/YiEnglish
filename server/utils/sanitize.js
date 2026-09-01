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

module.exports = { clampStr, toValidDate, toTransJson, clampNum }
