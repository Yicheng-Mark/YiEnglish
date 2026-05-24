const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

export function createChatStream({ messages, styleKey, onToken, onReasoning, onDone, onError }) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120000)

  const headers = {
    'Content-Type': 'application/json',
  }

  fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      messages: messages.filter(m => m.role !== 'system'),
      styleKey,
    }),
    signal: controller.signal,
  })
    .then(async (res) => {
      clearTimeout(timeout)

      if (!res.ok) {
        const body = await res.text().catch(() => '')
        let errMsg = `请求失败 (${res.status})`
        try {
          const json = JSON.parse(body)
          errMsg = json.error || errMsg
        } catch { /* use default */ }
        throw new Error(errMsg)
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

            // Handle error events from backend
            if (json.error) {
              onError(new Error(json.error))
              return
            }

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
      clearTimeout(timeout)
      if (err.name === 'AbortError') {
        onError(new Error('请求超时，请检查网络后重试'))
        return
      }
      onError(err)
    })

  return {
    abort: () => {
      clearTimeout(timeout)
      controller.abort()
    },
  }
}
