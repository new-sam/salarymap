import supabaseAdmin from '../../../lib/supabaseAdmin'
import { verifyToken, leadId } from '../../../lib/ktcMailToken'

/* 어학 랜딩을 '사람이' 열었다는 기록.

   coldmail_lang_click 은 서버 렌더 시점에 찍혀서 메일 보안 스캐너의 프리페치까지
   포함한다. 이 엔드포인트는 브라우저에서만 호출되므로(스캐너는 JS 를 실행하지 않는다)
   두 숫자의 차이가 곧 스캐너 비중이다.

   권한은 랜딩과 같은 HMAC 토큰이다. 쓰는 것은 events 한 줄뿐이라 링크가 유출돼도
   남이 할 수 있는 건 열람 기록을 늘리는 것뿐이다. */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { token, cta } = req.body || {}
  const claim = verifyToken(token)
  if (!claim?.email) return res.status(401).json({ error: 'invalid_token' })

  const { data: prof } = await supabaseAdmin
    .from('user_profiles').select('id').ilike('email', claim.email).maybeSingle()

  // 프로필이 없어도 기록은 남긴다 — 그 경우가 바로 "메일은 열었는데 계정이 사라진" 건이라
  // 발송 명단을 고칠 근거가 된다. 사람 수는 lead 해시로 센다.
  await supabaseAdmin.from('events').insert({
    event: 'coldmail_lang_view',
    user_id: prof?.id || null,
    meta: {
      campaign: claim.campaign || null,
      cta: typeof cta === 'string' ? cta.slice(0, 20) : null,
      lead: leadId(claim.email),
    },
  })
  return res.status(200).json({ ok: true })
}
