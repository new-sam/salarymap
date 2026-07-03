require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

// Provision a company (recruiter) account with an email/password login — the
// fallback for companies that can't use Google (e.g. Alimail / non-Workspace).
// We create the account here and hand the credentials to the customer; they
// sign in at /company with the email/password form.
//
// Usage:
//   node scripts/create-company-account.js <email> <password> "<Company Name>" "<Contact Name>"
//
// Mirrors completeCompanySetup() in pages/company/index.js:
//   auth user (email_confirm) -> recruiter_companies (by email_domain) -> recruiter_users (admin)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function findUserByEmail(email) {
  // No getUserByEmail in this SDK — scan the first pages of the user list.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const hit = data.users.find((u) => (u.email || '').toLowerCase() === email)
    if (hit) return hit
    if (data.users.length < 200) break
  }
  return null
}

async function main() {
  const [email, password, companyName, fullName] = process.argv.slice(2)
  if (!email || !password || !companyName) {
    console.error('Usage: node scripts/create-company-account.js <email> <password> "<Company Name>" "<Contact Name>"')
    process.exit(1)
  }
  const normEmail = email.trim().toLowerCase()
  const domain = normEmail.split('@')[1]
  if (!domain) { console.error('Invalid email:', email); process.exit(1) }
  const contact = (fullName || companyName).trim()

  // 1) Auth user — create, or reuse + reset password if it already exists.
  let userId
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: normEmail,
    password,
    email_confirm: true,
  })
  if (createErr) {
    const existing = await findUserByEmail(normEmail)
    if (!existing) throw createErr
    userId = existing.id
    await supabase.auth.admin.updateUserById(userId, { password, email_confirm: true })
    console.log('• Auth user already existed — password reset. id:', userId)
  } else {
    userId = created.user.id
    console.log('• Auth user created. id:', userId)
  }

  // 2) recruiter_companies — one row per email domain (matches web setup logic).
  let { data: company } = await supabase
    .from('recruiter_companies')
    .select('id, name')
    .eq('email_domain', domain)
    .maybeSingle()
  if (!company) {
    const { data: c, error } = await supabase
      .from('recruiter_companies')
      .insert({ name: companyName.trim(), email_domain: domain, created_by: userId })
      .select('id, name')
      .single()
    if (error) throw error
    company = c
    console.log('• Company created:', company.name, company.id)
  } else {
    console.log('• Company already existed:', company.name, company.id)
  }

  // 3) recruiter_users — link the login to the company as admin.
  const { error: linkErr } = await supabase
    .from('recruiter_users')
    .upsert(
      { user_id: userId, company_id: company.id, email: normEmail, full_name: contact, role: 'admin' },
      { onConflict: 'user_id' }
    )
  if (linkErr) throw linkErr
  console.log('• Recruiter linked as admin.')

  console.log('\n✅ Done. Hand these to the customer:')
  console.log('   URL:      https://salary-fyi.com/company')
  console.log('   Email:   ', normEmail)
  console.log('   Password:', password)
}

main().catch((e) => { console.error('❌', e.message || e); process.exit(1) })
