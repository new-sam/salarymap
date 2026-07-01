import { google } from 'googleapis'
import supabaseAdmin from '../../../../lib/supabaseAdmin'

// Google 동의 후 콜백 — code 를 refresh_token 으로 교환하고, 인증한 계정 이메일로 저장.
const page = (title, msg) =>
  `<!doctype html><meta charset="utf-8"><div style="font-family:system-ui,sans-serif;max-width:420px;margin:80px auto;text-align:center;color:#191F28">
   <div style="font-size:40px">${title.startsWith('✅') ? '✅' : '⚠️'}</div>
   <h2 style="margin:12px 0">${title.replace('✅', '').trim()}</h2>
   <p style="color:#4E5968;font-size:14px">${msg}</p></div>`

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  const { code, error } = req.query
  if (error) return res.status(400).send(page('⚠️ 인증 취소', String(error)))
  if (!code) return res.status(400).send(page('⚠️ 오류', 'code 가 없습니다.'))

  try {
    const base = process.env.OAUTH_BASE || 'https://salary-fyi.com'
    const client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      `${base}/api/oauth/gmail/callback`,
    )
    const { tokens } = await client.getToken(code)
    if (!tokens.refresh_token) {
      return res.status(400).send(page('⚠️ 다시 시도 필요',
        'refresh token 이 발급되지 않았습니다. Google 계정 > 보안 > 서드파티 앱에서 기존 권한을 제거한 뒤 다시 링크를 눌러주세요.'))
    }
    client.setCredentials(tokens)
    const gmail = google.gmail({ version: 'v1', auth: client })
    const { data: prof } = await gmail.users.getProfile({ userId: 'me' })
    const email = prof.emailAddress

    const { error: dbErr } = await supabaseAdmin.from('gmail_oauth_tokens').upsert({
      email, refresh_token: tokens.refresh_token, scopes: tokens.scope || '', updated_at: new Date().toISOString(),
    }, { onConflict: 'email' })
    if (dbErr) return res.status(500).send(page('⚠️ 저장 실패', dbErr.message))

    return res.status(200).send(page('✅ 연동 완료', `${email} 계정이 연결됐습니다. 이 창은 닫으셔도 됩니다.`))
  } catch (e) {
    return res.status(500).send(page('⚠️ 토큰 교환 실패', e.message))
  }
}
