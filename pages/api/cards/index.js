// 디지털 명함 발행/조회. 앱이 명함(정보+디자인)을 POST하면 공개 링크를 돌려주고,
// 누구나 그 링크(/c/<token>)로 명함을 보고 연락처로 저장한다(리멤버식).
//  POST { card: { data, design } }   본인 명함 업서트(유저당 1장) + is_published → { token, url }
//  GET                               (로그인) 내 명함 링크 조회 → { token, url } | { url: null }
// user_follows 등과 동일하게 service_role + Bearer 토큰으로 user.id를 검증한다.
import crypto from 'crypto'
import supabase from '../../../lib/supabaseAdmin'

async function userFromReq(req) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user } } = await supabase.auth.getUser(token)
  return user || null
}

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com').replace(/\/$/, '')
}

// URL-safe 짧은 토큰(추측 어렵게).
function newToken() {
  return crypto.randomBytes(12).toString('base64').replace(/[+/=]/g, '').slice(0, 14)
}

export default async function handler(req, res) {
  const me = await userFromReq(req)
  if (!me) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const { data } = await supabase
      .from('business_cards')
      .select('share_token')
      .eq('user_id', me.id)
      .maybeSingle()
    if (!data) return res.status(200).json({ token: null, url: null })
    return res.status(200).json({ token: data.share_token, url: `${siteUrl()}/c/${data.share_token}` })
  }

  if (req.method === 'POST') {
    const card = req.body?.card
    if (!card || typeof card !== 'object' || !card.data) {
      return res.status(400).json({ error: 'card.data required' })
    }

    // 기존 토큰 유지(링크 불변), 없으면 새로 발급.
    const { data: existing } = await supabase
      .from('business_cards')
      .select('share_token')
      .eq('user_id', me.id)
      .maybeSingle()
    const token = existing?.share_token || newToken()

    const { error } = await supabase.from('business_cards').upsert(
      {
        user_id: me.id,
        share_token: token,
        card_data: card,
        is_published: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ token, url: `${siteUrl()}/c/${token}` })
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ error: 'Method not allowed' })
}
