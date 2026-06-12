import { createClient } from '@supabase/supabase-js'
import { getSalaryTier } from '../../../lib/salaryTiers'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// 인기글 가중치 — 홈/모바일/daily-hot-post와 동일(댓글>좋아요>조회).
function hotScore(p) {
  return (p.comment_count || 0) * 4 + (p.like_count || 0) * 3 + (p.view_count || 0) * 0.3
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

// Map of user_id -> salary tier key for users with an active salary-range badge.
// Shown next to authors (incl. anonymous) as a trust signal.
async function salaryTierMap(userIds) {
  const ids = [...new Set(userIds)].filter(Boolean)
  if (!ids.length) return {}
  const { data } = await supabase
    .from('user_badges')
    .select('user_id, salary_amount')
    .in('user_id', ids)
    .eq('badge_type', 'salary_range')
    .eq('is_active', true)
  const map = {}
  ;(data || []).forEach(b => {
    const tier = getSalaryTier(b.salary_amount)
    if (tier) map[b.user_id] = tier.key
  })
  return map
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
// uploaded in-app. Used to override author_avatar on non-anonymous posts so the
// in-app photo shows even when there's no social avatar. Anonymous posts skip this.
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

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { category, page = 1, limit = 20, sort = 'recent', search, id: postId, mine, interests } = req.query
    const blockedIds = await blockedIdsFor(req.headers.authorization?.replace('Bearer ', ''))

    // Single post fetch
    if (postId) {
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
        }
      }
      const uid = [post.user_id]
      const [tierMap, cvMap, utMap, avMap, nMap] = await Promise.all([
        salaryTierMap(uid),
        companyVerifiedMap(uid),
        userTypeMap(uid),
        avatarMap(uid),
        nameMap(uid),
      ])
      post.author_salary_tier = tierMap[post.user_id] || null
      post.author_verified_company = cvMap[post.user_id] || null
      post.author_user_type = utMap[post.user_id]?.user_type || null
      post.author_verified_school = utMap[post.user_id]?.verified_school || null
      post.author_avatar = post.is_anonymous ? null : (avMap[post.user_id] || post.author_avatar || null)
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
      if (search && search.trim()) {
        iq = iq.or(`title.ilike.%${search.trim()}%,content.ilike.%${search.trim()}%`)
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
      const [iTierMap, iCvMap, iUtMap, iAvMap, iNameMap] = await Promise.all([
        salaryTierMap(iIds),
        companyVerifiedMap(iIds),
        userTypeMap(iIds),
        avatarMap(iIds),
        nameMap(iIds),
      ])

      return res.status(200).json({
        posts: iData.map(p => ({ ...p, is_liked: iLiked.includes(p.id), author_salary_tier: iTierMap[p.user_id] || null, author_verified_company: iCvMap[p.user_id] || null, author_user_type: iUtMap[p.user_id]?.user_type || null, author_verified_school: iUtMap[p.user_id]?.verified_school || null, author_avatar: p.is_anonymous ? null : (iAvMap[p.user_id] || p.author_avatar || null), author_name: resolveAuthorName(p, iNameMap) })),
        total: iCount,
        page: parseInt(page),
        totalPages: Math.ceil(iCount / parseInt(limit))
      })
    }

    let query = supabase
      .from('community_posts')
      .select('*', { count: 'exact' })

    if (blockedIds.length) query = query.not('user_id', 'in', `(${blockedIds.join(',')})`)

    if (mine) {
      const token = req.headers.authorization?.replace('Bearer ', '')
      if (token) {
        const { data: { user } } = await supabase.auth.getUser(token)
        if (user) query = query.eq('user_id', user.id)
      }
    }

    if (category && category !== 'all') {
      query = query.eq('category', category)
    }

    if (search && search.trim()) {
      query = query.or(`title.ilike.%${search.trim()}%,content.ilike.%${search.trim()}%`)
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

    let data, count
    if (sort === 'popular') {
      // 인기글 = hotScore(댓글>좋아요>조회) 랭킹. 최근 30일 글을 후보로 삼되,
      // 그 안에 글이 없으면 전체 최신글로 fallback해 인기게시글 영역이 비지 않게 한다.
      const { data: pool, error: poolErr } = await query
        .order('created_at', { ascending: false })
        .limit(200)
      if (poolErr) return res.status(500).json({ error: poolErr.message })
      const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
      const recent = (pool || []).filter(p => new Date(p.created_at).getTime() >= monthAgo)
      const ranked = (recent.length ? recent : (pool || [])).sort((a, b) => hotScore(b) - hotScore(a))
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
    const [tierMap, cvMap, utMap, avMap, nMap, pollMap] = await Promise.all([
      salaryTierMap(ids),
      companyVerifiedMap(ids),
      userTypeMap(ids),
      avatarMap(ids),
      nameMap(ids),
      pollsForPosts(data.map(p => p.id), currentUserId),
    ])

    return res.status(200).json({
      posts: data.map(p => ({ ...p, is_liked: likedPostIds.includes(p.id), poll: pollMap[p.id] || null, author_salary_tier: tierMap[p.user_id] || null, author_verified_company: cvMap[p.user_id] || null, author_user_type: utMap[p.user_id]?.user_type || null, author_verified_school: utMap[p.user_id]?.verified_school || null, author_avatar: p.is_anonymous ? null : (avMap[p.user_id] || p.author_avatar || null), author_name: resolveAuthorName(p, nMap) })),
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
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()
    const realName = authorProfile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
    const authorName = is_anonymous
      ? (realName.charAt(0) + '**')
      : realName

    // Author company / salary badges are derived at read time from the
    // email-verified company badge (see companyVerifiedMap / salaryTierMap),
    // not from any self-entered field at write time.
    const { data, error } = await supabase
      .from('community_posts')
      .insert({
        user_id: user.id,
        author_name: authorName,
        author_avatar: is_anonymous ? null : user.user_metadata?.avatar_url,
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
