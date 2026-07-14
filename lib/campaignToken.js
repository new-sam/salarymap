import crypto from 'crypto'

// 콜드메일 원클릭 링크용 무상태 토큰 — user_id를 HMAC 서명해 링크에 실는다.
// 서버만 아는 시크릿으로 위조 방지(로그인 없이 공개 전환을 authorize). 저장 불필요.
const SECRET = process.env.RESUME_PUBLIC_TOKEN_SECRET || process.env.GOAL_METRICS_PASSWORD || 'wsj11029-resume-public'

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const sign = (payload) => b64url(crypto.createHmac('sha256', SECRET).update(payload).digest())

// 캠페인 태그를 넣어 여러 캠페인을 구분(기본 'coldmail1').
export function makeToken(userId, campaign = 'coldmail1') {
  const payload = `${userId}.${campaign}`
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
  const sep = payload.indexOf('.')
  if (sep < 0) return null
  return { userId: payload.slice(0, sep), campaign: payload.slice(sep + 1) }
}
