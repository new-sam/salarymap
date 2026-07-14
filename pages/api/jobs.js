import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// 리스트 카드 렌더에 필요한 컬럼만 — 무거운 텍스트(description/benefits/hiring_process)는
// 상세 패널 열 때 /api/jobs/[id]로 lazy fetch한다.
const LIST_FIELDS = [
  'id', 'title', 'company', 'company_initials', 'company_url',
  'company_size', 'location', 'type', 'country', 'role',
  'experience_min', 'experience_max', 'salary_min', 'salary_max',
  'deadline', 'headcount', 'tech_stack', 'image_url', 'images', 'logo_url',
  'apply_url', 'source', 'source_id', 'is_active', 'is_featured', 'created_at',
].join(', ')

export default async function handler(req, res) {
  let query = supabase
    .from('jobs')
    .select(LIST_FIELDS)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  // 회사 페이지에서 특정 회사의 공고만 요청할 때 사용 (?company=)
  if (req.query.company) query = query.ilike('company', String(req.query.company))

  const { data, error } = await query

  if (error || !data) {
    res.setHeader('Cache-Control', 'no-store')
    return res.status(500).json([])
  }

  // CV 완료 모달 랭킹용 누적 지원 수 — ?counts=1일 때만 붙인다(기본 페이로드는 그대로).
  if (req.query.counts === '1') {
    const counts = {}
    const PAGE = 1000
    for (let from = 0; ; from += PAGE) {
      const { data: apps, error: aErr } = await supabase
        .from('job_applications')
        .select('job_id')
        .range(from, from + PAGE - 1)
      if (aErr || !apps || apps.length === 0) break
      for (const a of apps) if (a.job_id) counts[a.job_id] = (counts[a.job_id] || 0) + 1
      if (apps.length < PAGE) break
    }
    for (const j of data) j.application_count = counts[j.id] || 0
  }

  if (data.length === 0) {
    res.setHeader('Cache-Control', 'no-store')
  } else {
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300')
  }
  res.status(200).json(data)
}
