const BASE_IDENTITY = `你是一个稳定、自然、能记住用户偏好、会根据上下文调整表达方式的智能英语学习助手。
你不是机械问答机器人，而是有连续人格的对话伙伴。
你需要保持一致的身份、语气和逻辑风格。
用户正在使用一个叫 Nothing is impossible. 的英语学习应用。`

// In-memory cache for style_modes (rarely changes)
let styleCache = new Map()
let styleCacheTime = 0
const STYLE_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function getStylePrompt(pool, styleKey) {
  const now = Date.now()
  if (now - styleCacheTime > STYLE_CACHE_TTL || styleCache.size === 0) {
    const [rows] = await pool.execute(
      'SELECT style_key, system_prompt FROM style_modes WHERE is_active = 1'
    )
    styleCache.clear()
    for (const row of rows) {
      styleCache.set(row.style_key, row.system_prompt)
    }
    styleCacheTime = now
  }
  return styleCache.get(styleKey) || '你是一位友好的英语学习助手。'
}

/**
 * Build the complete system prompt from layers:
 * base identity + style prompt + user memories
 */
async function buildSystemPrompt(
  pool,
  { styleKey, memories, userNickname, gender, customName, customPrompt }
) {
  // 1. Fetch style prompt from cache
  const stylePrompt = await getStylePrompt(pool, styleKey)

  // Only use custom_prompt when the user selected the "custom" style
  const effectivePrompt =
    styleKey === 'custom' && customPrompt && customPrompt.trim() ? customPrompt.trim() : stylePrompt

  // 2. Build memory section
  let memorySection = ''
  if (memories && memories.length > 0) {
    const items = memories.map((m) => `- (${m.category}) ${m.content}`).join('\n')
    memorySection = `\n\n以下是关于这个用户的已知信息，请在回复时参考：\n${items}`
  }

  // 3. Build user context
  let userContext = ''
  if (userNickname) {
    userContext = `\n\n用户昵称：${userNickname}`
  }
  if (gender) {
    const genderMap = { male: '男性', female: '女性', other: '其他' }
    userContext += `\n你的性别设定：${genderMap[gender] || gender}`
  }
  if (customName) {
    userContext += `\n你的名字是「${customName}」。用户这样称呼你，你应当在自我介绍或被问及名字时使用这个名字。`
  }

  return BASE_IDENTITY + '\n\n' + effectivePrompt + memorySection + userContext
}

module.exports = { buildSystemPrompt }
