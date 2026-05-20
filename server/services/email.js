const config = require('../config')

async function sendEmail({ to, subject, html }) {
  if (!config.RESEND_API_KEY) {
    console.log('[Email] RESEND_API_KEY not set, skipping send to:', to)
    return
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'LingoForge <noreply@lingoforge.com>',
      to,
      subject,
      html,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend error ${res.status}: ${body}`)
  }
}

function codeEmailHtml(code, type) {
  const title = type === 'register' ? '注册验证码' : '密码重置验证码'
  return `
    <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:24px;">
      <h2 style="color:#4f46e5;margin:0 0 16px;">LingoForge - ${title}</h2>
      <p style="font-size:15px;color:#374151;">你的验证码是：</p>
      <p style="font-size:32px;font-weight:700;color:#4f46e5;letter-spacing:4px;margin:8px 0;">${code}</p>
      <p style="font-size:13px;color:#6b7280;">10 分钟内有效，请勿泄露给他人。</p>
    </div>
  `
}

module.exports = { sendEmail, codeEmailHtml }
