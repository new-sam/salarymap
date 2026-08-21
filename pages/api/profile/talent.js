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
      'major', 'graduation_year', 'gpa', 'salary_min', 'salary_max', 'salary_currency', 'current_salary', 'work_type',
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
    /* 빈 값이 기존 값을 덮지 못하게 막는 칸.

       /profile 은 폼 전체를 PUT 한다. 그래서 화면을 연 시점에 비어 있던 칸은 그 뒤
       다른 경로로 값이 채워져도 저장 한 번에 ''로 되돌아간다 — 어학은 콜드메일 랜딩
       (/lang)이 따로 쓰는 칸이라 이 어긋남이 실제로 일어난다. 프로필 탭을 열어둔 채
       메일에서 VSTEP 을 누르고 돌아와 이력서를 올리면 방금 받은 값이 사라진다.
       2026-08-05 에 21명, 2026-08-21 에 1명이 이 경로로 지워졌다.

       이력서 파싱이 어학을 비우는 게 아니다(파서가 찾은 칸만 덮어쓴다). 오래된 폼
       상태가 원인이라 화면 쪽에서는 막을 수 없어 여기서 막는다.

       지우려는 사람은 clear 로 명시한다 — 폼이 통째로 실려 오는 PUT 에는 절대
       섞이지 않는 필드라, 실수로 비는 것과 일부러 비우는 것이 구분된다. */
    const KEEP_IF_BLANK = ['english_cert', 'korean_cert']
    const clear = new Set(
      Array.isArray(fields.clear) ? fields.clear.filter((k) => KEEP_IF_BLANK.includes(k)) : [],
    )

    const update = { id: user.id, email: user.email, updated_at: new Date().toISOString() }
    for (const key of allowed) {
      if (!(key in fields)) continue
      if (KEEP_IF_BLANK.includes(key) && !String(fields[key] ?? '').trim() && !clear.has(key)) continue
      update[key] = fields[key]
    }
    // 명시적으로 지우겠다고 한 칸은 null 로 —''는 '안 물어봤다'와 구분이 안 된다.
    for (const key of clear) update[key] = null
    // 이력서 삭제는 null로 통일 — ''는 IS NOT NULL 집계에 잡히는 유령 행을 만든다.
    if (update.resume_url === '') update.resume_url = null

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
    // current_salary(20260813) 미적용 환경도 같은 방식으로 방어.
    if (error && (error.code === 'PGRST204' || /current_salary/.test(error.message || ''))) {
      const { resume_platform, resume_source, current_salary, ...minimal } = update
      ;({ error } = await upsert(minimal))
    }
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ success: true })
  }

  res.status(405).json({ error: 'method not allowed' })
}
