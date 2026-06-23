// 공개 프로필 — 커뮤니티에서 공개(비익명) 글의 작성자 아바타를 탭하면 보이는 화면용.
// GET ?id=<uuid>  익명 허용. 본인 프로필 전용 talent.js와 달리 "남에게 보여도 되는" 필드만 노출한다.
//   반환: profile(이름·사진·직무·user_type·인증회사/학교·대표뱃지) + 팔로워/팔로잉 수
//        + (로그인 시) following(내가 이 유저를 팔로우 중인지) + isMe
// 민감정보(연봉 등급/이력서/지원내역)는 내보내지 않는다. 연봉 등급은 본인이 대표뱃지로
// 고른 경우에만(=커뮤니티 노출과 동일 기준) representative로 드러난다.
import supabase from '../../../lib/supabaseAdmin'
import { resolveDisplayTier, getSalaryTierByKey } from '../../../lib/salaryTiers'
import { isEngagementKey, isGoldEngagementKey } from '../../../lib/engagementBadges'

async function userFromReq(req) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user } } = await supabase.auth.getUser(token)
  return user || null
}

// 커뮤니티에 노출 중인 대표 뱃지 key(검증됨) — posts.js representativeBadgeMap의 단일 유저 버전.
// 옵트인: 사용자가 고르고(representative_badge) 실제 획득한 것만. 연봉 등급은 인증 등급 이하만.
async function representativeBadge(userId) {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('representative_badge, representative_tier')
    .eq('id', userId)
    .maybeSingle()
  const key = profile?.representative_badge || profile?.representative_tier
  if (!key) return null
  if (getSalaryTierByKey(key)) {
    const { data: b } = await supabase
      .from('user_badges')
      .select('salary_amount')
      .eq('user_id', userId)
      .eq('badge_type', 'salary_range')
      .eq('is_active', true)
      .maybeSingle()
    return resolveDisplayTier(b?.salary_amount, key)
  }
  if (isEngagementKey(key) && isGoldEngagementKey(key)) {
    const { data: row } = await supabase
      .from('user_badges')
      .select('badge_type')
      .eq('user_id', userId)
      .eq('badge_type', key)
      .maybeSingle()
    return row ? key : null
  }
  return null
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const id = req.query.id
  if (!id) return res.status(400).json({ error: 'Missing id' })

  const [{ data: prof }, { data: vbadges }, repKey, { count: followerCount }, { count: followingCount }] =
    await Promise.all([
      supabase
        .from('user_profiles')
        .select('id, full_name, photo_url, position, headline, user_type, verified_company_name, verified_school_name')
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('user_badges')
        .select('badge_type')
        .eq('user_id', id)
        .in('badge_type', ['verified_company', 'verified_school'])
        .eq('is_active', true),
      representativeBadge(id),
      supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('following_id', id),
      supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('follower_id', id),
    ])

  // 프로필 row가 아예 없는 유저(탈퇴/미생성)는 404. 빈 프로필이라도 row가 있으면 노출.
  if (!prof) return res.status(404).json({ error: 'Not found' })

  const verifiedTypes = new Set((vbadges || []).map((b) => b.badge_type))
  const salaryTier = repKey && getSalaryTierByKey(repKey) ? repKey : null

  // 호출자가 이 유저를 팔로우 중인지 + 본인 여부(본인이면 앱에서 내 프로필로 리다이렉트).
  let following = false
  let isMe = false
  const me = await userFromReq(req)
  if (me) {
    isMe = me.id === id
    if (!isMe) {
      const { data } = await supabase
        .from('user_follows')
        .select('id')
        .eq('follower_id', me.id)
        .eq('following_id', id)
        .maybeSingle()
      following = !!data
    }
  }

  return res.status(200).json({
    profile: {
      id: prof.id,
      full_name: prof.full_name || null,
      photo_url: prof.photo_url || null,
      position: prof.position || prof.headline || null,
      user_type: prof.user_type || null,
      // 인증 뱃지가 활성일 때만 회사/학교명을 신뢰 칩으로 노출.
      verified_company: verifiedTypes.has('verified_company') ? prof.verified_company_name || null : null,
      verified_school: verifiedTypes.has('verified_school') ? prof.verified_school_name || null : null,
      representative_badge: repKey,
      salary_tier: salaryTier,
    },
    followerCount: followerCount || 0,
    followingCount: followingCount || 0,
    following,
    isMe,
  })
}
