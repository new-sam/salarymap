// 팔로워/팔로잉 목록 — 프로필 주인 "본인만" 열람 가능(익명 커뮤니티 문화 배려).
// 방문자에겐 수(/api/users/profile)만 보이고, 누가 팔로우/내가 누굴 팔로우하는지의
// 명단은 본인에게만 반환한다.
// GET ?type=followers|following&page=&limit=   (Bearer 필수, id는 토큰의 본인으로 고정)
import supabase from '../../../lib/supabaseAdmin'

async function userFromReq(req) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user } } = await supabase.auth.getUser(token)
  return user || null
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const me = await userFromReq(req)
  if (!me) return res.status(401).json({ error: 'Unauthorized' })

  // 명단은 본인 것만. 다른 사람 id를 넘겨도 토큰의 본인으로 강제(우회 방지).
  const type = req.query.type === 'following' ? 'following' : 'followers'
  const page = Math.max(parseInt(req.query.page) || 1, 1)
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 30, 1), 100)
  const offset = (page - 1) * limit

  // followers: 나를 따르는 사람(following_id=나)의 follower_id.
  // following: 내가 따르는 사람(follower_id=나)의 following_id.
  const selfCol = type === 'followers' ? 'following_id' : 'follower_id'
  const otherCol = type === 'followers' ? 'follower_id' : 'following_id'

  const { data: rels, count } = await supabase
    .from('user_follows')
    .select(`${otherCol}, created_at`, { count: 'exact' })
    .eq(selfCol, me.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const ids = (rels || []).map((r) => r[otherCol]).filter(Boolean)
  let profileMap = {}
  if (ids.length) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, full_name, photo_url')
      .in('id', ids)
    ;(profiles || []).forEach((p) => {
      profileMap[p.id] = { full_name: p.full_name || null, photo_url: p.photo_url || null }
    })
  }

  const users = (rels || []).map((r) => {
    const uid = r[otherCol]
    return {
      id: uid,
      full_name: profileMap[uid]?.full_name || null,
      photo_url: profileMap[uid]?.photo_url || null,
      created_at: r.created_at,
    }
  })

  return res.status(200).json({
    type,
    users,
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  })
}
