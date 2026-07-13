import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL.trim(),
  process.env.SUPABASE_SERVICE_ROLE_KEY.trim(),
)

const EMAIL = 'gourmevel@gmail.com'
const TOP_TIER = 'tienty3'
const TOP_AMOUNT_VND = 250000000 // 월 250M VND = 연 30억동, tienty3 임계값

const { data: prof, error: profErr } = await supabase
  .from('user_profiles').select('id, email').ilike('email', EMAIL).single()
if (profErr) throw profErr
console.log('user id:', prof.id)

const now = new Date().toISOString()

// Mirror pages/api/salary-verification/admin.js: grant salary_range badge (raw VND)
const { error: bErr } = await supabase.from('user_badges').upsert({
  user_id: prof.id,
  badge_type: 'salary_range',
  salary_amount: TOP_AMOUNT_VND,
  is_active: true,
  granted_at: now,
}, { onConflict: 'user_id,badge_type' })
if (bErr) throw bErr

// Set it as the representative badge so it displays at the top tier in community
const { error: rErr } = await supabase.from('user_profiles').upsert({
  id: prof.id,
  representative_badge: TOP_TIER,
  representative_tier: TOP_TIER,
}, { onConflict: 'id' })
if (rErr) throw rErr

const { data: badge } = await supabase
  .from('user_badges').select('badge_type, salary_amount, is_active')
  .eq('user_id', prof.id).eq('badge_type', 'salary_range').single()
const { data: p2 } = await supabase
  .from('user_profiles').select('representative_badge, representative_tier')
  .eq('id', prof.id).single()
console.log('badge:', badge)
console.log('representative:', p2)
