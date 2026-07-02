import { verifyAdminOrDevStub } from './check'
import supabaseAdmin from '../../../lib/supabaseAdmin'
import { sendOutreach } from '../../../lib/gmailSend'

// 선택한 리드들을 (수정된) 제목/본문으로 발송. body: { items:[{id,subject,body}], owner }
export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { items, owner } = req.body || {}
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'items 필요' })

  const ids = items.map(i => i.id)
  const { data: leads } = await supabaseAdmin.from('cold_outreach').select('id, email, owner, status, send_count').in('id', ids)
  const byId = Object.fromEntries((leads || []).map(l => [l.id, l]))

  const results = []
  for (const it of items) {
    const lead = byId[it.id]
    try {
      if (!lead) throw new Error('리드 없음')
      if (!it.subject?.trim() || !it.body?.trim()) throw new Error('제목/본문 비어있음')
      const r = await sendOutreach(owner || lead.owner || 'wsj', {
        to: lead.email, subject: it.subject, body: it.body, leadId: it.id,
      })
      const nextStatus = (lead.status && lead.status !== 'todo') ? lead.status : 'sent'
      await supabaseAdmin.from('cold_outreach').update({
        status: nextStatus,
        sent_at: new Date().toISOString().slice(0, 10),
        send_count: (lead.send_count || 0) + 1,
        gmail_thread_id: r.threadId || null,
        email_subject: it.subject,
        email_body: it.body,
      }).eq('id', it.id)
      results.push({ id: it.id, ok: true })
    } catch (e) {
      results.push({ id: it.id, ok: false, error: e.message })
    }
  }
  res.status(200).json({ results })
}
