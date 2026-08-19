import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'
import { parseResumeBuffer, preserveUserEntered } from '../../../lib/parseResume'

// /admin/korean-cv 백엔드 — 한국식 이력서 첨삭 요청 큐.
//   GET               → 요청 목록(kcv_request events + user_profiles 조인, 발송 여부 포함)
//   POST action=parse → 해당 유저 이력서를 AI 파싱해 편집용 구조화 데이터 + 증명사진 반환.
//                       파싱 결과는 user_profiles 구조화 필드에도 저장(인재풀 데이터 보강,
//                       updated_at 은 안 건드려 이력서풀 지표 착시 방지).
//   POST action=sent  → 발송 완료 마킹(events.kcv_sent)
const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
)

function isValidJpeg(buf) {
  if (buf.length < 4) return false
  if (buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) return false
  return [0xe0, 0xe1, 0xe2, 0xe3, 0xdb, 0xc0, 0xc2, 0xc4, 0xfe].includes(buf[3])
}

// PDF에 박힌 증명사진 후보 추출 (profile/parse-resume 와 같은 휴리스틱)
function extractPhotoFromPdf(buffer) {
  const SOI = Buffer.from([0xff, 0xd8])
  const EOI = Buffer.from([0xff, 0xd9])
  let offset = 0
  while (offset < buffer.length - 1) {
    const startIdx = buffer.indexOf(SOI, offset)
    if (startIdx === -1) break
    const endIdx = buffer.indexOf(EOI, startIdx + 2)
    if (endIdx === -1) break
    const jpeg = buffer.slice(startIdx, endIdx + 2)
    if (jpeg.length > 10000 && jpeg.length < 2 * 1024 * 1024 && isValidJpeg(jpeg)) {
      return `data:image/jpeg;base64,${jpeg.toString('base64')}`
    }
    offset = endIdx + 2
  }
  return null
}

export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const { data: evs, error } = await supabase
      .from('events')
      .select('user_id, event, created_at')
      .in('event', ['kcv_request', 'kcv_sent'])
      .order('created_at', { ascending: false })
      .limit(1000)
    if (error) return res.status(500).json({ error: error.message })

    // 유저별 최신 요청/발송 시각 → 발송이 요청보다 나중이면 처리 완료
    const byUser = {}
    for (const e of evs || []) {
      if (!e.user_id) continue
      const u = (byUser[e.user_id] ||= {})
      if (e.event === 'kcv_request' && !u.requested_at) u.requested_at = e.created_at
      if (e.event === 'kcv_sent' && !u.sent_at) u.sent_at = e.created_at
    }
    const userIds = Object.keys(byUser).filter(id => byUser[id].requested_at)
    if (!userIds.length) return res.json({ requests: [] })

    const { data: profiles, error: pErr } = await supabase
      .from('user_profiles')
      .select('id, email, full_name, resume_url, korean_cert, english_cert, position, yoe_months')
      .in('id', userIds)
    if (pErr) return res.status(500).json({ error: pErr.message })

    const profileById = Object.fromEntries((profiles || []).map(p => [p.id, p]))
    const requests = userIds
      .map(id => ({
        user_id: id,
        requested_at: byUser[id].requested_at,
        sent: !!byUser[id].sent_at && byUser[id].sent_at >= byUser[id].requested_at,
        ...(profileById[id] || {}),
      }))
      .sort((a, b) => (a.requested_at < b.requested_at ? 1 : -1))
    return res.json({ requests })
  }

  if (req.method === 'POST') {
    const { action, userId } = req.body || {}
    if (!userId) return res.status(400).json({ error: 'userId required' })

    if (action === 'parse') {
      const { data: profile, error } = await supabase
        .from('user_profiles').select('id, resume_url, full_name, english_cert, korean_cert, position, yoe_months').eq('id', userId).single()
      if (error || !profile?.resume_url) return res.status(404).json({ error: 'no resume' })

      const fileRes = await fetch(profile.resume_url)
      if (!fileRes.ok) return res.status(500).json({ error: 'resume download failed' })
      const buffer = Buffer.from(await fileRes.arrayBuffer())

      let update
      try {
        update = await parseResumeBuffer(buffer, profile.full_name)
      } catch (e) {
        return res.status(422).json({ error: e.message })
      }
      // 파싱 성공 시 인재풀 구조화 필드도 보강 (updated_at 미변경 — 지표 착시 방지)
      // 사람이 직접 넣은 값(어학·희망직무·연차)은 덮지 않는다(preserveUserEntered 주석 참고).
      await supabase.from('user_profiles').update(preserveUserEntered(update, profile)).eq('id', userId)

      const photo = buffer.subarray(0, 5).toString('latin1') === '%PDF-' ? extractPhotoFromPdf(buffer) : null
      return res.json({ profile: update, photo })
    }

    if (action === 'sent') {
      const { error } = await supabase.from('events').insert([{
        event: 'kcv_sent', page: '/admin/korean-cv', user_id: userId,
        meta: { by: admin.email || 'dev' },
      }])
      if (error) return res.status(500).json({ error: error.message })
      return res.json({ ok: true })
    }

    return res.status(400).json({ error: 'unknown action' })
  }

  return res.status(405).json({ error: 'method not allowed' })
}
