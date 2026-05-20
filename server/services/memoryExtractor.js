/**
 * Heuristic memory extractor.
 * Scans user messages for patterns that indicate long-term preferences/info.
 * Returns an array of { category, content } to save.
 */
function extractMemories(userMessage, _assistantResponse) {
  const memories = []
  const text = userMessage.toLowerCase()

  // Preference patterns
  const preferencePatterns = [
    { regex: /(?:我喜欢|我偏好|我更(?:喜欢|希望|倾向))(.{2,30})/, category: 'preference' },
    { regex: /(?:我不喜欢|我讨厌|别用)(.{2,30})/, category: 'preference_negative' },
    { regex: /(?:简洁|简单|详细|啰嗦)(?:一点|一些|点)/, category: 'response_style' },
    { regex: /(?:我是|I'm a |I am a )(.{2,30})/, category: 'identity' },
    { regex: /(?:我在(?:做|写|开发|学|准备))(.{2,40})/, category: 'project' },
    { regex: /(?:我的(?:名字|英文名|name)是?)\s*(.{1,20})/, category: 'name' },
    { regex: /(?:以后|以后都|以后请)(.{2,40})/, category: 'instruction' },
  ]

  for (const { regex, category } of preferencePatterns) {
    const match = text.match(regex)
    if (match) {
      const content = match[0].trim()
      // Avoid saving very generic matches
      if (content.length >= 4) {
        memories.push({ category, content })
      }
    }
  }

  // Deduplicate: only return unique content
  const seen = new Set()
  return memories.filter(m => {
    if (seen.has(m.content)) return false
    seen.add(m.content)
    return true
  })
}

module.exports = { extractMemories }
