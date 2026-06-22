import { createClient } from '@supabase/supabase-js'
import { resolveDisplayTier, getSalaryTierByKey } from '../../../lib/salaryTiers'
import { isEngagementKey } from '../../../lib/engagementBadges'

// 대표 뱃지 key가 연봉 등급이면 그 키, 아니면 null(연봉 뱃지 슬롯 back-compat용).
function salaryTierOf(repKey) {
  return repKey && getSalaryTierByKey(repKey) ? repKey : null
}
import { sendPush } from '../../../lib/push'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Accept only a public URL from our own Supabase storage, else null.
function sanitizeImageUrl(value) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  return typeof value === 'string' && base && value.startsWith(base) ? value : null
}

// Map of user_id -> 커뮤니티에 노출할 대표 뱃지 key(연봉 등급 또는 참여형). 검증된 것만.
async function representativeBadgeMap(userIds) {
  const ids = [...new Set(userIds)].filter(Boolean)
  if (!ids.length) return {}
  const { data: profiles } = await supabase
    .from('user_profiles').select('id, representative_badge, representative_tier').in('id', ids)
  const wanted = {}
  ;(profiles || []).forEach(p => {
    const key = p.representative_badge || p.representative_tier
    if (key) wanted[p.id] = key
  })
  const repIds = Object.keys(wanted)
  if (!repIds.length) return {}
  const salaryIds = repIds.filter(id => getSalaryTierByKey(wanted[id]))
  const engIds = repIds.filter(id => isEngagementKey(wanted[id]))
  const map = {}
  if (salaryIds.length) {
    const { data } = await supabase.from('user_badges').select('user_id, salary_amount')
      .in('user_id', salaryIds).eq('badge_type', 'salary_range').eq('is_active', true)
    const amt = {}
    ;(data || []).forEach(b => { amt[b.user_id] = b.salary_amount })
    salaryIds.forEach(id => {
      const key = resolveDisplayTier(amt[id], wanted[id])
      if (key) map[id] = key
    })
  }
  if (engIds.length) {
    const { data } = await supabase.from('user_badges').select('user_id, badge_type').in('user_id', engIds)
    const have = new Set((data || []).map(b => b.user_id + '|' + b.badge_type))
    engIds.forEach(id => { if (have.has(id + '|' + wanted[id])) map[id] = wanted[id] })
  }
  return map
}

// Map of user_id -> verified company name (active verified_company badge).
async function companyVerifiedMap(userIds) {
  const ids = [...new Set(userIds)].filter(Boolean)
  if (!ids.length) return {}
  const { data: badges } = await supabase
    .from('user_badges')
    .select('user_id')
    .in('user_id', ids)
    .eq('badge_type', 'verified_company')
    .eq('is_active', true)
  const verifiedIds = (badges || []).map(b => b.user_id)
  if (!verifiedIds.length) return {}
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, verified_company_name')
    .in('id', verifiedIds)
  const map = {}
  ;(profiles || []).forEach(p => {
    if (p.verified_company_name) map[p.id] = p.verified_company_name
  })
  return map
}

// Map of user_id -> { user_type, verified_school }. user_type ('student'|'worker')
// drives the author label's no-company fallback (학생 vs 직장인); the verified
// school name is the student-side mirror of verified_company_name (badge-gated).
async function userTypeMap(userIds) {
  const ids = [...new Set(userIds)].filter(Boolean)
  if (!ids.length) return {}
  const { data: badges } = await supabase
    .from('user_badges')
    .select('user_id')
    .in('user_id', ids)
    .eq('badge_type', 'verified_school')
    .eq('is_active', true)
  const schoolIds = new Set((badges || []).map(b => b.user_id))
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, user_type, verified_school_name')
    .in('id', ids)
  const map = {}
  ;(profiles || []).forEach(p => {
    map[p.id] = {
      user_type: p.user_type || null,
      verified_school: schoolIds.has(p.id) ? (p.verified_school_name || null) : null,
    }
  })
  return map
}

