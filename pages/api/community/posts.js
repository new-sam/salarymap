import { createClient } from '@supabase/supabase-js'
import { resolveDisplayTier, getSalaryTierByKey } from '../../../lib/salaryTiers'
import { isEngagementKey, isGoldEngagementKey } from '../../../lib/engagementBadges'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// 인기글 가중치 — 홈/모바일/daily-hot-post와 동일(댓글>좋아요>조회).
function hotScore(p) {
  return (p.comment_count || 0) * 4 + (p.like_count || 0) * 3 + (p.view_count || 0) * 0.3
}

// PostgREST .or() takes a comma/paren-delimited filter string, so raw user input
// could inject extra conditions or reference other columns. Strip the grammar
// characters (commas, parens, backslash) before interpolating into an ilike search.
function sanitizeSearch(s) {
  return (s || '').trim().replace(/[,()\\]/g, ' ').trim()
}

// Accept only public URLs from our own Supabase storage, capped at `max` items.
// Guards against arbitrary/external URLs being stored and rendered as <img>.
function sanitizeImageUrls(value, max = 4) {
  if (!Array.isArray(value)) return []
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  return value
    .filter(u => typeof u === 'string' && base && u.startsWith(base))
    .slice(0, max)
}

// Map of user_id -> 커뮤니티에 노출할 대표 뱃지 key(검증됨). 연봉 등급 키(nghindo 등) 또는
// 참여형 key(comment_500 등). 사용자가 고르고 실제 획득한 것만. 미선택/미획득이면 키 없음.
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
  // 참여형은 골드만 노출(일반 뱃지는 장착 불가 — 혹시 남은 값이 있어도 표시 안 함).
  const engIds = repIds.filter(id => isEngagementKey(wanted[id]) && isGoldEngagementKey(wanted[id]))
  const out = {}
  if (salaryIds.length) {
    // 연봉 대표 — 실제 인증 등급 이하인지 검증.
    const { data } = await supabase.from('user_badges').select('user_id, salary_amount')
      .in('user_id', salaryIds).eq('badge_type', 'salary_range').eq('is_active', true)
    const amt = {}
    ;(data || []).forEach(b => { amt[b.user_id] = b.salary_amount })
    salaryIds.forEach(id => {
      const key = resolveDisplayTier(amt[id], wanted[id])
      if (key) out[id] = key
    })
  }
  if (engIds.length) {
    // 참여형 대표 — 부여된(획득) 뱃지 row가 있는지 검증.
    const { data } = await supabase.from('user_badges').select('user_id, badge_type').in('user_id', engIds)
    const have = new Set((data || []).map(b => b.user_id + '|' + b.badge_type))
    engIds.forEach(id => { if (have.has(id + '|' + wanted[id])) out[id] = wanted[id] })
  }
  return out
}

// 대표 뱃지 key가 연봉 등급이면 그 키, 아니면 null(연봉 뱃지 슬롯 back-compat용).
function salaryTierOf(repKey) {
  return repKey && getSalaryTierByKey(repKey) ? repKey : null
}

// Map of user_id -> verified company name for users with an active verified_company
// badge. Shown next to authors as a ✓ trust signal (work-email verified).
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
// drives the community author label's no-company fallback (학생 vs 직장인). The
// verified school name is the student-side mirror of verified_company_name and is
// only surfaced when the verified_school badge is active.
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
// registered in-app. This is the ONLY avatar source for non-anonymous posts; if a
// user never set an in-app photo, author_avatar is null → client renders initials.
// Social login avatars (google/apple user_metadata.avatar_url) are never used.
// Anonymous posts skip this.
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
// user's existing posts. Anonymous rows are re-masked to first-char + '**'.
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
// fall back to the stored snapshot when there's no profile row. Anonymous rows are
// masked to first-char + '**' (so "sean" -> "s**").
function resolveAuthorName(row, nMap) {
  const current = nMap[row.user_id]
  if (!current) return row.author_name
  return row.is_anonymous ? (current.charAt(0) + '**') : current
}

