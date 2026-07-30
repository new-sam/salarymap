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

  // KTC 를 통해 지원한 이력도 같은 목록에 합친다. KTC 파이프라인(ktc_candidates)은 매일 갱신되는데
  // 지금까지 최종 합격자에게만 연락이 갔다 → 나머지는 자기 진행 상황을 볼 방법이 없었다.
  // 계정을 만든 이유가 바로 이거라서, 가입 직후 목록이 비어 있으면 안 된다.
  const email = (user.email || '').toLowerCase()
  // 이력은 지원 단위(ktc_applications), 상태는 사람 단위(ktc_candidates)에 있다.
  const [ktcApps, ktcCands] = await Promise.all([
    supabase.from('ktc_applications')
      .select('id, applied_company, applied_job, position, job_code, applied_at, synced_at')
      .eq('email', email),
    supabase.from('ktc_candidates')
      .select('job_code, pipeline_status')
      .eq('email', email),
  ])

  const merged = [...(data || [])]
  if (ktcApps.data?.length) {
    // 상태는 (이메일, job_code) 가 맞는 건에만 붙인다. 사람 단위 상태를 모든 지원에 갖다 붙이면
    // 실제로 진행되지 않은 지원까지 진행된 것처럼 보인다 — 리드 기준 조인율은 48%다.
    const statusByCode = new Map(
      (ktcCands.data || []).filter(c => (c.job_code || '').trim())
        .map(c => [c.job_code.trim(), c.pipeline_status])
    )
    // FYI 로도 같은 자리에 지원했으면 중복이 된다 — 회사+직무로 걸러낸다.
    const seen = new Set(merged.map(a => `${a.job_company || ''}|${a.job_title || ''}`.toLowerCase()))
    for (const r of ktcApps.data) {
      const title = r.applied_job || r.position || ''
      const company = r.applied_company || 'K-Tech College'
      const key = `${company}|${title}`.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      merged.push({
        id: `ktc-${r.id}`,
        job_id: null,
        job_title: title,
        job_company: company,
        status: KTC_STATUS_MAP[statusByCode.get((r.job_code || '').trim())] || 'pending',
        created_at: r.applied_at || r.synced_at,
        source: 'ktc',
      })
    }
    merged.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
  }

  return res.status(200).json({ data: merged })
}

// KTC 내부 파이프라인 → 지원자에게 보이는 4단계(지원·열람·검토·결과). ApplicationCard 가 쓰는 어휘에 맞춘다.
const KTC_STATUS_MAP = {
  new: 'pending',
  passed: 'viewed',
  ready_to_forward: 'viewed',
  sent_to_company: 'reviewing',
  interviewing: 'reviewing',
  final_passed: 'accepted',
  rejected: 'rejected',
  screening_failed: 'rejected',
}
