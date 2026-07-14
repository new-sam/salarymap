import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'
import { isExcludedApplication } from '../../../lib/admin-metrics'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const countOf = async (q) => { const { count } = await q; return count || 0 }
const evCount = (event, sinceIso) => {
  let q = supabase.from('events').select('*', { count: 'exact', head: true }).eq('event', event)
  if (sinceIso) q = q.gte('created_at', sinceIso)
  return countOf(q)
}

// 어드민 기업/채용 KPI 요약 (기업·공고·지원·for-companies 퍼널)
export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const since30 = new Date(Date.now() - 30 * 864e5).toISOString()
  const since7 = new Date(Date.now() - 7 * 864e5).toISOString()

  const companies = await countOf(supabase.from('recruiter_companies').select('*', { count: 'exact', head: true }))
  const members = await countOf(supabase.from('recruiter_users').select('*', { count: 'exact', head: true }))

  const { data: jobsSrc } = await supabase.from('jobs').select('source, status, is_active')
  const jobs = jobsSrc || []
  const companySelf = jobs.filter(j => j.source === 'company_self').length
  const crawled = jobs.length - companySelf
  const pending = jobs.filter(j => j.status === 'pending_review').length
  const live = jobs.filter(j => j.is_active && j.status !== 'pending_review').length

  // 내부/테스트(@likelion.net 등) 지원은 KPI에서 제외 — NULL 이메일 행을 지키려 JS에서 필터.
  const appRows = []
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from('job_applications').select('applicant_email').range(from, from + 999)
    if (!data?.length) break
    appRows.push(...data)
    if (data.length < 1000) break
  }
  const totalApps = appRows.filter(a => !isExcludedApplication(a)).length

  const fc = {
    enter: { all: await evCount('click_for_companies'), d30: await evCount('click_for_companies', since30), d7: await evCount('click_for_companies', since7) },
    postJob: { all: await evCount('click_post_job'), d30: await evCount('click_post_job', since30), d7: await evCount('click_post_job', since7) },
    contact: { all: await evCount('click_contact_owner'), d30: await evCount('click_contact_owner', since30), d7: await evCount('click_contact_owner', since7) },
  }

  return res.status(200).json({
    companies, members,
    jobs: { total: jobs.length, companySelf, crawled, pending, live },
    applications: { total: totalApps },
    forCompanies: fc,
  })
}