// Map of user_id -> profile photo (user_profiles.photo_url), the picture the user
// uploaded in-app. Used to set author_avatar on non-anonymous comments so the
// in-app photo shows. Anonymous comments skip this.
async function avatarMap(userIds) {
  const ids = [...new Set(userIds)].filter(Boolean)
  if (!ids.length) return {}
  const { data } = await supabase
    .from('user_profiles')
    .select('id, photo_url')
    .in('id', ids)
  const map = {}
  ;(data || []).forEach(p => {
    if (p.photo_url) map[p.id] = p.photo_url
  })
  return map
}

// Map of user_id -> current display name (user_profiles.full_name). Overrides the
// author_name snapshotted at write time so a nickname change reflects on ALL of the
// user's existing comments. Anonymous rows are re-masked to first-char + '**'.
async function nameMap(userIds) {
  const ids = [...new Set(userIds)].filter(Boolean)
  if (!ids.length) return {}
  const { data } = await supabase
    .from('user_profiles')
    .select('id, full_name')
    .in('id', ids)
  const map = {}
  ;(data || []).forEach(p => {
    if (p.full_name) map[p.id] = p.full_name
  })
  return map
}

// Resolve the author name shown for a row: prefer the user's current profile name,
// fall back to the stored snapshot. Anonymous rows are masked to first-char + '**'.
function resolveAuthorName(row, nMap) {
  const current = nMap[row.user_id]
  if (!current) return row.author_name
  return row.is_anonymous ? (current.charAt(0) + '**') : current
}

