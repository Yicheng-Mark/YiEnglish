const config = require('../config')

/**
 * SSE proxy to DeepSeek API.
 * Streams response chunks to the Express response object.
 * Returns a Promise resolving with { fullText, reasoningText, failed }
 * after streaming completes. failed=true 表示上游返回非 2xx 或流式中断
 * （超时/网络错误），调用方不应把这次请求计入用户额度。
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
  let failed = false

  // 客户端断开时中止上游请求：不再继续消耗 DeepSeek token
  const controller = new AbortController()
  const onClientClose = () => {
    if (!res.writableEnded) controller.abort()
  }
  res.on('close', onClientClose)

  // 空闲超时：连续 30s 收不到上游数据才判定卡死并中止。
  // 不用整体超时——长回答的正常流式输出总时长可能超过 30s，
  // 整体超时会把正常回复说到一半掐断
  const IDLE_TIMEOUT_MS = 30 * 1000
  let idleTimer = null
  const renewIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = setTimeout(() => controller.abort(), IDLE_TIMEOUT_MS)
  }

  try {
    renewIdleTimer()
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
      signal: controller.signal,
    })
    renewIdleTimer()

    if (!response.ok) {
      let errMsg = `DeepSeek API 错误: ${response.status}`
      if (response.status === 401) errMsg = 'API Key 无效'
      if (response.status === 429) errMsg = '请求过于频繁，请稍后再试'
      // 释放响应体连接：不读不取消的话 undici 连接要等 GC 才归还，持续 429 时会耗尽 socket
      await response.body?.cancel?.().catch(() => {})
      res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`)
      res.end()
      return { fullText, reasoningText, failed: true }
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      renewIdleTimer()
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
    failed = true
    const msg = controller.signal.aborted ? '请求超时或连接已中断' : err.message
    console.error('[DeepSeek Proxy Error]', msg)
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: msg }))
    } else if (!res.writableEnded && !res.destroyed) {
      // 客户端已断开（destroyed）时不再写响应，避免写已关闭的 socket
      res.write(`data: ${JSON.stringify({ error: msg })}\n\n`)
      res.end()
    }
  } finally {
    if (idleTimer) clearTimeout(idleTimer)
    res.off('close', onClientClose)
  }

  return { fullText, reasoningText, failed }
}

module.exports = { streamChatToRes }
