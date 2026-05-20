const API_URL = 'https://api.deepseek.com/chat/completions'

function getApiKey() {
  return import.meta.env.VITE_DEEPSEEK_API_KEY || ''
}

export function createChatStream({ messages, onToken, onReasoning, onDone, onError }) {
  const apiKey = getApiKey()
  if (!apiKey) {
    onError(new Error('未配置 API Key'))
    return { abort: () => {} }
  }

  const controller = new AbortController()

  fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      stream: true,
    }),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        if (res.status === 401) throw new Error('API Key 无效')
        if (res.status === 429) throw new Error('请求过于频繁，请稍后再试')
        throw new Error(`请求失败 (${res.status}): ${body.slice(0, 100)}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue
          const data = trimmed.slice(6)
          if (data === '[DONE]') {
            onDone()
            return
          }

          try {
            const json = JSON.parse(data)
            const delta = json.choices?.[0]?.delta
            if (!delta) continue

            if (delta.reasoning_content) {
              onReasoning(delta.reasoning_content)
            }
            if (delta.content) {
              onToken(delta.content)
            }
          } catch {
            // skip malformed chunks
          }
        }
      }

      onDone()
    })
    .catch((err) => {
      if (err.name === 'AbortError') return
      onError(err)
    })

  return {
    abort: () => controller.abort(),
  }
}
