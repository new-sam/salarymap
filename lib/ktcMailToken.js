import crypto from 'crypto'

// KTC 지원자(= FYI 계정 없음) 콜드메일용 무상태 토큰 — 이메일을 HMAC 서명해 링크에 실는다.
// lib/campaignToken.js 를 못 쓰는 이유: payload 를 '.' 로 쪼개는데 이메일에 점이 들어가 파싱이 깨진다.
// 그래서 여기선 '|' 로 나눈다. 시크릿은 campaignToken 과 같은 이유로 소스 리터럴 기본값을 둔다
// (링크는 로컬 스크립트가 서명하고 prod 서버가 검증하므로 양쪽이 반드시 같아야 함).
const SECRET = process.env.RESUME_PUBLIC_TOKEN_SECRET || 'wsj11029-resume-public'

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const sign = (payload) => b64url(crypto.createHmac('sha256', SECRET).update(payload).digest())
const norm = (email) => String(email || '').trim().toLowerCase()

// events 에 남길 사람 식별자 — 이메일 원문 대신 해시 앞 16자를 쓴다(events 는 클라이언트도 쓰는
// 테이블이라 PII 를 남기지 않는다). 발송·클릭 양쪽에 같은 값을 남겨 대조한다.
export function leadId(email) {
  return crypto.createHmac('sha256', SECRET).update(`lead:${norm(email)}`).digest('hex').slice(0, 16)
}

export function makeToken(email, campaign = 'coldmail-ktc') {
  const payload = `${norm(email)}|${campaign}`
  return `${b64url(payload)}.${sign(payload)}`
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null
  const dot = token.lastIndexOf('.')
  if (dot < 0) return null
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  let payload
  try { payload = Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString() } catch { return null }
  if (sign(payload) !== sig) return null
  const sep = payload.indexOf('|')
  if (sep < 0) return null
  return { email: payload.slice(0, sep), campaign: payload.slice(sep + 1) }
}
