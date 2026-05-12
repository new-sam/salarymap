import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { userId } = req.query
    if (!userId) return res.status(400).json({ error: 'userId required' })

    const { data, error } = await supabaseAdmin
      .from('job_bookmarks')
      .select('job_id, created_at, jobs(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) return res.status(500).json({ error: error.message })
    return res.json({ bookmarks: data })
  }

  if (req.method === 'POST') {
    const { userId, jobId } = req.body
    if (!userId || !jobId) return res.status(400).json({ error: 'userId and jobId required' })

    const { error } = await supabaseAdmin
      .from('job_bookmarks')
      .insert({ user_id: userId, job_id: jobId })

    if (error && error.code === '23505') {
      return res.json({ action: 'already_exists' })
    }
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ action: 'added' })
  }

  if (req.method === 'DELETE') {
    const { userId, jobId } = req.body
    if (!userId || !jobId) return res.status(400).json({ error: 'userId and jobId required' })

    const { error } = await supabaseAdmin
      .from('job_bookmarks')
      .delete()
      .eq('user_id', userId)
      .eq('job_id', jobId)

    if (error) return res.status(500).json({ error: error.message })
    return res.json({ action: 'removed' })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
