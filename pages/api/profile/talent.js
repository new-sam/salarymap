import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
)

export default async function handler(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'unauthorized' })

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'unauthorized' })

  if (req.method === 'GET') {
    const { data } = await supabase.from('user_profiles').select('*').eq('id', user.id).single()
    return res.json({ profile: data })
  }

  if (req.method === 'PUT') {
    const fields = req.body
    // Whitelist allowed fields
    const allowed = [
      'full_name', 'headline', 'position', 'yoe_months', 'intro', 'skills',
      'english_cert', 'korean_cert', 'location', 'birthdate', 'university',
      'major', 'graduation_year', 'gpa', 'salary_min', 'salary_max', 'salary_currency', 'work_type',
      'job_signal', 'hr_visible', 'photo_url', 'resume_url',
      'experiences', 'projects', 'certs', 'portfolio_url', 'is_resume_public',
      // Profile redesign (20260608_profile_sections.sql)
      'nationality', 'awards', 'languages',
      'career_public', 'education_public', 'skills_public',
      'awards_public', 'languages_public', 'projects_public',
    ]
    // NOTE: user_type is intentionally NOT whitelisted. Student/worker status is earned
    // ONLY by email verification (company-verification/verify.js) — never self-declared —
    // so a client cannot PUT user_type to bypass verification and unlock posting.
    // id/email are server-derived from the auth token (not client input) so the upsert can
    // CREATE the row when it's missing — mobile users sign in via native OAuth and never hit
    // the web /auth/callback that would otherwise insert their user_profiles row, so a plain
    // .update() here silently affected 0 rows and dropped their edits.
    const update = { id: user.id, email: user.email, updated_at: new Date().toISOString() }
    for (const key of allowed) {
      if (key in fields) update[key] = fields[key]
    }

    // If this PUT is the moment a resume_url first lands on the profile
    // (most commonly the jobs-apply → AI prompt path), tag where it came
    // from. X-Resume-Source mirrors what /api/profile/upload reads.
    if ('resume_url' in fields && fields.resume_url) {
      const isApp = req.headers['x-client-platform'] === 'app'
      const rawSource = (req.headers['x-resume-source'] || '').toString().trim().toLowerCase()
      const validSources = new Set(['cv', 'profile', 'jobs'])
      update.resume_platform = isApp ? 'app' : 'web'
      if (isApp) update.resume_source = 'app'
      else if (validSources.has(rawSource)) update.resume_source = rawSource
    }

    const upsert = (row) => supabase.from('user_profiles').upsert(row, { onConflict: 'id' })
    let { error } = await upsert(update)
    // If the resume_source/platform columns don't exist yet (older env), retry without them.
    if (error && (error.code === 'PGRST204' || /resume_(platform|source)/.test(error.message || ''))) {
      const { resume_platform, resume_source, ...withoutSource } = update
      ;({ error } = await upsert(withoutSource))
    }
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ success: true })
  }

  res.status(405).json({ error: 'method not allowed' })
}
