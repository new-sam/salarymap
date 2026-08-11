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
    // 선택형 키는 pages/survey.js QUESTIONS와 1:1 — 니즈 도출은 어드민에서 조합으로 한다
    const RADIO_KEYS = ['status', 'stage', 'cv_worry', 'photo_current', 'interview_prep', 'interview_weak', 'coach_who', 'coach_exp', 'info_gap', 'learn_block']
    const answers = {
      pain: clean(a.pain),
      cv_feedback: Array.isArray(a.cv_feedback) ? a.cv_feedback.map(clean).filter(Boolean).slice(0, 10) : [],
      info_source: Array.isArray(a.info_source) ? a.info_source.map(clean).filter(Boolean).slice(0, 10) : [],
      // 지출 — 구조화 {item, amount(VND), note?}[], '없음'은 spent_none
      spent_none: !!a.spent_none,
      spent_items: (Array.isArray(a.spent_items) ? a.spent_items : []).slice(0, 10)
        .map((it) => ({
          item: clean(it?.item),
          amount: Math.max(0, Math.min(1e12, parseInt(it?.amount, 10) || 0)),
          ...(it?.note ? { note: clean(it.note) } : {}),
        }))
        .filter((it) => it.item),
      call_ok: !!a.call_ok,
      contact: clean(a.contact),
    }
    for (const k of RADIO_KEYS) answers[k] = clean(a[k])
    // 조건부 후속(N-1) — 부모 답에 따라 안 뜰 수 있어 서버에선 선택값으로 받는다
    const FOLLOWUP_KEYS = ['cv_fb_quality', 'cv_fb_why_not', 'photo_app_sat', 'photo_why', 'prep_enough', 'prep_why_not', 'info_trust', 'info_gap_impact', 'learn_want']
    for (const k of FOLLOWUP_KEYS) answers[k] = clean(a[k])
    if (RADIO_KEYS.some((k) => !answers[k]) || !answers.pain || !answers.cv_feedback.length
      || !answers.info_source.length || (!answers.spent_none && !answers.spent_items.length)) {
      return res.status(400).json({ error: 'missing_required' })
    }

    await supabase.from('events').insert([{
      event: 'survey_submit', page: '/survey', user_id: userId, meta: { campaign, answers },
    }])
    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error('survey api error:', e.message)
    return res.status(500).json({ error: 'server_error' })
  }
}
