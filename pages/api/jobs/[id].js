import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// 상세 패널용 단건 조회 — description/benefits/hiring_process 등 무거운 필드 포함 전체 row
export default async function handler(req, res) {
  const { id } = req.query

  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    res.setHeader('Cache-Control', 'no-store')
    return res.status(404).json({ error: 'Not found' })
  }

  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600, stale-while-revalidate=1800')
  res.status(200).json(data)
}
