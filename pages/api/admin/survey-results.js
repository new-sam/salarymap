import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'

// 유저 서베이 결과 — events(survey_sent/survey_view/survey_submit)를 캠페인별 퍼널로 집계하고
// 제출 응답 전문을 프로필(이름·이메일·직군)과 조인해 내려준다. 같은 유저가 재제출하면 최신 것만.
const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
)

export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    // 기본 1000행 캡 — range 루프로 전량
    const rows = []
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase
        .from('events')
        .select('event, user_id, meta, created_at')
        .in('event', ['survey_sent', 'survey_view', 'survey_submit'])
        .order('created_at', { ascending: true })
        .range(offset, offset + 999)
      if (error) return res.status(500).json({ error: error.message })
      rows.push(...data)
      if (data.length < 1000) break
    }

    // 캠페인별 퍼널 (유니크 유저 기준)
    const campaigns = {}
    const bucket = (c) => (campaigns[c] ||= { campaign: c, sent: new Set(), viewed: new Set(), submitted: new Set() })
    // 유저별 최신 제출 (키: campaign + user)
    const latest = {}
    for (const r of rows) {
      const c = r.meta?.campaign || '(unknown)'
      const b = bucket(c)
      if (r.event === 'survey_sent') b.sent.add(r.user_id)
      else if (r.event === 'survey_view') b.viewed.add(r.user_id)
      else if (r.event === 'survey_submit') {
        b.submitted.add(r.user_id)
        latest[`${c}:${r.user_id}`] = r // created_at 오름차순이라 마지막 것이 최신
      }
    }

    const submits = Object.values(latest)
    const uids = [...new Set(submits.map((r) => r.user_id).filter(Boolean))]
    const profiles = {}
    for (let i = 0; i < uids.length; i += 200) {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, full_name, position')
        .in('id', uids.slice(i, i + 200))
      if (error) return res.status(500).json({ error: error.message })
      for (const p of data) profiles[p.id] = p
    }

    const responses = submits
      .map((r) => {
        const p = profiles[r.user_id] || {}
        return {
          user_id: r.user_id,
          campaign: r.meta?.campaign || '(unknown)',
          created_at: r.created_at,
          email: p.email || null,
          name: p.full_name || null,
          position: p.position || null,
          answers: r.meta?.answers || {},
        }
      })
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))

    return res.status(200).json({
      campaigns: Object.values(campaigns)
        .map((b) => ({ campaign: b.campaign, sent: b.sent.size, viewed: b.viewed.size, submitted: b.submitted.size }))
        .sort((a, b) => b.sent - a.sent),
      responses,
    })
  } catch (e) {
    console.error('survey-results error:', e.message)
    return res.status(500).json({ error: 'server_error' })
  }
}
