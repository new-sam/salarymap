// 유저 팔로우 — company_follows(/api/companies/follow)와 동일 패턴의 유저 버전.
// follower_id = 호출자(로그인 사용자), following_id = 대상 유저.
//  GET ?user_id=  대상 유저의 팔로워 수 + 팔로잉 수 + (로그인 시) 내가 팔로우 중인지 (익명 허용)
//  POST { following_id }   팔로우(업서트) + 대상에게 follow 푸시
//  DELETE ?following_id=   언팔로우
import supabase from '../../../lib/supabaseAdmin'
import { sendPush } from '../../../lib/push'
import { createNotification } from '../../../lib/notify'

async function userFromReq(req) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user } } = await supabase.auth.getUser(token)
  return user || null
}

// 대상 유저의 팔로워/팔로잉 수를 한 번에 센다.
async function counts(userId) {
  const [{ count: followers }, { count: following }] = await Promise.all([
    supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('following_id', userId),
    supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('follower_id', userId),
  ])
  return { followerCount: followers || 0, followingCount: following || 0 }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const userId = req.query.user_id
    if (!userId) return res.status(400).json({ error: 'Missing user_id' })
    const { followerCount, followingCount } = await counts(userId)
    let following = false
    const me = await userFromReq(req)
    if (me) {
      const { data } = await supabase
        .from('user_follows')
        .select('id')
        .eq('follower_id', me.id)
        .eq('following_id', userId)
        .maybeSingle()
      following = !!data
    }
    return res.status(200).json({ user_id: userId, followerCount, followingCount, following })
  }

  if (req.method === 'POST') {
    const me = await userFromReq(req)
    if (!me) return res.status(401).json({ error: 'Unauthorized' })
    const followingId = req.body?.following_id
    if (!followingId) return res.status(400).json({ error: 'Missing following_id' })
    if (followingId === me.id) return res.status(400).json({ error: 'Cannot follow yourself' })

    // 이미 팔로우 중이었는지 — 새 팔로우일 때만 푸시(중복 업서트로 매번 알림 가지 않게).
    const { data: existing } = await supabase
      .from('user_follows')
      .select('id')
      .eq('follower_id', me.id)
      .eq('following_id', followingId)
      .maybeSingle()

    const { error } = await supabase
      .from('user_follows')
      .upsert({ follower_id: me.id, following_id: followingId }, { onConflict: 'follower_id,following_id' })
    if (error) return res.status(500).json({ error: error.message })

    // 새 팔로우만 알림. 팔로우는 익명 활동이 아니므로 팔로워 실명을 노출한다(인스타/트위터식).
    if (!existing) {
      // 현재 프로필 이름(편집 가능) 우선, 없으면 가입 메타/이메일 앞부분.
      const { data: prof } = await supabase
        .from('user_profiles').select('full_name').eq('id', me.id).maybeSingle()
      const followerName =
        prof?.full_name || me.user_metadata?.full_name || me.email?.split('@')[0] || 'User'
      sendPush([followingId], {
        title: { vi: 'FYI Cộng đồng', ko: 'FYI 커뮤니티', en: 'FYI Community' },
        body: {
          vi: `${followerName} đã bắt đầu theo dõi bạn`,
          ko: `${followerName}님이 회원님을 팔로우했습니다`,
          en: `${followerName} started following you`,
        },
        category: 'follow',
        // 모바일은 data.user를 받으면 그 사람 공개 프로필 모달을 띄운다(routeFromNotification).
        data: { user: me.id },
      })
      // 인앱 알림함에도 적재. actor_name에 팔로워 실명을 넣어 클라가 "{name}님이 팔로우" 표기.
      // 탭하면 data.user로 팔로워 공개 프로필을 연다.
      createNotification({
        userId: followingId,
        actorId: me.id,
        actorName: followerName,
        type: 'follow',
        data: { user: me.id },
      })
    }
    return res.status(200).json({ ok: true, following: true })
  }

  if (req.method === 'DELETE') {
    const me = await userFromReq(req)
    if (!me) return res.status(401).json({ error: 'Unauthorized' })
    const followingId = req.query.following_id
    if (!followingId) return res.status(400).json({ error: 'Missing following_id' })
    const { error } = await supabase
      .from('user_follows')
      .delete()
      .eq('follower_id', me.id)
      .eq('following_id', followingId)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true, following: false })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
