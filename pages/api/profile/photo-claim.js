import { createClient } from '@supabase/supabase-js'
import { verifyToken } from '../../../lib/campaignToken'
import { isPortraitPhoto } from '../../../lib/parseResume'

// 사진 등록 콜드메일(photo1) 원클릭 — 로그인 없이 토큰(campaignToken)으로 본인 프로필 사진 업로드.
// /photo-upload 랜딩이 호출: { t, view: true } = 랜딩 조회 계측, { t, image } = 업로드.
// 업로드는 vision 인물사진 검증을 통과해야 반영(풀 오염 방지 — 8/5 오사진 사고 재발 금지).
const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
)

export const config = { api: { bodyParser: { sizeLimit: '8mb' } } }

const sniff = (buf) => {
  if (buf[0] === 0xff && buf[1] === 0xd8) return { mime: 'image/jpeg', ext: 'jpg' }
  if (buf[0] === 0x89 && buf[1] === 0x50) return { mime: 'image/png', ext: 'png' }
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return { mime: 'image/webp', ext: 'webp' }
  return null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  const { t, view, image } = req.body || {}
  const parsed = verifyToken(t)
  if (!parsed) return res.status(401).json({ error: 'invalid_token' })
  const { userId, campaign } = parsed

  const { data: profile } = await supabase.from('user_profiles').select('id, photo_url').eq('id', userId).maybeSingle()
  if (!profile) return res.status(404).json({ error: 'not_found' })

  // 랜딩 조회 계측(퍼널: 발송 → view → done)
  if (view) {
    try {
      await supabase.from('events').insert([{ event: 'photo_claim_view', page: '/photo-upload', user_id: userId, meta: { campaign } }])
    } catch {}
    return res.status(200).json({ ok: true })
  }

  if (!image || typeof image !== 'string') return res.status(400).json({ error: 'image_required' })
  const b64 = image.replace(/^data:image\/[a-z+]+;base64,/i, '')
  let buf
  try { buf = Buffer.from(b64, 'base64') } catch { return res.status(400).json({ error: 'invalid_image' }) }
  if (buf.length < 2000 || buf.length > 8 * 1024 * 1024) return res.status(400).json({ error: 'invalid_image' })
  const kind = sniff(buf)
  if (!kind) return res.status(400).json({ error: 'unsupported_format' })

  // vision 인물사진 검증 — 명시적 NO/깨진 이미지는 반려, 일시 장애(OpenAI 등)는 통과(전환 손실 방지)
  try {
    const ok = await isPortraitPhoto(buf, kind.mime)
    if (!ok) return res.status(422).json({ error: 'not_portrait' })
  } catch (e) {
    if (/unsupported image/i.test(e.message || '')) return res.status(422).json({ error: 'not_portrait' })
  }

  // 버전드 파일명 — 고정 경로 upsert 는 CDN 캐시가 옛 사진을 계속 서빙한다(profile/upload.js 교훈)
  const path = `${userId}/photo_claim_${Date.now()}.${kind.ext}`
  const { error: upErr } = await supabase.storage.from('profiles').upload(path, buf, { contentType: kind.mime, upsert: true })
  if (upErr) return res.status(500).json({ error: 'upload_failed' })
  const url = supabase.storage.from('profiles').getPublicUrl(path).data?.publicUrl
  if (!url) return res.status(500).json({ error: 'upload_failed' })

  const { error: dbErr } = await supabase.from('user_profiles').update({ photo_url: url }).eq('id', userId)
  if (dbErr) return res.status(500).json({ error: 'db_failed' })

  try {
    await supabase.from('events').insert([{ event: 'photo_claim_done', page: '/photo-upload', user_id: userId, meta: { campaign, replaced: !!profile.photo_url } }])
  } catch {}

  return res.status(200).json({ ok: true, photo_url: url })
}
