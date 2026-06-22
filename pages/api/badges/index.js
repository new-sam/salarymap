import { createClient } from '@supabase/supabase-js'
import { getSalaryTier, getSalaryTierByKey, tierRank } from '../../../lib/salaryTiers'

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
)

export default async function handler(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'unauthorized' })

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'unauthorized' })

  // GET: list user's badges (+ 현재 대표 연봉 등급 선택값)
  if (req.method === 'GET') {
    const [{ data, error }, { data: profile }] = await Promise.all([
      supabase.from('user_badges').select('*').eq('user_id', user.id),
      supabase.from('user_profiles').select('representative_tier').eq('id', user.id).maybeSingle(),
    ])

    if (error) return res.status(500).json({ error: error.message })
    return res.json({ badges: data, representative_tier: profile?.representative_tier ?? null })
  }

  // PUT: 대표 연봉 등급 선택 — user_profiles.representative_tier 저장.
  // 본인이 획득한 등급 이하만 허용(없는 상위 등급 사칭 방지). null이면 해제(자동=최고 등급).
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
