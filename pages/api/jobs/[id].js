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

  // AI 생성 회사 소개(있으면). 상세 페이지가 템플릿 대신 우선 사용한다.
  if (data.company) {
    const { data: ov } = await supabase
      .from('company_overviews')
      .select('overview')
      .eq('company', data.company)
      .maybeSingle()
    if (ov?.overview) data.ai_overview = ov.overview
  }

  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600, stale-while-revalidate=1800')
  res.status(200).json(data)
}
