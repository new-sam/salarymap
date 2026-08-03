import { createClient } from '@supabase/supabase-js'

// 입사 자기신고 — 입사 축하금 클레임의 시작점.
// status(기업이 관리하는 파이프라인)는 건드리지 않고 hired_reported_at 만 찍는다.
// 실제 지급은 입사 후 60일 근속 확인 뒤 어드민이 별도로 승인한다.

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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // 본인 지원 건만 신고할 수 있다 — 클라이언트가 보낸 userId 는 신뢰하지 않는다.
  const user = await getUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { applicationId } = req.body || {}
  if (!applicationId) return res.status(400).json({ error: 'applicationId required' })

  const { data, error } = await supabase
    .from('job_applications')
    .update({ hired_reported_at: new Date().toISOString() })
    .eq('id', applicationId)
    .eq('user_id', user.id)
    .select('id, hired_reported_at')

  if (error) {
    // 마이그레이션(20260803_application_hired_report.sql) 미적용 환경 — 원인이 드러나게 따로 응답한다.
    if (error.code === 'PGRST204' || /hired_reported_at/.test(error.message || '')) {
      return res.status(503).json({ error: 'migration_required' })
    }
    return res.status(500).json({ error: error.message })
  }
  // 남의 지원 건이거나 없는 id — 어느 쪽인지 알려주지 않는다.
  if (!data?.length) return res.status(404).json({ error: 'Not found' })

  return res.status(200).json({ data: data[0] })
}