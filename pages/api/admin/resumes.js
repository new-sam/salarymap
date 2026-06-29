import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const COLUMNS_FULL = 'id, full_name, headline, position, yoe_months, location, resume_url, photo_url, is_resume_public, skills, university, major, graduation_year, experiences, english_cert, korean_cert, work_type, salary_min, salary_max, salary_currency, resume_platform, resume_source, verified_school_name, verified_school_tier, updated_at, created_at'
    const COLUMNS_FALLBACK = 'id, full_name, headline, position, yoe_months, location, resume_url, photo_url, is_resume_public, skills, university, major, graduation_year, experiences, english_cert, korean_cert, work_type, salary_min, salary_max, salary_currency, resume_platform, verified_school_name, verified_school_tier, updated_at, created_at'

    let { data, error } = await supabase
      .from('user_profiles')
      .select(COLUMNS_FULL)
      .not('resume_url', 'is', null)
      .order('updated_at', { ascending: false })

    // resume_source column is added by 20260621 migration; until it lands in
    // a given env, retry without it so the admin view still works.
    if (error && /resume_source/.test(error.message || '')) {
      ;({ data, error } = await supabase
        .from('user_profiles')
        .select(COLUMNS_FALLBACK)
        .not('resume_url', 'is', null)
        .order('updated_at', { ascending: false }))
    }

    if (error) return res.status(500).json({ error: error.message })

    // Fetch emails from auth
    const userIds = data.map(d => d.id)
    const emails = {}
    if (userIds.length > 0) {
      let page = 1
      while (true) {
        const { data: { users }, error: authErr } = await supabase.auth.admin.listUsers({
          page,
          perPage: 1000,
        })
        if (authErr || !users || users.length === 0) break
        for (const u of users) {
          if (userIds.includes(u.id)) emails[u.id] = u.email
        }
        if (users.length < 1000) break
        page++
      }
    }

    const result = data.map(p => ({
      ...p,
      email: emails[p.id] || '',
    }))

    return res.status(200).json(result)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
