import { createClient } from '@supabase/supabase-js'
import { getSalaryTier, getSalaryTierByKey, tierRank } from '../../../lib/salaryTiers'
import { isEngagementKey } from '../../../lib/engagementBadges'

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
)

export default async function handler(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'unauthorized' })

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'unauthorized' })

  // GET: list user's badges (+ 현재 대표 뱃지 선택값). representative_badge가 일반화된 값,
  // representative_tier는 연봉 대표일 때의 back-compat 미러.
  if (req.method === 'GET') {
    const [{ data, error }, { data: profile }] = await Promise.all([
      supabase.from('user_badges').select('*').eq('user_id', user.id),
      supabase
        .from('user_profiles')
        .select('representative_tier, representative_badge')
        .eq('id', user.id)
        .maybeSingle(),
    ])

    if (error) return res.status(500).json({ error: error.message })
    return res.json({
      badges: data,
      representative_tier: profile?.representative_tier ?? null,
      representative_badge: profile?.representative_badge ?? null,
    })
  }

  // PUT: 대표 뱃지 선택(연봉 등급 또는 참여형 뱃지). 본인이 실제 획득한 것만 허용.
  // null이면 비공개(커뮤니티 미노출). representative_badge가 일반 경로.
  if (req.method === 'PUT' && 'representative_badge' in req.body) {
    const rep = req.body.representative_badge
    const save = (badge, tier) =>
      supabase.from('user_profiles').upsert(
        { id: user.id, representative_badge: badge, representative_tier: tier },
        { onConflict: 'id' },
      )

    if (rep === null) {
      const { error } = await save(null, null)
      if (error) return res.status(500).json({ error: error.message })
      return res.json({ representative_badge: null })
    }
    if (getSalaryTierByKey(rep)) {
      // 연봉 등급 — 실제 인증 등급 이하만(없는 상위 등급 사칭 방지).
      const { data: badge } = await supabase
        .from('user_badges')
        .select('salary_amount')
        .eq('user_id', user.id)
        .eq('badge_type', 'salary_range')
        .eq('is_active', true)
        .maybeSingle()
      const actual = getSalaryTier(badge?.salary_amount)
      if (!actual || tierRank(rep) > tierRank(actual.key)) {
        return res.status(403).json({ error: 'not earned' })
      }
      const { error } = await save(rep, rep) // 연봉 대표는 tier 미러도 채움
      if (error) return res.status(500).json({ error: error.message })
      return res.json({ representative_badge: rep })
    }
    if (isEngagementKey(rep)) {
      // 참여형 — 부여된(획득) 뱃지만. engagement 엔드포인트가 달성 시 user_badges에 부여.
      const { data: row } = await supabase
        .from('user_badges')
        .select('badge_type')
        .eq('user_id', user.id)
        .eq('badge_type', rep)
        .maybeSingle()
      if (!row) return res.status(403).json({ error: 'not earned' })
      const { error } = await save(rep, null)
      if (error) return res.status(500).json({ error: error.message })
      return res.json({ representative_badge: rep })
    }
    return res.status(400).json({ error: 'invalid badge' })
  }

  // PUT: 대표 연봉 등급 선택 — user_profiles.representative_tier 저장.
  // 본인이 획득한 등급 이하만 허용(없는 상위 등급 사칭 방지). null이면 비공개(커뮤니티 미노출).
  if (req.method === 'PUT' && 'representative_tier' in req.body) {
    const rep = req.body.representative_tier
    if (rep !== null) {
      if (!getSalaryTierByKey(rep)) return res.status(400).json({ error: 'invalid tier' })
      const { data: badge } = await supabase
        .from('user_badges')
        .select('salary_amount')
        .eq('user_id', user.id)
        .eq('badge_type', 'salary_range')
        .eq('is_active', true)
        .maybeSingle()
      const actual = getSalaryTier(badge?.salary_amount)
      if (!actual || tierRank(rep) > tierRank(actual.key)) {
        return res.status(403).json({ error: 'tier not earned' })
      }
    }
    const { error } = await supabase
      .from('user_profiles')
      .upsert({ id: user.id, representative_tier: rep }, { onConflict: 'id' })
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ representative_tier: rep })
  }

  // PUT: toggle badge active status
  if (req.method === 'PUT') {
    const { badge_type, is_active } = req.body
    if (!badge_type) return res.status(400).json({ error: 'badge_type required' })

    const { data, error } = await supabase
      .from('user_badges')
      .update({ is_active })
      .eq('user_id', user.id)
      .eq('badge_type', badge_type)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.json({ badge: data })
  }

  return res.status(405).json({ error: 'method not allowed' })
}
