import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function getUser(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data: { user } } = await supabase.auth.getUser(token)
  return user || null
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // 인증: 토큰에서 본인 id 도출 — 클라이언트가 보낸 userId 는 신뢰하지 않음(IDOR 방지)
  const user = await getUser(req)
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { data, error } = await supabase
    .from('job_applications')
    .select('id, job_id, job_title, job_company, status, created_at, jobs(logo_url, image_url)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  return res.status(200).json({ data })
}
