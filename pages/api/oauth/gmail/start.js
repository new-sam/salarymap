import { google } from 'googleapis'

// 발신자 연동 시작 — 이 URL 을 DM 으로 보내면, 상대가 클릭 → Google 동의 → /callback 으로 토큰 저장.
// 예: https://salary-fyi.com/api/oauth/gmail/start?email=younghun@likelion.net
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose', // 초안(draft) 생성용
  'https://www.googleapis.com/auth/gmail.settings.basic',
  'https://www.googleapis.com/auth/gmail.readonly',
]

export default function handler(req, res) {
  const base = process.env.OAUTH_BASE || 'https://salary-fyi.com'
  const client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    `${base}/api/oauth/gmail/callback`,
  )
  const url = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    login_hint: req.query.email || undefined,
  })
  res.redirect(url)
}
