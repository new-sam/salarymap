import supabaseAdmin from '../../../lib/supabaseAdmin'
import { verifyAdminOrDevStub } from './check'

/* /admin/showcasing-inquiries 의 데이터 — 전시장에서 들어온 상담 문의.

   후보의 실명·이메일·이력서 링크가 나오는 유일한 API 다. 전시장 쪽(/api/private/*)은
   그 칼럼을 아예 SELECT 하지 않고, 여기는 어드민 토큰 뒤에 있다. 익명 카드와 실명이
   갈리는 선이 파일 경계와 같아야 나중에 실수해도 어느 쪽인지 바로 보인다.

   고른 후보만 편다. 안 고른 넷은 조회하지 않는다 — 문의 하나를 보려고 검색에 걸린
   전원의 신원을 읽을 이유가 없다. */

export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })
  res.setHeader('Cache-Control', 'no-store')

  try {
    if (req.method === 'PATCH') {
      const id = String(req.body?.id || '')
      const status = String(req.body?.status || '')
      if (!id) return res.status(400).json({ error: 'id required' })
      if (!['new', 'contacted', 'met', 'closed'].includes(status)) {
        return res.status(400).json({ error: 'bad status' })
      }
      const { error } = await supabaseAdmin.from('showcase_inquiries').update({ status }).eq('id', id)
      if (error) throw error
      return res.status(200).json({ ok: true })
    }

    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

    const { data: rows, error } = await supabaseAdmin
      .from('showcase_inquiries')
      .select('id, search_id, picked, contact_name, company, email, phone, when_pref, memo, status, created_at')
      .order('created_at', { ascending: false })
      .limit(300)
    if (error) throw error
    if (!rows?.length) return res.status(200).json({ rows: [] })

    const { data: searches } = await supabaseAdmin
      .from('showcase_searches').select('id, picks, criteria, company, created_at')
      .in('id', [...new Set(rows.map((r) => r.search_id))])
    const byId = Object.fromEntries((searches || []).map((s) => [s.id, s]))

    // 고른 후보 전부를 한 번에 — 문의마다 조회하면 목록 한 장에 쿼리가 수십 번이 된다.
    const ids = [...new Set(rows.flatMap((r) => (r.picked || [])
      .map((i) => byId[r.search_id]?.picks?.[i]).filter(Boolean)))]
    const { data: people } = ids.length
      ? await supabaseAdmin.from('user_profiles')
        .select('id, full_name, email, position, headline, yoe_months, resume_url').in('id', ids)
      : { data: [] }
    const byPid = Object.fromEntries((people || []).map((p) => [String(p.id), p]))

    return res.status(200).json({
      rows: rows.map((r) => {
        const s = byId[r.search_id]
        return {
          ...r,
          title: s?.criteria?.title || '',
          // 링크로 들어왔으면 서명에서 푼 기업명 — 폼에 적은 회사명과 다르면 그 차이가
          // 곧 정보다(링크가 사내에서 옮겨 다녔거나, 우리가 잘못 보냈거나).
          linkCompany: s?.company || null,
          candidates: (r.picked || []).map((i) => {
            const p = byPid[String(s?.picks?.[i])]
            return {
              no: i + 1,
              name: p?.full_name || '(이름 없음)',
              email: p?.email || '',
              role: p?.position || p?.headline || '',
              yoe: p?.yoe_months == null ? null : Math.round((p.yoe_months / 12) * 10) / 10,
              resume: p?.resume_url || '',
            }
          }),
        }
      }),
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
