// 콜드아웃리치 공용 — env 로딩, Supabase/OpenAI 클라이언트, Gmail(OAuth) 발송.
// 발송 주체는 wsj@likelion.net (내 지메일함). Resend 아님.
import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { readFileSync } from 'node:fs'

export const env = Object.fromEntries(
  readFileSync(new URL('../../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] })
)

export const SENDER = env.GMAIL_SENDER || 'wsj@likelion.net'
export const SENDER_NAME = env.GMAIL_SENDER_NAME || 'LIKELION'
export const TRACK_BASE = env.OUTREACH_TRACK_BASE || 'https://salary-fyi.com'
export const pixelUrl = (id) => `${TRACK_BASE}/api/o/${id}`
export const OAUTH_REDIRECT = 'http://localhost:3737/oauth2callback'
export const GMAIL_SCOPE = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.settings.basic', // 내 Gmail 서명 읽기
  'https://www.googleapis.com/auth/gmail.readonly',       // 회신 감지(스레드 읽기)
]

export const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
export const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY })

export function oauthClient() {
  const c = new google.auth.OAuth2(env.GMAIL_CLIENT_ID, env.GMAIL_CLIENT_SECRET, OAUTH_REDIRECT)
  if (env.GMAIL_REFRESH_TOKEN) c.setCredentials({ refresh_token: env.GMAIL_REFRESH_TOKEN })
  return c
}

// 발신자(owner)별 설정 — 발송 계정·표시이름·캠페인·서명 직함치환
export const OWNERS = {
  wsj: {
    key: 'wsj', sender: 'wsj@likelion.net', name: '위승주',
    campaign: 'kocham_2026',
    sigReplace: [/AI PM Intern/g, 'AI Product Manager'], // 콜드메일 한정 직함
  },
  younghun: {
    key: 'younghun', sender: 'younghun@likelion.net', name: '남영훈',
    campaign: 'younghun_2026',
    sigReplace: null,
  },
}
export const resolveOwner = (name) => OWNERS[name] || OWNERS.wsj

// refresh token: gmail_oauth_tokens(DB) 우선, 없으면 env(로컬 wsj 폴백)
async function refreshTokenFor(owner) {
  const { data } = await sb.from('gmail_oauth_tokens').select('refresh_token').eq('email', owner.sender).maybeSingle()
  return data?.refresh_token || env.GMAIL_REFRESH_TOKEN
}

// owner 계정으로 인증된 OAuth 클라이언트
export async function ownerClient(owner) {
  const c = new google.auth.OAuth2(env.GMAIL_CLIENT_ID, env.GMAIL_CLIENT_SECRET, OAUTH_REDIRECT)
  c.setCredentials({ refresh_token: await refreshTokenFor(owner) })
  return c
}

// 코참 포맷 "ENGLISH ( 한글 )" → { en, ko } (중첩괄호 대비 균형매칭)
export function splitName(s) {
  s = (s || '').trim()
  if (!s) return { en: '', ko: '' }
  if (s.endsWith(')')) {
    let d = 0
    for (let i = s.length - 1; i >= 0; i--) {
      if (s[i] === ')') d++
      else if (s[i] === '(') { d--; if (d === 0) {
        const b = s.slice(0, i).trim(), inn = s.slice(i + 1, -1).trim()
        return /[가-힣]/.test(inn) ? { en: b, ko: inn } : { en: b || inn, ko: '' }
      } }
    }
  }
  return /[가-힣]/.test(s) ? { en: '', ko: s } : { en: s, ko: '' }
}

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64')
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Gmail 설정(sendAs) 서명(HTML) 조회 — owner별 1회 캐시. owner.sigReplace 로 직함 치환.
const _sigCache = {}
export async function getSignature(owner) {
  if (_sigCache[owner.key] !== undefined) return _sigCache[owner.key]
  try {
    const gmail = google.gmail({ version: 'v1', auth: await ownerClient(owner) })
    const { data } = await gmail.users.settings.sendAs.get({ userId: 'me', sendAsEmail: owner.sender })
    let sig = data.signature || ''
    if (owner.sigReplace) sig = sig.replace(owner.sigReplace[0], owner.sigReplace[1])
    _sigCache[owner.key] = sig
  } catch (e) { _sigCache[owner.key] = ''; console.warn('⚠️ Gmail 서명 조회 실패:', e.message) }
  return _sigCache[owner.key]
}

// 본문(플레인) + 수신거부 + 내 Gmail 서명(HTML) → 최종 HTML
export function composeHtml(bodyText, signatureHtml, pixel) {
  const body = esc(bodyText).replace(/\n/g, '<br>')
  return `<div style="font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:14px;line-height:1.7;color:#222">`
    + body
    + (signatureHtml ? `<br><br>${signatureHtml}` : '')
    + (pixel ? `<img src="${pixel}" width="1" height="1" alt="" style="display:none">` : '')
    + `</div>`
}

// Gmail API 발송 (owner 계정으로, html 있으면 HTML)
export async function sendMail(owner, { to, subject, html, text }) {
  const gmail = google.gmail({ version: 'v1', auth: await ownerClient(owner) })
  const isHtml = !!html
  const raw = Buffer.from([
    `From: =?UTF-8?B?${b64(owner.name)}?= <${owner.sender}>`,
    `To: ${to}`,
    `Reply-To: ${owner.sender}`,
    `Subject: =?UTF-8?B?${b64(subject)}?=`,
    'MIME-Version: 1.0',
    `Content-Type: text/${isHtml ? 'html' : 'plain'}; charset="UTF-8"`,
    'Content-Transfer-Encoding: base64',
    '',
    b64(isHtml ? html : text),
  ].join('\r\n')).toString('base64url')
  const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })
  return res.data
}
