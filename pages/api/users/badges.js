// 공개 프로필 "뱃지" 탭용 — 그 유저가 취득한 뱃지만. 익명 허용.
// GET ?id=<uuid>
//   earned:     획득한 참여형 뱃지 key 배열(글/댓글/좋아요/지원/출석 — 비민감 성취)
//   salaryTier: 연봉 등급 key. 단, 본인이 "대표 뱃지"로 명시적으로 고른 경우에만 노출(=커뮤니티
//               노출과 동일한 옵트인 기준). 안 골랐으면 null — 연봉 등급은 민감정보라 기본 비공개.
import supabase from '../../../lib/supabaseAdmin'
import { resolveDisplayTier, getSalaryTierByKey } from '../../../lib/salaryTiers'
import { isEngagementKey } from '../../../lib/engagementBadges'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const id = req.query.id
  if (!id) return res.status(400).json({ error: 'Missing id' })

  const [{ data: badges }, { data: profile }] = await Promise.all([
    supabase
      .from('user_badges')
      .select('badge_type, salary_amount, is_active, granted_at')
      .eq('user_id', id),
    supabase
      .from('user_profiles')
      .select('representative_badge, representative_tier')
      .eq('id', id)
      .maybeSingle(),
  ])

  const rows = badges || []
  // 참여형: lazy-grant로 user_badges에 적재된 것 = 노출 대상.
  const earned = rows.filter((b) => isEngagementKey(b.badge_type)).map((b) => b.badge_type)

  // 연봉 등급: 본인이 대표로 고른 등급이 실제 인증 등급 이하일 때만 노출.
  const repKey = profile?.representative_badge || profile?.representative_tier
  let salaryTier = null
  if (repKey && getSalaryTierByKey(repKey)) {
    const salaryRow = rows.find((b) => b.badge_type === 'salary_range' && b.is_active)
    salaryTier = resolveDisplayTier(salaryRow?.salary_amount, repKey)
  }

  return res.status(200).json({ earned, salaryTier })
}
