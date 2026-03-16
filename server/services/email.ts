import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'noreply@theaiexpert.ai'

interface SendMagicLinkOptions {
  email: string
  token: string
  name: string
}

export async function sendMagicLink({ email, token, name }: SendMagicLinkOptions): Promise<void> {
  const firstName = name.split(' ')[0]
  const baseUrl = process.env.MAGIC_LINK_BASE_URL?.replace('/api/auth/verify', '') || 'https://cpo-connect-hub.onrender.com'
  const link = `${process.env.MAGIC_LINK_BASE_URL}?token=${token}`
  const logoUrl = `${baseUrl}/apple-touch-icon.png`

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sign in to CPO Connect</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f4f4f7;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1a1a2e;
    }
    .wrapper {
      width: 100%;
      background-color: #f4f4f7;
      padding: 40px 0;
    }
    .container {
      max-width: 560px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }
    .header {
      background: #0a0a0a;
      padding: 32px 40px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      color: #ffffff;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.3px;
    }
    .body {
      padding: 40px;
    }
    .body p {
      margin: 0 0 20px;
      font-size: 16px;
      line-height: 1.6;
      color: #374151;
    }
    .btn-wrapper {
      text-align: center;
      margin: 32px 0;
    }
    .btn {
      display: inline-block;
      padding: 14px 36px;
      background: #a855f7;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      letter-spacing: 0.1px;
    }
    .expiry {
      font-size: 14px;
      color: #6b7280;
      text-align: center;
      margin: 0 0 24px;
    }
    .fallback {
      font-size: 13px;
      color: #9ca3af;
      word-break: break-all;
    }
    .fallback a {
      color: #a855f7;
    }
    .footer {
      padding: 24px 40px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 12px;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <img src="${logoUrl}" alt="CPO Connect" width="48" height="48" style="background:#ffffff;border-radius:50%;padding:6px;display:block;margin:0 auto 12px;" />
        <h1>CPO Connect</h1>
      </div>
      <div class="body">
        <p>Hi ${firstName},</p>
        <p>Click the button below to sign in to CPO Connect. This link is valid for <strong>15 minutes</strong>.</p>
        <div class="btn-wrapper">
          <a href="${link}" class="btn">Sign in to CPO Connect</a>
        </div>
        <p class="expiry">This link expires in 15 minutes and can only be used once.</p>
        <p class="fallback">
          If the button doesn't work, copy and paste this link into your browser:<br />
          <a href="${link}">${link}</a>
        </p>
      </div>
      <div class="footer">
        <strong>CPO Connect</strong> — The peer network for senior product leaders<br />
        Free forever. No paywalls. No upsells.<br /><br />
        If you didn't request this email, you can safely ignore it.
      </div>
    </div>
  </div>
</body>
</html>`

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Sign in to CPO Connect',
    html,
  })

  if (error) {
    throw new Error(`Failed to send magic link email: ${error.message}`)
  }
}
