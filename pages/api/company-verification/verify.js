import { createClient } from '@supabase/supabase-js'
import { hashCode } from '../../../lib/companyVerifyCode'
import { isSchoolDomain } from '../../../lib/schoolEmailDomains'

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
)

// Derive a display company name from a domain when no curated mapping exists.
// e.g. 'vng.com.vn' -> 'Vng'. Admin can refine company_domains afterwards.
function guessCompanyName(domain) {
  const root = domain.split('.')[0] || domain
  return root.charAt(0).toUpperCase() + root.slice(1)
}

// Derive a display school name from a domain — the first significant label,
// skipping academic TLD parts. e.g. 'snu.ac.kr' -> 'Snu', 'mit.edu' -> 'Mit'.
// Admin can refine school_domains afterwards.
function guessSchoolName(domain) {
  const root = domain.split('.').find(l => l && l !== 'ac' && l !== 'edu') || domain
  return root.charAt(0).toUpperCase() + root.slice(1)
}

// Resolve + cache a verified SCHOOL on the profile and grant the verified_school
// badge — the student-side mirror of the company path below.
async function grantSchoolVerification(userId, email, domain) {
  const { data: mapped } = await supabase
    .from('school_domains')
    .select('school_name')
    .eq('domain', domain)
    .maybeSingle()

  let schoolName = mapped?.school_name
  if (!schoolName) {
    schoolName = guessSchoolName(domain)
    await supabase.from('school_domains').insert({ domain, school_name: schoolName })
  }

  // user_type is one-way: never downgrade an existing worker back to student. Cache the
  // verified school regardless, but only claim 'student' when not already a worker.
  const { data: cur } = await supabase
    .from('user_profiles')
    .select('user_type')
    .eq('id', userId)
    .maybeSingle()
  const update = {
    id: userId,
    email,
    verified_school_name: schoolName,
    verified_school_domain: domain,
    school_verified_at: new Date().toISOString(),
  }
  if (cur?.user_type !== 'worker') update.user_type = 'student'

  // upsert (not update): mobile OAuth users have no user_profiles row yet (they never hit
  // the web /auth/callback that inserts it), so a plain .update() saved nothing.
  await supabase.from('user_profiles').upsert(update, { onConflict: 'id' })

  await supabase
    .from('user_badges')
    .upsert({
      user_id: userId,
      badge_type: 'verified_school',
      is_active: true,
      granted_at: new Date().toISOString(),
    }, { onConflict: 'user_id,badge_type' })

  return schoolName
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'unauthorized' })
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'unauthorized' })

  const email = (req.body?.email || '').trim().toLowerCase()
  const code = (req.body?.code || '').trim()
  if (!email || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: 'invalid_input', message: '인증 코드 6자리를 입력해주세요.' })
  }

  // Latest unverified attempt for this user+email.
  const { data: row } = await supabase
    .from('company_email_verifications')
    .select('*')
    .eq('user_id', user.id)
    .eq('email', email)
    .is('verified_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!row) return res.status(400).json({ error: 'no_pending', message: '먼저 인증 코드를 요청해주세요.' })
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return res.status(400).json({ error: 'expired', message: '코드가 만료되었습니다. 다시 요청해주세요.' })
  }
  if (row.attempts >= 5) {
    return res.status(400).json({ error: 'too_many_attempts', message: '시도 횟수를 초과했습니다. 다시 요청해주세요.' })
  }

  if (row.code_hash !== hashCode(code)) {
    await supabase
      .from('company_email_verifications')
      .update({ attempts: row.attempts + 1 })
      .eq('id', row.id)
    return res.status(400).json({ error: 'wrong_code', message: '인증 코드가 일치하지 않습니다.', remaining: 4 - row.attempts })
  }

  // Success — mark verified.
  await supabase
    .from('company_email_verifications')
    .update({ verified_at: new Date().toISOString() })
    .eq('id', row.id)

  // A school email proves *student* status, not employment — branch on the domain
  // so academic emails grant the school badge instead of a (wrong) company badge.
  if (isSchoolDomain(row.domain)) {
    const schoolName = await grantSchoolVerification(user.id, user.email, row.domain)
    return res.json({ ok: true, type: 'school', school_name: schoolName })
  }

  // Resolve company name (curated mapping, else auto-create a guess).
  const { data: mapped } = await supabase
    .from('company_domains')
    .select('company_name')
    .eq('domain', row.domain)
    .maybeSingle()

  let companyName = mapped?.company_name
  if (!companyName) {
    companyName = guessCompanyName(row.domain)
    await supabase.from('company_domains').insert({ domain: row.domain, company_name: companyName })
  }

  // Cache on profile + grant the verified_company badge (shown by default).
  // The email-verified company name is the single source of truth — downstream
  // readers (community author label, admin dashboard) all read verified_company_name.
  // upsert (not update): mobile OAuth users have no user_profiles row yet (they never hit
  // the web /auth/callback that inserts it), so a plain .update() saved nothing — the badge
  // landed in user_badges but the company name / user_type never reached user_profiles.
  await supabase
    .from('user_profiles')
    .upsert({
      id: user.id,
      email: user.email,
      verified_company_name: companyName,
      verified_company_domain: row.domain,
      company_verified_at: new Date().toISOString(),
      user_type: 'worker',
    }, { onConflict: 'id' })

  await supabase
    .from('user_badges')
    .upsert({
      user_id: user.id,
      badge_type: 'verified_company',
      is_active: true,
      granted_at: new Date().toISOString(),
    }, { onConflict: 'user_id,badge_type' })

  return res.json({ ok: true, type: 'company', company_name: companyName })
}
