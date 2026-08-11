import supabase from '../../lib/supabaseAdmin'
import { verifyToken } from '../../lib/campaignToken'

// 유저 서베이 — 콜드메일 개인 토큰(?t=)으로 로그인 없이 응답. 별도 테이블 없이
// events 에 남긴다(survey_view=랜딩 열람, survey_submit=제출, meta.answers=응답 본문).
// 어드민 집계는 /api/admin/survey-results 가 events 를 읽는다.
const MAX_LEN = 2000
const clean = (v) => (typeof v === 'string' ? v.trim().slice(0, MAX_LEN) : '')

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const parsed = verifyToken(req.body?.t)
  if (!parsed) return res.status(400).json({ error: 'invalid_token' })
  const { userId, campaign } = parsed

  try {
    if (req.body?.view) {
      const [{ data: p }, { data: prev }] = await Promise.all([
        supabase.from('user_profiles').select('full_name').eq('id', userId).single(),
        supabase.from('events').select('id').eq('event', 'survey_submit')
          .eq('user_id', userId).contains('meta', { campaign }).limit(1),
      ])
      if (!p) return res.status(404).json({ error: 'not_found' })
      await supabase.from('events').insert([{
        event: 'survey_view', page: '/survey', user_id: userId, meta: { campaign },
      }])
      return res.status(200).json({ name: p.full_name || '', submitted: !!(prev && prev.length) })
    }

    const a = req.body?.answers
    if (!a || typeof a !== 'object') return res.status(400).json({ error: 'no_answers' })
    const answers = {
      status: clean(a.status),
      pain: clean(a.pain),
      spent: clean(a.spent),
      kr_interest: clean(a.kr_interest),
      kr_obstacle: clean(a.kr_obstacle),
      call_ok: !!a.call_ok,
      contact: clean(a.contact),
    }
    if (!answers.status || !answers.pain) return res.status(400).json({ error: 'missing_required' })

    await supabase.from('events').insert([{
      event: 'survey_submit', page: '/survey', user_id: userId, meta: { campaign, answers },
    }])
    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error('survey api error:', e.message)
    return res.status(500).json({ error: 'server_error' })
  }
}
