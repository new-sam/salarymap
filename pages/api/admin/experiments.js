import { createClient } from '@supabase/supabase-js'
import { verifyAdmin } from './check'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  const user = await verifyAdmin(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('experiments')
      .select('*')
      .order('date', { ascending: true })
    if (error) return res.status(500).json({ error: error.message })
    return res.json(data)
  }

  if (req.method === 'POST') {
    const { title, date, color, metrics, status, end_date, result_note } = req.body
    if (!title || !date) return res.status(400).json({ error: 'title, date 필수' })
    const row = { title, date, color: color || '#FF6B6B', status: status || 'running' }
    if (metrics?.length) row.metrics = metrics
    if (end_date) row.end_date = end_date
    if (result_note) row.result_note = result_note
    const { data, error } = await supabase
      .from('experiments')
      .insert([row])
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  if (req.method === 'PUT') {
    const { id, title, date, color, metrics, status, end_date, result_note } = req.body
    if (!id) return res.status(400).json({ error: 'id 필수' })
    const update = {}
    if (title !== undefined) update.title = title
    if (date !== undefined) update.date = date
    if (color !== undefined) update.color = color
    if (metrics !== undefined) update.metrics = metrics
    if (status !== undefined) update.status = status
    if (end_date !== undefined) update.end_date = end_date
    if (result_note !== undefined) update.result_note = result_note
    const { data, error } = await supabase
      .from('experiments')
      .update(update)
      .eq('id', id)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.json(data)
  }

  if (req.method === 'DELETE') {
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'id 필수' })
    const { error } = await supabase.from('experiments').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ ok: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
