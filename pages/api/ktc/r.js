import supabase from '../../../lib/supabaseAdmin'
import { verifyToken, leadId } from '../../../lib/ktcMailToken'

// KTC 콜드메일 CTA 클릭 추적 리다이렉트.
// 수신자는 FYI 계정이 없어 user_id 가 없다 → meta.lead(이메일 해시)로 사람을 구분한다.
// 토큰이 없거나 위조돼도 리다이렉트는 해준다 — 측정만 실패하고 링크는 살아야 한다.
export default async function handler(req, res) {
  const { t, to } = req.query
  // 오픈 리다이렉트 차단 — 내부 경로('/'로 시작, '//' 아님)만 허용
  const dest = typeof to === 'string' && /^\/(?!\/)/.test(to) ? to : '/jobs'

  const parsed = verifyToken(t)
  if (parsed) {
    try {
      await supabase.from('events').insert([{
        event: 'coldmail_public_click',
        page: '/api/ktc/r',
        meta: { campaign: parsed.campaign, lead: leadId(parsed.email), cta: dest },
      }])
    } catch (e) {
      console.error('ktc/r log failed:', e.message)
    }
  }

  res.redirect(302, dest)
}
