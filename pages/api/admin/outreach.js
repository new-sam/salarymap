import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    // PostgREST 는 요청당 1000행으로 캡되므로 끝까지 페이지네이션해서 전부 가져온다.
    const PAGE = 1000
    const all = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('cold_outreach')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false }) // 고유 tiebreaker — created_at 이 대량 동일(벌크 적재)이라 이거 없으면 range 페이지 경계에서 행이 중복/누락됨
        .range(from, from + PAGE - 1)
      if (error) return res.status(500).json({ error: error.message })
      all.push(...(data || []))
      if (!data || data.length < PAGE) break
    }
    return res.status(200).json(all)
  }

  if (req.method === 'POST') {
    const { data, error } = await supabase
      .from('cold_outreach')
      .insert(req.body)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  if (req.method === 'PUT') {
    const { id, ...updates } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })
    const { data, error } = await supabase
      .from('cold_outreach')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'DELETE') {
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })
    const { error } = await supabase.from('cold_outreach').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
