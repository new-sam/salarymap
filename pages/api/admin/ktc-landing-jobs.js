import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'

// KTC 랜딩(ktc-landing 레포, 별도 Supabase) 공고 관리 — FYI 어드민에서 목록/등록/수정/노출 토글.
// 랜딩 사이트는 자기 DB(jobs, is_active=true)를 읽으므로 여기서 저장하면 즉시 반영된다.
const landing = createClient(
  process.env.KTC_LANDING_SUPABASE_URL,
  process.env.KTC_LANDING_SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// 수정 허용 필드 (랜딩 jobs 스키마. "Tag" 등 레거시 컬럼은 제외)
const FIELDS = [
  'company_name', 'company_logo', 'company_website', 'location', 'work_type', 'category', 'industry',
  'title', 'salary_min', 'salary_max', 'experience', 'description', 'responsibilities', 'requirements',
  'benefits', 'headcount', 'job_id', 'is_matching_week', 'is_active',
]

const pickFields = (body) => {
  const out = {}
  for (const f of FIELDS) if (f in body) out[f] = body[f] === '' ? null : body[f]
  return out
}

export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })

  try {
    if (req.method === 'GET') {
      const { data, error } = await landing
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return res.json({ jobs: data })
    }

    if (req.method === 'POST') {
      const payload = pickFields(req.body || {})
      if (!payload.company_name || !payload.title) {
        return res.status(400).json({ error: 'company_name and title are required' })
      }
      const { data, error } = await landing.from('jobs').insert(payload).select().single()
      if (error) throw error
      return res.json({ job: data })
    }

    if (req.method === 'PUT') {
      const { id } = req.body || {}
      if (!id) return res.status(400).json({ error: 'id required' })
      const payload = pickFields(req.body)
      const { data, error } = await landing.from('jobs').update(payload).eq('id', id).select().single()
      if (error) throw error
      return res.json({ job: data })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    console.error('ktc-landing-jobs:', e)
    res.status(500).json({ error: e.message })
  }
}