// User ids the caller has blocked — their content is excluded from GET responses.
// Returns [] for anon callers. (Reads the same token the GET handlers already use.)
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

// Map of post_id -> poll(현황 + 호출자의 투표 여부). 피드/미리보기 카드에서 바로
// 투표할 수 있도록 리스트 응답에 첨부한다. userId 없으면 my_vote는 항상 null.
async function pollsForPosts(postIds, userId) {
  const ids = [...new Set(postIds)].filter(Boolean)
  if (!ids.length) return {}
  const { data: polls } = await supabase
    .from('community_polls')
    .select('*')
    .in('post_id', ids)
  if (!polls?.length) return {}
  let voteMap = {}
  if (userId) {
    const { data: votes } = await supabase
      .from('community_poll_votes')
      .select('poll_id, choice')
      .eq('user_id', userId)
      .in('poll_id', polls.map(p => p.id))
    ;(votes || []).forEach(v => { voteMap[v.poll_id] = v.choice })
  }
  const map = {}
  polls.forEach(p => {
    map[p.post_id] = {
      id: p.id,
      option_a: p.option_a,
      option_b: p.option_b,
      votes_a: p.votes_a,
      votes_b: p.votes_b,
      ends_at: p.ends_at,
      my_vote: voteMap[p.id] || null,
    }
  })
  return map
}

// Set of author user_ids the signed-in caller already follows — drives the per-card
// "팔로우" 칩. Empty for anon callers. Self/anonymous are filtered at the call site.
async function followingSet(userIds, currentUserId) {
  if (!currentUserId) return new Set()
  const ids = [...new Set(userIds)].filter(Boolean)
  if (!ids.length) return new Set()
  const { data } = await supabase
    .from('user_follows')
    .select('following_id')
    .eq('follower_id', currentUserId)
    .in('following_id', ids)
  return new Set((data || []).map(f => f.following_id))
}

