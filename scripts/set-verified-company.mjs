import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// Load .env.local manually (dotenv/config reads .env by default)
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL.trim(),
  process.env.SUPABASE_SERVICE_ROLE_KEY.trim(),
)

const EMAIL = 'gourmevel@gmail.com'
const COMPANY = 'Anthropic'
const DOMAIN = 'anthropic.com'

// Find the user by email in user_profiles
const { data: prof, error: profErr } = await supabase
  .from('user_profiles').select('id, email').ilike('email', EMAIL).single()
if (profErr) throw profErr
const user = { id: prof.id, email: prof.email }
console.log('user id:', user.id)

const now = new Date().toISOString()

// Mirror pages/api/company-verification/verify.js: profile + badge
const { error: pErr } = await supabase.from('user_profiles').upsert({
  id: user.id,
  email: user.email,
  verified_company_name: COMPANY,
  verified_company_domain: DOMAIN,
  company_verified_at: now,
  user_type: 'worker',
}, { onConflict: 'id' })
if (pErr) throw pErr

const { error: bErr } = await supabase.from('user_badges').upsert({
  user_id: user.id,
  badge_type: 'verified_company',
  is_active: true,
  granted_at: now,
}, { onConflict: 'user_id,badge_type' })
if (bErr) throw bErr

// Verify
const { data: check } = await supabase
  .from('user_profiles')
  .select('id, email, verified_company_name, verified_company_domain, company_verified_at, user_type')
  .eq('id', user.id)
  .single()
console.log('profile:', check)
