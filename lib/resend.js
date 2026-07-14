import { Resend } from 'resend'

// Lazy singleton — instantiated on first use so a missing key doesn't crash imports.
let client = null
function getClient() {
  const key = (process.env.RESEND_API_KEY || '').trim()
  if (!key) throw new Error('RESEND_API_KEY not set')
  if (!client) client = new Resend(key)
  return client
}

// Sends the 6-digit company-email verification code (Vietnamese).
export async function sendVerificationCode(email, code) {
  const from = (process.env.RESEND_FROM || '').trim()
  if (!from) throw new Error('RESEND_FROM not set')

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com').replace(/\/$/, '')
  const ctaUrl = `${siteUrl}/company`

  const { error } = await getClient().emails.send({
    from,
    to: email,
    subject: `Mã xác minh doanh nghiệp FYI: ${code}`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="margin:0 0 8px;font-size:20px;color:#111">Xác minh email doanh nghiệp</h2>
        <p style="margin:0 0 24px;font-size:14px;color:#555">Nhập mã xác minh dưới đây để hoàn tất xác minh doanh nghiệp.</p>
        <div style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;padding:20px;background:#f3f4f6;border-radius:12px;color:#111">${code}</div>
        <p style="margin:24px 0 0;text-align:center">
          <a href="${ctaUrl}" style="background:#ea580c;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:800;display:inline-block">Quay lại FYI để nhập mã →</a>
        </p>
        <p style="margin:24px 0 0;font-size:12px;color:#999">Mã có hiệu lực trong 10 phút. Nếu bạn không yêu cầu, vui lòng bỏ qua email này.</p>
      </div>
    `,
  })
  if (error) throw new Error(error.message || 'email send failed')
}
