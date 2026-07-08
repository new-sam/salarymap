import { createClient } from '@supabase/supabase-js'
import { notifyTeamNewApplication } from '../../lib/notifyTeamNewApplication'
import { notifyApplicantReceipt } from '../../lib/notifyApplicantReceipt'

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
  // CV 등록 완료 모달에서 원탭 지원한 경우 — 가입→지원 전환 개선 효과 측정용 마커.
  if (applicationSource === 'cv_success') return 'cv_success'
  if (referrer && SALARY_REFERRER_RE.test(referrer)) return 'salary'
  return 'direct'
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const {
    jobId, jobTitle, jobCompany, resumeUrl,
    applicantRole, applicantExperience, applicantSalary,
    applicantCompany, applicantEmail, applicantName,
    utmSource, utmMedium, utmCampaign, utmContent, referrer, applicationSource,
  } = req.body

  // Never trust a client-supplied user_id — it let anyone attribute a forged
  // application to another person's account. Derive it from the bearer token
  // instead; anonymous applications (no token) are still allowed with user_id null.
  let userId = null
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (token) {
    const { data: { user } } = await supabase.auth.getUser(token)
    if (user) userId = user.id
  }

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

  console.log(`[JOB APPLICATION] user=${userId || 'anon'} applied to job=${jobId}`)

  // 지원자 & 채용팀 두 축에 알림 메일 발송.
  // 서버리스에서 fire-and-forget 하면 response 반환 후 프로세스가 종료돼 promise 가
  // discard 될 수 있어 실제로 발송이 안 나가는 사례가 있었다 → await 로 반드시 완료.
  // 두 helper 모두 절대 throw 하지 않으므로 지원 접수 자체는 안전.
  // 병렬로 돌리되 각자 안에서 순차 처리 (Resend 2 req/sec 제한은 각 함수가 알아서 회피).
  if (data?.id) {
    const [applicantResult, teamResult] = await Promise.all([
      notifyApplicantReceipt(data.id),
      notifyTeamNewApplication(data.id),
    ])
    if (!applicantResult?.ok) console.warn('[JOB APPLICATION] applicant receipt not sent:', applicantResult?.reason)
    if (!teamResult?.ok) console.warn('[JOB APPLICATION] team notify not sent:', teamResult?.reason)
  }

  return res.status(201).json({ success: true, data })
}
