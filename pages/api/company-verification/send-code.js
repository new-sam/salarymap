import { createClient } from '@supabase/supabase-js'
import { isFreeDomain } from '../../../lib/freeEmailDomains'
import { sendVerificationCode } from '../../../lib/resend'
import { hashCode, generateCode } from '../../../lib/companyVerifyCode'

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'unauthorized' })
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'unauthorized' })

  const email = (req.body?.email || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'invalid_email', message: '올바른 이메일을 입력해주세요.' })
  }
  const domain = email.split('@')[1]
  if (isFreeDomain(domain)) {
    return res.status(400).json({ error: 'free_email', message: '개인 이메일은 사용할 수 없습니다. 회사 또는 학교 이메일을 입력해주세요.' })
  }

  // One work email can verify only one account.
  const { data: claimed } = await supabase
    .from('company_email_verifications')
    .select('user_id')
    .eq('email', email)
    .not('verified_at', 'is', null)
    .maybeSingle()
  if (claimed && claimed.user_id !== user.id) {
    return res.status(409).json({ error: 'email_taken', message: '이미 다른 계정에서 인증된 이메일입니다.' })
  }

  // Rate limit: max 1/min and 5/hour per user.
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { data: recent } = await supabase
    .from('company_email_verifications')
    .select('created_at')
    .eq('user_id', user.id)
    .gte('created_at', hourAgo)
    .order('created_at', { ascending: false })
  if (recent && recent.length >= 5) {
    return res.status(429).json({ error: 'rate_limited', message: '잠시 후 다시 시도해주세요. (시간당 5회)' })
  }
  if (recent && recent[0] && Date.now() - new Date(recent[0].created_at).getTime() < 60 * 1000) {
    return res.status(429).json({ error: 'rate_limited', message: '1분 후 다시 시도해주세요.' })
  }

  const code = generateCode()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  const { error: insertErr } = await supabase
    .from('company_email_verifications')
    .insert({ user_id: user.id, email, domain, code_hash: hashCode(code), expires_at: expiresAt })
  if (insertErr) return res.status(500).json({ error: insertErr.message })

  try {
    await sendVerificationCode(email, code)
  } catch (e) {
    console.error('[send-code] sendVerificationCode failed:', e.message)
    // [DEBUG] 실제 원인을 앱 화면까지 노출 — 원인 확인 후 아래 message를 원래 문구로 되돌릴 것.
    return res.status(502).json({
      error: 'send_failed',
      message: `발송 실패(디버그): ${e.message} | from=${(process.env.RESEND_FROM || 'UNSET').trim()} | key=${(process.env.RESEND_API_KEY || 'UNSET').trim().slice(0, 8)}…`,
    })
  }

  return res.json({ ok: true, email })
}
