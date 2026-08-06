import { createClient } from '@supabase/supabase-js'
import { notifyTeamNewApplication } from '../../lib/notifyTeamNewApplication'

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
  // 지원 완료 모달의 유사 공고 원탭 지원 — 유사 공고 유도 효과 측정용 마커.
  if (applicationSource === 'similar_after_apply') return 'similar_after_apply'
  if (referrer && SALARY_REFERRER_RE.test(referrer)) return 'salary'
  return 'direct'
}

export default async function handler(req, res) {
  if (req.method === 'DELETE') return handleCancel(req, res)
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

  // 중복 지원 차단 — 원래는 localStorage(fyi_applied_jobs)로만 막아서 기기가 바뀌면 뚫렸다.
  // 취소(status='canceled')된 지원은 재지원을 허용한다(잘못된 이력서로 낸 지원을 스스로
  // 취소하고 다시 내는 흐름). 비로그인 지원은 신원이 없어 서버 dedup 불가 — 종전과 동일.
  if (userId) {
    const { data: dup } = await supabase
      .from('job_applications')
      .select('id')
      .eq('job_id', jobId)
      .eq('user_id', userId)
      .neq('status', 'canceled')
      .limit(1)
      .maybeSingle()
    if (dup) return res.status(409).json({ error: 'already_applied' })
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

  // 지원자 프로필 4필드는 로그인 사용자면 user_profiles 를 단일 출처로 삼는다.
  // 지원 호출부가 5곳(/jobs 목록·유사공고, /jobs/[id], /cv, /ktc)인데 이 값을 실어
  // 보내는 건 /jobs 두 곳뿐이라, 같은 지원이 경로에 따라 다르게 기록됐다.
  // 클라이언트가 보낸 값은 프로필 행이 없을 때(비로그인 등)만 쓴다.
  //   · role 은 user_profiles.role 이 계정 유형('seeker')이므로 position 을 쓴다
  //   · 경력은 개월(yoe_months)로 통일한다 — 예전엔 연 단위 문자열이 섞여 들어왔다
  //   · 연봉은 월 100만~10억 VND 밖이면 버린다(프로필에 1e13, 20 같은 오염값이 있다)
  let profileFields = null
  if (userId) {
    const { data: p } = await supabase
      .from('user_profiles')
      .select('position, yoe_months, salary_min, verified_company_name')
      .eq('id', userId)
      .maybeSingle()
    if (p) {
      const salary = Number(p.salary_min)
      const salaryOk = Number.isFinite(salary) && salary >= 1_000_000 && salary <= 1_000_000_000
      profileFields = {
        applicant_role: p.position || null,
        applicant_experience: p.yoe_months != null ? String(p.yoe_months) : null,
        applicant_salary: salaryOk ? salary : null,
        applicant_company: p.verified_company_name || null,
      }
    }
  }

  const baseRow = {
    job_id: jobId,
    job_title: resolvedTitle,
    job_company: resolvedCompany,
    user_id: userId || null,
    resume_url: resumeUrl || null,
    ...(profileFields || {
      applicant_role: applicantRole || null,
      applicant_experience: applicantExperience || null,
      applicant_salary: applicantSalary || null,
      applicant_company: applicantCompany || null,
    }),
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

  // 첨부한 이력서를 프로필에도 저장 — 예전엔 job_applications 에만 남아서 이력서를 낸 사람이
  // "이력서 미보유"로 집계되고 인재↔공고 매칭에서도 빠졌다(2026-07-31에 325명 백필).
  // 최신 이력서가 이기게 둔다(다음 지원 때 다시 안 올려도 됨).
  //  · is_resume_public 은 건드리지 않는다 — 우리가 보유하는 것과 인재풀 공개는 별개 동의다.
  //  · 프로필 행이 없는 유저(앱 OAuth 가입)가 있어 update 가 아니라 upsert 다.
  //  · 실패해도 지원 접수는 성공시킨다.
  if (userId && resumeUrl) {
    const profileRow = {
      id: userId,
      resume_url: resumeUrl,
      resume_source: 'application',
      resume_platform: platform,
      updated_at: new Date().toISOString(),
    }
    if (applicantEmail) profileRow.email = applicantEmail
    const { error: syncErr } = await supabase.from('user_profiles').upsert(profileRow, { onConflict: 'id' })
    if (syncErr) console.warn('[JOB APPLICATION] profile resume sync failed:', syncErr.message)
  }

  // 채용팀 알림 메일 발송. (지원자 접수확인 메일은 Resend 하루 100통 한도 소진 문제로 폐지)
  // 서버리스에서 fire-and-forget 하면 response 반환 후 프로세스가 종료돼 promise 가
  // discard 될 수 있어 실제로 발송이 안 나가는 사례가 있었다 → await 로 반드시 완료.
  // helper 는 절대 throw 하지 않으므로 지원 접수 자체는 안전.
  if (data?.id) {
    const teamResult = await notifyTeamNewApplication(data.id)
    if (!teamResult?.ok) console.warn('[JOB APPLICATION] team notify not sent:', teamResult?.reason)
  }

  return res.status(201).json({ success: true, data })
}

// 지원 취소 — 행을 지우지 않고 status='canceled' 로 마킹한다(어드민에서 취소 이력이 보이게).
// 취소하면 위 dedup 이 풀려 같은 공고에 새 이력서로 재지원할 수 있다.
// 본인 확인은 bearer 토큰으로만 — 비로그인 지원(user_id null)은 신원 증명이 없어 취소 불가.
async function handleCancel(req, res) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const jobId = req.query.jobId || req.body?.jobId
  if (!jobId) return res.status(400).json({ error: 'jobId required' })

  const { data, error } = await supabase
    .from('job_applications')
    .update({ status: 'canceled', updated_at: new Date().toISOString() })
    .eq('job_id', jobId)
    .eq('user_id', user.id)
    .neq('status', 'canceled')
    .select('id')

  if (error) return res.status(500).json({ error: error.message })
  console.log(`[JOB APPLICATION] user=${user.id} canceled job=${jobId} (${data?.length || 0} rows)`)
  return res.status(200).json({ success: true, canceled: data?.length || 0 })
}
