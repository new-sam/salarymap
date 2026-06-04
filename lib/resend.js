import { Resend } from 'resend'

// Lazy singleton — instantiated on first use so a missing key doesn't crash imports.
let client = null
function getClient() {
  const key = (process.env.RESEND_API_KEY || '').trim()
  if (!key) throw new Error('RESEND_API_KEY not set')
  if (!client) client = new Resend(key)
  return client
}

// Sends the 6-digit company-email verification code.
export async function sendVerificationCode(email, code) {
  const from = (process.env.RESEND_FROM || '').trim()
  if (!from) throw new Error('RESEND_FROM not set')

  const { error } = await getClient().emails.send({
    from,
    to: email,
    subject: `SalaryMap 회사 인증 코드: ${code}`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="margin:0 0 8px;font-size:20px;color:#111">회사 이메일 인증</h2>
        <p style="margin:0 0 24px;font-size:14px;color:#555">아래 인증 코드를 입력해 회사 인증을 완료하세요.</p>
        <div style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;padding:20px;background:#f3f4f6;border-radius:12px;color:#111">${code}</div>
        <p style="margin:24px 0 0;font-size:12px;color:#999">이 코드는 10분간 유효합니다. 본인이 요청하지 않았다면 무시하세요.</p>
      </div>
    `,
  })
  if (error) throw new Error(error.message || 'email send failed')
}