// true/false → 그 상태로 팔로우 버튼 노출. null → 버튼 숨김(본인 글·익명 글·비로그인 호출).
// 클라가 작성자 신원/본인 여부를 추측하지 않도록 서버가 못박는다.
function authorIsFollowing(p, followSet, currentUserId) {
  if (!currentUserId || p.is_anonymous || p.user_id === currentUserId) return null
  return followSet.has(p.user_id)
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { category, page = 1, limit = 20, sort = 'recent', search, id: postId, mine, interests } = req.query
    const blockedIds = await blockedIdsFor(req.headers.authorization?.replace('Bearer ', ''))

    // Single post fetch
    if (postId) {
      // 가벼운 존재 확인(알림 탭 시 삭제 여부 선확인). 무거운 작성자 집계 없이 id만 보고 빠르게 응답한다.
      // 모바일이 이걸로 먼저 확인해, 삭제된 글이면 상세로 push하지 않고 인앱 모달만 띄운다.
      if (req.query.exists === '1') {
        const { data: row } = await supabase
          .from('community_posts').select('id, user_id').eq('id', postId).maybeSingle()
        const exists = !!row && !blockedIds.includes(row.user_id)
        res.setHeader('Cache-Control', 'no-store')
        return res.status(200).json({ exists })
      }

      const { data: post, error } = await supabase
        .from('community_posts')
        .select('*')
        .eq('id', postId)
        .single()
      if (error || !post) return res.status(404).json({ error: 'Not found' })
      if (blockedIds.includes(post.user_id)) return res.status(404).json({ error: 'Not found' })

      // Increment view count only when explicitly requested
      if (req.query.view === '1') {
        await supabase
          .from('community_posts')
          .update({ view_count: (post.view_count || 0) + 1 })
          .eq('id', postId)
        post.view_count = (post.view_count || 0) + 1
      }

      post.author_is_following = null
      const token = req.headers.authorization?.replace('Bearer ', '')
      if (token) {
        const { data: { user } } = await supabase.auth.getUser(token)
        if (user) {
          const { data: like } = await supabase
            .from('community_likes')
            .select('id')
            .eq('user_id', user.id)
            .eq('post_id', postId)
            .maybeSingle()
          post.is_liked = !!like
          post.author_is_following = authorIsFollowing(post, await followingSet([post.user_id], user.id), user.id)
        }
      }
      const uid = [post.user_id]
      const [tierMap, cvMap, utMap, avMap, nMap] = await Promise.all([
        representativeBadgeMap(uid),
        companyVerifiedMap(uid),
        userTypeMap(uid),
        avatarMap(uid),
        nameMap(uid),
      ])
      post.author_badge = tierMap[post.user_id] || null
      post.author_salary_tier = salaryTierOf(tierMap[post.user_id])
      post.author_verified_company = cvMap[post.user_id] || null
      post.author_user_type = utMap[post.user_id]?.user_type || null
      post.author_verified_school = utMap[post.user_id]?.verified_school || null
      post.author_avatar = post.is_anonymous ? null : (avMap[post.user_id] || null)
      post.author_name = resolveAuthorName(post, nMap)

      // A/B 투표 첨부(있으면). 현황 + 로그인 사용자의 투표 여부.
      const { data: pollRow } = await supabase
        .from('community_polls')
        .select('*')
        .eq('post_id', postId)
        .maybeSingle()
      if (pollRow) {
        let myVote = null
        const tok = req.headers.authorization?.replace('Bearer ', '')
        if (tok) {
          const { data: { user: u } } = await supabase.auth.getUser(tok)
          if (u) {
            const { data: v } = await supabase
              .from('community_poll_votes')
              .select('choice')
              .eq('poll_id', pollRow.id)
              .eq('user_id', u.id)
              .maybeSingle()
            myVote = v?.choice || null
          }
        }
        post.poll = {
          id: pollRow.id,
          option_a: pollRow.option_a,
          option_b: pollRow.option_b,
          votes_a: pollRow.votes_a,
          votes_b: pollRow.votes_b,
          ends_at: pollRow.ends_at,
          my_vote: myVote,
        }
      }
      return res.status(200).json({ post })
    }

    const offset = (parseInt(page) - 1) * parseInt(limit)

    // "Interests": posts the signed-in user has liked OR commented on. Requires auth.
    // We gather the post ids from both signals, union them, then page over the posts.
    if (interests) {
      const token = req.headers.authorization?.replace('Bearer ', '')
      if (!token) return res.status(401).json({ error: 'Unauthorized' })
      const { data: { user } } = await supabase.auth.getUser(token)
      if (!user) return res.status(401).json({ error: 'Unauthorized' })

      const [likes, comments] = await Promise.all([
        supabase.from('community_likes').select('post_id').eq('user_id', user.id).not('post_id', 'is', null),
        supabase.from('community_comments').select('post_id').eq('user_id', user.id),
      ])
      const ids = [...new Set([
        ...(likes.data || []).map(l => l.post_id),
        ...(comments.data || []).map(c => c.post_id),
      ].filter(Boolean))]

      if (ids.length === 0) {
        return res.status(200).json({ posts: [], total: 0, page: parseInt(page), totalPages: 0 })
      }

      let iq = supabase.from('community_posts').select('*', { count: 'exact' }).in('id', ids)
      if (blockedIds.length) iq = iq.not('user_id', 'in', `(${blockedIds.join(',')})`)
      if (category && category !== 'all') iq = iq.eq('category', category)
      const q = sanitizeSearch(search)
      if (q) {
        iq = iq.or(`title.ilike.%${q}%,content.ilike.%${q}%`)
      }
      iq = iq.order('created_at', { ascending: false }).range(offset, offset + parseInt(limit) - 1)

      const { data: iData, error: iErr, count: iCount } = await iq
      if (iErr) return res.status(500).json({ error: iErr.message })

      const iPostIds = iData.map(p => p.id)
      let iLiked = []
      if (iPostIds.length > 0) {
        const { data: ls } = await supabase
          .from('community_likes')
          .select('post_id')
          .eq('user_id', user.id)
          .in('post_id', iPostIds)
        iLiked = (ls || []).map(l => l.post_id)
      }
      const iIds = iData.map(p => p.user_id)
      const [iTierMap, iCvMap, iUtMap, iAvMap, iNameMap, iFollowSet] = await Promise.all([
        representativeBadgeMap(iIds),
        companyVerifiedMap(iIds),
        userTypeMap(iIds),
        avatarMap(iIds),
        nameMap(iIds),
        followingSet(iIds, user.id),
      ])

      return res.status(200).json({
        posts: iData.map(p => ({ ...p, is_liked: iLiked.includes(p.id), author_badge: iTierMap[p.user_id] || null, author_salary_tier: salaryTierOf(iTierMap[p.user_id]), author_verified_company: iCvMap[p.user_id] || null, author_user_type: iUtMap[p.user_id]?.user_type || null, author_verified_school: iUtMap[p.user_id]?.verified_school || null, author_avatar: p.is_anonymous ? null : (iAvMap[p.user_id] || null), author_name: resolveAuthorName(p, iNameMap), author_is_following: authorIsFollowing(p, iFollowSet, user.id) })),
        total: iCount,
        page: parseInt(page),
        totalPages: Math.ceil(iCount / parseInt(limit))
      })
    }

    // 인기글은 count를 아래에서 ranked.length로 다시 구하므로, 비싼 exact-count(전체 COUNT 스캔)를 생략한다.
    let query = sort === 'popular'
      ? supabase.from('community_posts').select('*')
      : supabase.from('community_posts').select('*', { count: 'exact' })

    if (blockedIds.length) query = query.not('user_id', 'in', `(${blockedIds.join(',')})`)

    if (mine) {
      const token = req.headers.authorization?.replace('Bearer ', '')
      if (token) {
        const { data: { user } } = await supabase.auth.getUser(token)
        if (user) query = query.eq('user_id', user.id)
      }
    }

    // 공개 프로필 "최근활동" 탭: 특정 유저가 공개(비익명)로 쓴 글만. 익명 글은 user_id로
    // 역추적되면 안 되므로 is_anonymous=false로 못박는다(익명 글은 애초에 프로필도 안 열림).
    if (req.query.author_id) {
      query = query.eq('user_id', req.query.author_id).eq('is_anonymous', false)
    }

    if (category && category !== 'all') {
      query = query.eq('category', category)
    }

    const q = sanitizeSearch(search)
    if (q) {
      query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%`)
    }

    // 회사 페이지 "소식" 탭: 제목/내용에 회사명이 언급됐거나, 그 글의 댓글
    // 내용에 회사명이 언급된 글을 모은다. (글쓴이 소속이 아니라 "언급" 기준.)
    // PostgREST or() 파싱을 깨뜨리는 쉼표/괄호는 공백으로 치환.
    if (req.query.company && req.query.company.trim()) {
      const c = req.query.company.trim().replace(/[(),]/g, ' ')
      const { data: cmts } = await supabase
        .from('community_comments')
        .select('post_id')
        .ilike('content', `%${c}%`)
      const commentPostIds = [...new Set((cmts || []).map(x => x.post_id).filter(Boolean))]
      const ors = [`title.ilike.%${c}%`, `content.ilike.%${c}%`]
      if (commentPostIds.length) ors.push(`id.in.(${commentPostIds.join(',')})`)
      query = query.or(ors.join(','))
    }

    // 커뮤니티 "팔로잉" 탭: 로그인 사용자가 팔로우한 회사들이 제목/내용/댓글에 언급된 글.
    // 회사 "소식" 탭과 동일한 언급(ilike) 기준을, 팔로우한 회사 전체로 확장한 것. 로그인 필요.
    if (req.query.following) {
      const token = req.headers.authorization?.replace('Bearer ', '')
      if (!token) return res.status(401).json({ error: 'Unauthorized' })
      const { data: { user } } = await supabase.auth.getUser(token)
      if (!user) return res.status(401).json({ error: 'Unauthorized' })

      const { data: follows } = await supabase
        .from('company_follows')
        .select('company_name')
        .eq('user_id', user.id)
      // PostgREST or() 파싱을 깨뜨리는 쉼표/괄호는 공백으로 치환.
      const companies = [...new Set((follows || []).map(f => f.company_name).filter(Boolean))]
        .map(c => c.replace(/[(),]/g, ' ').trim())
        .filter(Boolean)
      // 팔로우한 회사가 없으면 보여줄 글도 없다.
      if (!companies.length) {
        return res.status(200).json({ posts: [], total: 0, page: parseInt(page), totalPages: 0 })
      }
      const { data: cmts } = await supabase
        .from('community_comments')
        .select('post_id')
        .or(companies.map(c => `content.ilike.%${c}%`).join(','))
      const commentPostIds = [...new Set((cmts || []).map(x => x.post_id).filter(Boolean))]
      const ors = []
      companies.forEach(c => { ors.push(`title.ilike.%${c}%`, `content.ilike.%${c}%`) })
      if (commentPostIds.length) ors.push(`id.in.(${commentPostIds.join(',')})`)
      query = query.or(ors.join(','))
    }

    let data, count
    if (sort === 'popular') {
      // 인기글 = hotScore(댓글>좋아요>조회) 랭킹. 최근 30일 글을 후보로 삼되,
      // 그 안에 글이 없으면 전체 최신글로 fallback해 인기게시글 영역이 비지 않게 한다.
      const { data: pool, error: poolErr } = await query
        .order('created_at', { ascending: false })
        .limit(200)
      if (poolErr) return res.status(500).json({ error: poolErr.message })
      // window=N(일) 안의 글을 후보로. 기본 30일(인기탭). HOT 카드는 window=7로 호출.
      // 좁힌 창이 비면 30일 → 전체 순으로 fallback해 HOT 영역이 비지 않게 한다.
      const days = ([7, 30].includes(parseInt(req.query.window)) ? parseInt(req.query.window) : 30)
      const within = n => (pool || []).filter(p => Date.now() - new Date(p.created_at).getTime() < n * 24 * 60 * 60 * 1000)
      const recent = within(days).length ? within(days) : (within(30).length ? within(30) : (pool || []))
      const ranked = recent.sort((a, b) => hotScore(b) - hotScore(a))
      count = ranked.length
      data = ranked.slice(offset, offset + parseInt(limit))
    } else {
      const { data: d, error: e, count: c } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + parseInt(limit) - 1)
      if (e) return res.status(500).json({ error: e.message })
      data = d
      count = c
    }

    // If user is logged in, check which posts they've liked
    const token = req.headers.authorization?.replace('Bearer ', '')
    let likedPostIds = []
    let currentUserId = null
    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token)
      if (user) {
        currentUserId = user.id
        const postIds = data.map(p => p.id)
        if (postIds.length > 0) {
          const { data: likes } = await supabase
            .from('community_likes')
            .select('post_id')
            .eq('user_id', user.id)
            .in('post_id', postIds)
          likedPostIds = (likes || []).map(l => l.post_id)
        }
      }
    }

    // 작성자 부가정보 맵은 서로 독립적이라 병렬로 받아 응답 시간을 줄인다.
    const ids = data.map(p => p.user_id)
    const [tierMap, cvMap, utMap, avMap, nMap, pollMap, followSet] = await Promise.all([
      representativeBadgeMap(ids),
      companyVerifiedMap(ids),
      userTypeMap(ids),
      avatarMap(ids),
      nameMap(ids),
      pollsForPosts(data.map(p => p.id), currentUserId),
      followingSet(ids, currentUserId),
    ])

    // 익명(비로그인) 목록은 모두에게 동일 → 짧게 CDN 캐시(홈 인기글 콜드 ~3초 → 캐시 즉시 응답).
    // 토큰이 있으면 is_liked/팔로우 등 개인화가 섞이므로 캐시하지 않는다.
    res.setHeader(
      'Cache-Control',
      req.headers.authorization ? 'no-store' : 'public, s-maxage=60, stale-while-revalidate=300',
    )

    return res.status(200).json({
      posts: data.map(p => ({ ...p, is_liked: likedPostIds.includes(p.id), poll: pollMap[p.id] || null, author_badge: tierMap[p.user_id] || null, author_salary_tier: salaryTierOf(tierMap[p.user_id]), author_verified_company: cvMap[p.user_id] || null, author_user_type: utMap[p.user_id]?.user_type || null, author_verified_school: utMap[p.user_id]?.verified_school || null, author_avatar: p.is_anonymous ? null : (avMap[p.user_id] || null), author_name: resolveAuthorName(p, nMap), author_is_following: authorIsFollowing(p, followSet, currentUserId) })),
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / parseInt(limit))
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
        return res.status(403).json({ error: 'not_member', message: '학생 또는 직장인 인증 후 글을 작성할 수 있어요.' })
      }
    }

    const { category, title, content, is_anonymous } = req.body
    if (!category || !title || !content) {
      return res.status(400).json({ error: 'Missing required fields' })
    }
    const image_urls = sanitizeImageUrls(req.body.image_urls)

    const validCategories = ['ask_company', 'daily', 'job_change']
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: 'Invalid category' })
    }

    // Use the user's current profile name (editable via /api/profile/talent),
    // NOT the auth signup metadata which is frozen at sign-up time.
    const { data: authorProfile } = await supabase
      .from('user_profiles')
      .select('full_name, photo_url')
      .eq('id', user.id)
      .maybeSingle()
    const realName = authorProfile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
    const authorName = is_anonymous
      ? (realName.charAt(0) + '**')
      : realName

    // Author company / salary badges are derived at read time from the
    // email-verified company badge (see companyVerifiedMap / representativeBadgeMap),
    // not from any self-entered field at write time.
    const { data, error } = await supabase
      .from('community_posts')
      .insert({
        user_id: user.id,
        author_name: authorName,
        // 앱에서 직접 등록한 프사(user_profiles.photo_url)만 사용한다.
        // 구글/애플 소셜 아바타(user_metadata.avatar_url)는 쓰지 않는다 — 프사 미등록이면 이니셜로.
        author_avatar: is_anonymous ? null : (authorProfile?.photo_url || null),
        category,
        title,
        content,
        image_urls,
        is_anonymous: is_anonymous !== false
      })
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })

    // 선택: A/B 투표 첨부. 두 선택지가 모두 있고 마감시간이 유효할 때만 생성.
    const poll = req.body.poll
    if (poll && typeof poll.option_a === 'string' && typeof poll.option_b === 'string'
        && poll.option_a.trim() && poll.option_b.trim()) {
      const hours = Math.min(Math.max(parseInt(poll.duration_hours) || 24, 1), 720) // 1시간~30일
      const endsAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
      await supabase.from('community_polls').insert({
        post_id: data.id,
        option_a: poll.option_a.trim().slice(0, 80),
        option_b: poll.option_b.trim().slice(0, 80),
        ends_at: endsAt,
      })
    }

    // 팔로우 회사 언급 알림은 실시간으로 보내지 않는다 —
    // /api/cron/follow-digest가 하루 1번 묶어서 발송한다(company_post, 기본 OFF).

    return res.status(201).json(data)
  }

  if (req.method === 'PUT') {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: 'Unauthorized' })

    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

    const { id } = req.query
    const { category, title, content } = req.body
    if (!category || !title || !content) {
      return res.status(400).json({ error: 'Missing required fields' })
    }
    const image_urls = sanitizeImageUrls(req.body.image_urls)

    const { data, error } = await supabase
      .from('community_posts')
      .update({ category, title, content, image_urls })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'DELETE') {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: 'Unauthorized' })

    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

    const { id } = req.query
    const { error } = await supabase
      .from('community_posts')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
