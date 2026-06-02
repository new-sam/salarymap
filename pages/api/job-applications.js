import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const {
    jobId, jobTitle, jobCompany, userId, resumeUrl,
    applicantRole, applicantExperience, applicantSalary,
    applicantCompany, applicantEmail, applicantName,
    utmSource, utmMedium, utmCampaign,
  } = req.body

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
  }

  const insert = (row) =>
    supabase.from('job_applications').insert(row).select('id').single()

  let { data, error } = await insert({ ...baseRow, ...utmRow })

  // The UTM columns are added by a separate migration (20260601_add_utm_tracking.sql).
  // If that migration hasn't been applied yet, PostgREST reports the missing column
  // (code PGRST204). Don't let it block the application — retry without UTM fields so
  // the candidate's CV is still recorded.
  if (error && (error.code === 'PGRST204' || /utm_/.test(error.message || ''))) {
    console.warn('[JOB APPLICATION] utm columns missing, retrying without UTM:', error.message)
    ;({ data, error } = await insert(baseRow))
  }

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  console.log(`[JOB APPLICATION] user=${userId} email=${applicantEmail} applied to job=${jobId}`)

  return res.status(201).json({ success: true, data })
}
