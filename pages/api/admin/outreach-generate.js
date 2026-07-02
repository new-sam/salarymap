import { verifyAdminOrDevStub } from './check'
import supabaseAdmin from '../../../lib/supabaseAdmin'
import { generateDraft } from '../../../lib/outreachDraft'

// 선택 리드들의 초안을 즉석 생성(+저장). body: { ids:[...], owner }
export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { ids, owner, round } = req.body || {}
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids 필요' })

  const { data: leads } = await supabaseAdmin.from('cold_outreach')
    .select('id, company_name, contact_name, industry, industry_detail, business_desc').in('id', ids)

  const drafts = await Promise.all((leads || []).map(async (l) => {
    try {
      const { subject, body } = await generateDraft(l, owner || 'wsj', round || 1)
      await supabaseAdmin.from('cold_outreach')
        .update({ email_subject: subject, email_body: body, generated_at: new Date().toISOString() })
        .eq('id', l.id)
      return { id: l.id, subject, body }
    } catch (e) {
      return { id: l.id, error: e.message }
    }
  }))
  res.status(200).json({ drafts })
}
