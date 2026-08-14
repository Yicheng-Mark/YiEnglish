const config = require('../config')

/**
 * SSE proxy to DeepSeek API.
 * Streams response chunks to the Express response object.
 * Returns a Promise resolving with { fullText, reasoningText } after streaming completes.
 */
async function streamChatToRes(apiMessages, res) {
  const apiKey = config.DEEPSEEK_API_KEY
  if (!apiKey) {
    throw new Error('未配置 DEEPSEEK_API_KEY')
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })

  let fullText = ''
  let reasoningText = ''

  try {
    const response = await fetch(`${config.DEEPSEEK_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.DEEPSEEK_MODEL,
        stream: true,
        messages: apiMessages,
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      let errMsg = `DeepSeek API 错误: ${response.status}`
      if (response.status === 401) errMsg = 'API Key 无效'
      if (response.status === 429) errMsg = '请求过于频繁，请稍后再试'
      res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`)
      res.end()
      return { fullText, reasoningText }
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() // keep incomplete line

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue

        const data = trimmed.slice(6)
        if (data === '[DONE]') {
          res.write('data: [DONE]\n\n')
          continue
        }

        try {
          const parsed = JSON.parse(data)
          const delta = parsed.choices?.[0]?.delta
          if (!delta) continue

          // Forward the SSE event to client
          const forwardDelta = {}
          if (delta.content) {
            fullText += delta.content
            forwardDelta.content = delta.content
          }
          if (delta.reasoning_content) {
            reasoningText += delta.reasoning_content
            forwardDelta.reasoning_content = delta.reasoning_content
          }

          if (Object.keys(forwardDelta).length > 0) {
            res.write(`data: ${JSON.stringify({ choices: [{ delta: forwardDelta }] })}\n\n`)
          }
        } catch {
          // skip malformed JSON
        }
      }
    }

    res.end()
  } catch (err) {
    console.error('[DeepSeek Proxy Error]', err.message)
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: err.message }))
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
      res.end()
    }
  }

  return { fullText, reasoningText }
}

module.exports = { streamChatToRes }
