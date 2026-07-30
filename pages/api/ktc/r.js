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

  // 상태 확인 랜딩은 본인이 누구인지 알아야 지원 이력을 띄운다 → 토큰을 목적지까지 넘긴다.
  // 넘기는 건 이 경로 하나뿐(토큰이 임의 경로로 새지 않게). 기존 발송분(to=/jobs)은 그대로 동작.
  const finalDest = parsed && dest === '/ktc/status'
    ? `/ktc/status?t=${encodeURIComponent(t)}`
    : dest

  res.redirect(302, finalDest)
}
