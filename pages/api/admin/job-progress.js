import { createClient } from '@supabase/supabase-js'
import { verifyAdmin } from './check'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// 어드민 오버사이트: 기업 등록(company_self) 공고별 지원 진행현황 요약 (읽기 전용)
export default async function handler(req, res) {
  const admin = await verifyAdmin(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, title, company, company_id, status, is_active, is_featured, created_at, created_by')
    .eq('source', 'company_self')
    .order('created_at', { ascending: false })
  const jobList = jobs || []
  const jobIds = jobList.map(j => j.id)

  // 지원자
  let apps = []
  if (jobIds.length) {
    const { data } = await supabase
      .from('job_applications')
      .select('job_id, status, rejected_at, created_at, updated_at')
      .in('job_id', jobIds)
    apps = data || []
  }

  // 등록자/계정 매핑
  const creatorIds = [...new Set(jobList.map(j => j.created_by).filter(Boolean))]
  const companyIds = [...new Set(jobList.map(j => j.company_id).filter(Boolean))]
  let emailMap = {}, companyMap = {}
  if (creatorIds.length) {
    const { data: ru } = await supabase.from('recruiter_users').select('user_id, email').in('user_id', creatorIds)
    emailMap = Object.fromEntries((ru || []).map(u => [u.user_id, u.email]))
  }
  if (companyIds.length) {
    const { data: rc } = await supabase.from('recruiter_companies').select('id, name').in('id', companyIds)
    companyMap = Object.fromEntries((rc || []).map(c => [c.id, c.name]))
  }

  const byJob = {}
  apps.forEach(a => { (byJob[a.job_id] = byJob[a.job_id] || []).push(a) })

  const result = jobList.map(j => {
    const list = byJob[j.id] || []
    const funnel = { pending: 0, viewed: 0, reviewing: 0, decided: 0, rejected: 0 }
    let lastActivity = null
    list.forEach(a => {
      const s = a.rejected_at ? 'rejected' : (a.status || 'pending')
      if (funnel[s] === undefined) funnel[s] = 0
      funnel[s] += 1
      const ts = a.updated_at || a.created_at
      if (ts && (!lastActivity || ts > lastActivity)) lastActivity = ts
    })
    return {
      id: j.id,
      title: j.title,
      company: j.company,
      account_company: companyMap[j.company_id] || null,
      poster_email: emailMap[j.created_by] || null,
      status: j.status,
      is_active: j.is_active,
      is_featured: j.is_featured,
      created_at: j.created_at,
      total: list.length,
      funnel,
      last_activity: lastActivity,
    }
  })

  return res.status(200).json(result)
}
