import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function getUser(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  return user || null
}

export default async function handler(req, res) {
  // 인증: 토큰에서 본인 id 도출 — 클라이언트가 보낸 userId 는 신뢰하지 않음(IDOR 방지)
  const user = await getUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('job_bookmarks')
      .select('job_id, created_at, jobs(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) return res.status(500).json({ error: error.message })
    return res.json({ bookmarks: data })
  }

  if (req.method === 'POST') {
    const { jobId } = req.body
    if (!jobId) return res.status(400).json({ error: 'jobId required' })

    const { error } = await supabaseAdmin
      .from('job_bookmarks')
      .insert({ user_id: user.id, job_id: jobId })

    if (error && error.code === '23505') {
      return res.json({ action: 'already_exists' })
    }
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ action: 'added' })
  }

  if (req.method === 'DELETE') {
    const { jobId } = req.body
    if (!jobId) return res.status(400).json({ error: 'jobId required' })

    const { error } = await supabaseAdmin
      .from('job_bookmarks')
      .delete()
      .eq('user_id', user.id)
      .eq('job_id', jobId)

    if (error) return res.status(500).json({ error: error.message })
    return res.json({ action: 'removed' })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
