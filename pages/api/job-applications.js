import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// A salary-funnel application is one the visitor reached after using the salary
// product. The client's ?from=salary CTA marker (applicationSource) only fires when
// the user clicks a specific post-submission button, so it misses people who browse
// from the salary page to /jobs and apply without that button — they leak in as
// 'direct'. The original landing referrer recovers them: when it points at the salary
// domain, classify as 'salary'. Same rule as scripts/backfill-application-source.js.
const SALARY_REFERRER_RE = /salary-fyi\.com/i
function classifySource(applicationSource, referrer) {
  if (applicationSource === 'salary') return 'salary'
  if (referrer && SALARY_REFERRER_RE.test(referrer)) return 'salary'
  return 'direct'
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const {
    jobId, jobTitle, jobCompany, userId, resumeUrl,
    applicantRole, applicantExperience, applicantSalary,
    applicantCompany, applicantEmail, applicantName,
    utmSource, utmMedium, utmCampaign, utmContent, referrer, applicationSource,
  } = req.body

  // 유입 플랫폼: 앱(salary-fyi)은 모든 요청에 X-Client-Platform: app 헤더를 붙인다.
  // 헤더가 없으면 웹 직접 호출이므로 'web'. application_source(direct/salary)와는 별개 축.
  const platform = req.headers['x-client-platform'] === 'app' ? 'app' : 'web'

  if (!jobId) {
    return res.status(400).json({ error: 'jobId required' })
  }

  // Look up job title/company server-side as a fallback (in case client didn't pass them)
  let resolvedTitle = jobTitle || null
  let resolvedCompany = jobCompany || null
  if (!resolvedTitle || !resolvedCompany) {
    const { data: job } = await supabase
      .from('jobs')
      .select('title, company')
      .eq('id', jobId)
      .single()
    if (job) {
      resolvedTitle = resolvedTitle || job.title
      resolvedCompany = resolvedCompany || job.company
    }
  }

  const baseRow = {
    job_id: jobId,
    job_title: resolvedTitle,
    job_company: resolvedCompany,
    user_id: userId || null,
    resume_url: resumeUrl || null,
    applicant_role: applicantRole || null,
    applicant_experience: applicantExperience || null,
    applicant_salary: applicantSalary || null,
    applicant_company: applicantCompany || null,
    applicant_email: applicantEmail || null,
    applicant_name: applicantName || null,
  }
  const utmRow = {
    utm_source: utmSource || null,
    utm_medium: utmMedium || null,
    utm_campaign: utmCampaign || null,
    utm_content: utmContent || null,
    referrer: referrer || null,
    application_source: classifySource(applicationSource, referrer),
    platform,
  }

  const insert = (row) =>
    supabase.from('job_applications').insert(row).select('id').single()

  let { data, error } = await insert({ ...baseRow, ...utmRow })

  // The source-tracking columns are added by separate migrations
  // (20260601_add_utm_tracking.sql, 20260602_add_utm_content_referrer.sql,
  // 20260609_add_application_source.sql). If a migration hasn't been applied yet,
  // PostgREST reports the missing column (code PGRST204). Don't let it block the
  // application — retry without source fields so the candidate's CV is still recorded.
  if (error && (error.code === 'PGRST204' || /utm_|referrer|application_source|platform/.test(error.message || ''))) {
    console.warn('[JOB APPLICATION] source columns missing, retrying without UTM/referrer:', error.message)
    ;({ data, error } = await insert(baseRow))
  }

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  console.log(`[JOB APPLICATION] user=${userId} email=${applicantEmail} applied to job=${jobId}`)

  return res.status(201).json({ success: true, data })
}