// User ids the caller has blocked — their comments are excluded from GET responses.
async function blockedIdsFor(token) {
  if (!token) return []
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return []
  const { data } = await supabase
    .from('community_blocks')
    .select('blocked_id')
    .eq('blocker_id', user.id)
  return (data || []).map(b => b.blocked_id)
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { post_id } = req.query
    if (!post_id) return res.status(400).json({ error: 'post_id required' })

    const blockedIds = await blockedIdsFor(req.headers.authorization?.replace('Bearer ', ''))
    let cq = supabase
      .from('community_comments')
      .select('*')
      .eq('post_id', post_id)
      .order('created_at', { ascending: true })
    if (blockedIds.length) cq = cq.not('user_id', 'in', `(${blockedIds.join(',')})`)
    const { data, error } = await cq

    if (error) return res.status(500).json({ error: error.message })

    // Check likes for logged in user
    const token = req.headers.authorization?.replace('Bearer ', '')
    let likedCommentIds = []
    if (token && data.length > 0) {
      const { data: { user } } = await supabase.auth.getUser(token)
      if (user) {
        const commentIds = data.map(c => c.id)
        const { data: likes } = await supabase
          .from('community_likes')
          .select('comment_id')
          .eq('user_id', user.id)
          .in('comment_id', commentIds)
        likedCommentIds = (likes || []).map(l => l.comment_id)
      }
    }

    // 작성자 부가정보 맵은 서로 독립적이라 병렬로 받아 응답 시간을 줄인다.
    const ids = data.map(c => c.user_id)
    const [tierMap, cvMap, utMap, avMap, nMap] = await Promise.all([
      representativeBadgeMap(ids),
      companyVerifiedMap(ids),
      userTypeMap(ids),
      avatarMap(ids),
      nameMap(ids),
    ])

    return res.status(200).json({
      comments: data.map(c => ({ ...c, is_liked: likedCommentIds.includes(c.id), author_badge: tierMap[c.user_id] || null, author_salary_tier: salaryTierOf(tierMap[c.user_id]), author_verified_company: cvMap[c.user_id] || null, author_user_type: utMap[c.user_id]?.user_type || null, author_verified_school: utMap[c.user_id]?.verified_school || null, author_avatar: c.is_anonymous ? null : (avMap[c.user_id] || null), author_name: resolveAuthorName(c, nMap) }))
    })
  }

  if (req.method === 'POST') {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: 'Unauthorized' })

    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

    // Member-only gate (student/worker). OFF by default — flip COMMUNITY_REQUIRE_MEMBER=true
    // only once the mobile onboarding build is live, otherwise non-onboarded users get locked out.
    if (process.env.COMMUNITY_REQUIRE_MEMBER === 'true') {
      const { data: prof } = await supabase
        .from('user_profiles')
        .select('user_type')
        .eq('id', user.id)
        .maybeSingle()
      if (!prof?.user_type) {
        return res.status(403).json({ error: 'not_member', message: '학생 또는 직장인 인증 후 댓글을 작성할 수 있어요.' })
      }
    }

    const { post_id, content, is_anonymous } = req.body
    const image_url = sanitizeImageUrl(req.body.image_url)
    if (!post_id || (!content && !image_url)) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Use the user's current profile name (editable via /api/profile/talent),
    // NOT the auth signup metadata which is frozen at sign-up time.
    const { data: authorProfile } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()
    const realName = authorProfile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'

    // Fetch the post to flag original-poster (OP) comments, inherit its privacy, and bump the count.
    const { data: postData } = await supabase
      .from('community_posts')
      .select('user_id, comment_count, is_anonymous, title')
      .eq('id', post_id)
      .single()
    const isOp = !!(postData && postData.user_id === user.id)

    // OP가 자기 글에 다는 댓글은 글의 공개/익명을 그대로 상속(익명글→익명, 공개글→공개).
    // 그 외 댓글은 작성자가 고른 is_anonymous를 따른다(기본 익명).
    const effectiveAnon = isOp ? (postData?.is_anonymous !== false) : (is_anonymous !== false)
    const authorName = effectiveAnon ? (realName.charAt(0) + '**') : realName

    const { data, error } = await supabase
      .from('community_comments')
      .insert({
        post_id,
        user_id: user.id,
        author_name: authorName,
        content,
        image_url,
        is_anonymous: effectiveAnon,
        is_op: isOp
      })
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })

    // Increment comment count on the post
    if (postData) {
      await supabase
        .from('community_posts')
        .update({ comment_count: (postData.comment_count || 0) + 1 })
        .eq('id', post_id)
    }

    // 댓글 알림 — 내 글이 아니면 글 작성자에게 푸시(카테고리 'comment').
    if (postData?.user_id && !isOp) {
      const snippet = (content || '').trim().slice(0, 50)
      // who(익명 라벨)는 언어별, 본문 스니펫은 사용자 데이터. 토큰 locale별로 본문을 구성한다.
      const ANON = { vi: 'Ẩn danh', ko: '익명', en: 'Anonymous' }
      const COMMENTED_SUFFIX = {
        vi: ' đã bình luận bài viết của bạn',
        ko: '님이 회원님의 글에 댓글을 남겼습니다',
        en: ' commented on your post',
      }
      const COMMENT_TITLE = { vi: 'Cộng đồng FYI', ko: 'FYI 커뮤니티', en: 'FYI Community' }
      const bodyFor = (loc) => {
        const who = effectiveAnon ? ANON[loc] : realName
        return snippet ? `${who}: ${snippet}` : `${who}${COMMENTED_SUFFIX[loc]}`
      }
      sendPush([postData.user_id], {
        title: postData.title || COMMENT_TITLE,
        body: { vi: bodyFor('vi'), ko: bodyFor('ko'), en: bodyFor('en') },
        category: 'comment',
        data: { url: `/community/${post_id}` },
      })
    }

    // Enrich the response with the same author trust signals the GET returns,
    // so the freshly-posted comment shows company / salary badge without a reload.
    const tierMap = await representativeBadgeMap([user.id])
    const cvMap = await companyVerifiedMap([user.id])
    const utMap = await userTypeMap([user.id])
    const avMap = await avatarMap([user.id])

    return res.status(201).json({
      ...data,
      is_liked: false,
      author_badge: tierMap[user.id] || null,
      author_salary_tier: salaryTierOf(tierMap[user.id]),
      author_verified_company: cvMap[user.id] || null,
      author_user_type: utMap[user.id]?.user_type || null,
      author_verified_school: utMap[user.id]?.verified_school || null,
      author_avatar: data.is_anonymous ? null : (avMap[user.id] || null),
    })
  }

  if (req.method === 'DELETE') {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: 'Unauthorized' })

    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

    const { id, post_id } = req.query
    if (!id) return res.status(400).json({ error: 'id required' })

    const { error } = await supabase
      .from('community_comments')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return res.status(500).json({ error: error.message })

    // Decrement comment count
    if (post_id) {
      const { data: p } = await supabase
        .from('community_posts')
        .select('comment_count')
        .eq('id', post_id)
        .single()
      if (p) {
        await supabase
          .from('community_posts')
          .update({ comment_count: Math.max(0, (p.comment_count || 0) - 1) })
          .eq('id', post_id)
      }
    }

    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
