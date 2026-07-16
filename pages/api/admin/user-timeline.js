import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'

// 유저 개별 행동 타임라인 (Amplitude User Timeline) — 이탈자 모달에서 유저 클릭 시.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  const user = await verifyAdminOrDevStub(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const key = String(req.query.key || '')
  if (!key || key.length > 80) return res.status(400).json({ error: 'key required' })
  const { from, to } = req.query
  const startISO = new Date(`${from || '2026-04-20'}T00:00:00+07:00`).toISOString()
  const endISO = new Date(new Date(`${to || new Date().toISOString().slice(0, 10)}T00:00:00+07:00`).getTime() + 86400000).toISOString()

  try {
    const { data, error } = await supabase.rpc('user_timeline', {
      p_user_key: key, p_from: startISO, p_to: endISO, p_limit: 300,
    })
    if (error) throw error
    res.status(200).json({
      events: (data || []).map(r => ({ ts: r.ts, event: r.event_name, page: r.props?.page || null })),
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
