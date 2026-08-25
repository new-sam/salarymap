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

// 한국어 역량 요구 공고만 골라내는 필터 (?korean=1) — 메타 광고 착지 딥링크용.
// 요구사항이 본문 텍스트에만 있어서(전용 컬럼 없음) description까지 읽어 거른 뒤
// 응답에서는 다시 뺀다 — 목록 페이로드는 평소와 동일하게 유지.
const KOREAN_RE = /한국어|topik|tiếng\s*hàn|tieng\s*han|hàn\s*ngữ|korean[\s-]*(language|speaking|proficiency|communication|fluent|skill|level)|fluent\s+(in\s+)?korean|speak\s+korean|korean\s+required/i

export default async function handler(req, res) {
  const koreanOnly = req.query.korean === '1'
  // Supabase 는 요청당 1,000행이 상한이라 active 공고(1,700건+)가 잘려 오래된 공고가
  // 피드에서 통째로 사라진다 — 다 받을 때까지 페이지로 돈다. 응답 형태(전체 배열)는
  // 배포된 앱이 그대로 의존하므로 유지. created_at 동률(벌크 크롤)에서 경계가 흔들리지
  // 않게 id 를 2차 정렬로 고정한다.
  const PAGE = 1000
  let data = []
  for (let from = 0; ; from += PAGE) {
    let query = supabase
      .from('jobs')
      .select(koreanOnly ? `${LIST_FIELDS}, description` : LIST_FIELDS)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)

    // 회사 페이지에서 특정 회사의 공고만 요청할 때 사용 (?company=)
    if (req.query.company) query = query.ilike('company', String(req.query.company))

    const { data: batch, error } = await query
    if (error) {
      res.setHeader('Cache-Control', 'no-store')
      return res.status(500).json([])
    }
    data = data.concat(batch || [])
    if (!batch || batch.length < PAGE) break
  }

  if (koreanOnly) {
    data = data.filter(j => KOREAN_RE.test(`${j.title || ''}\n${j.description || ''}`))
    for (const j of data) delete j.description
  }

  // CV 완료 모달 랭킹용 누적 지원 수 — ?counts=1일 때만 붙인다(기본 페이로드는 그대로).
  if (req.query.counts === '1') {
    const counts = {}
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
