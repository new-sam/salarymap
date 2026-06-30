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

// 디자인 전체 해제에 필요한 고유 열람(친구) 수.
const UNLOCK_TARGET = 3

// 카드의 고유 열람 수 → 해제 여부. 처음 도달하면 designs_unlocked를 영구 true로 굳힌다.
async function unlockState(card) {
  if (!card) return { viewCount: 0, unlocked: false }
  const { count } = await supabase
    .from('card_views')
    .select('id', { count: 'exact', head: true })
    .eq('card_id', card.id)
  const viewCount = count || 0
  const unlocked = card.designs_unlocked || viewCount >= UNLOCK_TARGET
  if (unlocked && !card.designs_unlocked) {
    await supabase.from('business_cards').update({ designs_unlocked: true }).eq('id', card.id)
  }
  return { viewCount, unlocked }
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
      .select('id, share_token, designs_unlocked')
      .eq('user_id', me.id)
      .maybeSingle()
    if (!data) return res.status(200).json({ token: null, url: null, viewCount: 0, unlocked: false, target: UNLOCK_TARGET })
    const { viewCount, unlocked } = await unlockState(data)
    return res.status(200).json({
      token: data.share_token,
      url: `${siteUrl()}/c/${data.share_token}`,
      viewCount,
      unlocked,
      target: UNLOCK_TARGET,
    })
  }

  if (req.method === 'POST') {
    const card = req.body?.card
    if (!card || typeof card !== 'object' || !card.data) {
      return res.status(400).json({ error: 'card.data required' })
    }
    const imageB64 = typeof req.body?.image === 'string' ? req.body.image : null

    // 기존 토큰/이미지 유지(링크 불변), 없으면 새로 발급.
    const { data: existing } = await supabase
      .from('business_cards')
      .select('share_token, card_image_url')
      .eq('user_id', me.id)
      .maybeSingle()
    const token = existing?.share_token || newToken()

    // 명함 캡처 PNG가 오면 공개 스토리지에 업로드(같은 경로 덮어쓰기) → og:image URL.
    let cardImageUrl = existing?.card_image_url ?? null
    if (imageB64) {
      try {
        const buffer = Buffer.from(imageB64, 'base64')
        const path = `cards/${token}.png`
        const { error: upErr } = await supabase.storage
          .from('card-images')
          .upload(path, buffer, { contentType: 'image/png', upsert: true })
        if (!upErr) {
          // 캐시 무력화용 버전 쿼리(수정 후 미리보기 갱신).
          const base = supabase.storage.from('card-images').getPublicUrl(path).data.publicUrl
          cardImageUrl = `${base}?v=${Date.now()}`
        }
      } catch {
        // 업로드 실패해도 발행 자체는 진행(이미지 없이).
      }
    }

    const { error } = await supabase.from('business_cards').upsert(
      {
        user_id: me.id,
        share_token: token,
        card_data: card,
        card_image_url: cardImageUrl,
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

// 명함 캡처 PNG(base64)를 받으므로 본문 크기 제한을 넉넉히.
export const config = { api: { bodyParser: { sizeLimit: '6mb' } } }
