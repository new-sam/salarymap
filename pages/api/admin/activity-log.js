import { createClient } from '@supabase/supabase-js'
import { verifyAdmin } from './check'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// 어드민 활동 로그 — 별도 테이블 없이 events 테이블(event='admin_action')을 재사용
export default async function handler(req, res) {
  const admin = await verifyAdmin(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const { data } = await supabase
      .from('events')
      .select('id, event, meta, created_at')
      .in('event', ['changelog', 'admin_action'])
      .order('created_at', { ascending: false })
      .limit(400)
    const rows = (data || []).map(r => ({
      id: r.id,
      type: r.event === 'changelog' ? 'changelog' : 'action',
      created_at: r.created_at,
      route: r.meta?.route || '',
      routeLabel: r.meta?.routeLabel || r.meta?.route || '기타',
      action: r.meta?.action || '',
      summary: r.meta?.summary || '',
      actor: r.meta?.actor || '',
      commit: r.meta?.commit || '',
      category: r.meta?.category || 'action',
    }))
    return res.status(200).json({
      changelog: rows.filter(r => r.type === 'changelog'),
      actions: rows.filter(r => r.type === 'action'),
    })
  }

  if (req.method === 'POST') {
    const { action, summary, category, meta } = req.body || {}
    if (!action) return res.status(400).json({ error: 'action required' })
    const { error } = await supabase.from('events').insert([{
      event: 'admin_action',
      meta: { action, summary: summary || '', category: category || 'action', actor: admin.email, ...(meta || {}) },
      user_id: admin.id || null,
    }])
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
