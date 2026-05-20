const STORAGE_KEYS = {
  persona: 'lingoforge_ai_persona',
  position: 'lingoforge_ai_position',
  messages: 'lingoforge_ai_messages',
}

export const PERSONAS = [
  {
    key: 'english-tutor',
    name: '英语导师',
    avatar: '🎓',
    systemPrompt: '你是一位耐心的英语学习导师。用户正在使用一个打字练习应用学习英语。帮助用户理解词汇、语法和用法。用中文解释，给出英文例句。回答简洁明了。',
  },
  {
    key: 'grammar-expert',
    name: '语法专家',
    avatar: '📖',
    systemPrompt: '你是一位英语语法专家。用户会给你英文句子或语法问题，你需要纠正错误并解释语法规则。用中文解释，保留英文例句。回答简洁。',
  },
  {
    key: 'free-chat',
    name: '自由对话',
    avatar: '💬',
    systemPrompt: '你是一位友好的对话伙伴。可以用中文或英文自由聊天。当用户用英文时，温和地纠正语法错误。保持对话自然轻松。',
  },
  {
    key: 'scene-sim',
    name: '场景模拟',
    avatar: '🎭',
    systemPrompt: '你擅长模拟各种英语对话场景，如餐厅点餐、机场、面试、购物等。与用户进行角色扮演对话，在对话中帮助用户练习实用英语。每次只说一小段，等用户回复。',
  },
]

export function getPersona() {
  const saved = localStorage.getItem(STORAGE_KEYS.persona)
  if (saved && PERSONAS.some(p => p.key === saved)) return saved
  return PERSONAS[0].key
}

export function setPersona(key) {
  localStorage.setItem(STORAGE_KEYS.persona, key)
}

export function getPosition() {
  const saved = localStorage.getItem(STORAGE_KEYS.position)
  if (saved) {
    try { return JSON.parse(saved) } catch { /* ignore */ }
  }
  return { x: window.innerWidth - 80, y: window.innerHeight - 140 }
}

export function setPosition(pos) {
  localStorage.setItem(STORAGE_KEYS.position, JSON.stringify(pos))
}

const MAX_MESSAGES = 100

export function getMessages() {
  const saved = localStorage.getItem(STORAGE_KEYS.messages)
  if (saved) {
    try { return JSON.parse(saved) } catch { /* ignore */ }
  }
  return []
}

export function setMessages(messages) {
  const trimmed = messages.length > MAX_MESSAGES
    ? messages.slice(-MAX_MESSAGES)
    : messages
  localStorage.setItem(STORAGE_KEYS.messages, JSON.stringify(trimmed))
}

export function clearMessages() {
  localStorage.removeItem(STORAGE_KEYS.messages)
}
