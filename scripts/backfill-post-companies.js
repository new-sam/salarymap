// Backfill community_posts.author_company for seeded posts that were inserted
// with a null company. Mirrors the employment distribution used for comments in
// insert-bulk-community.js (~33% unemployed, ~52% big, ~15% startup).
//
// Safe-guards:
//  - only touches posts where author_company IS NULL
//  - skips authors who have an active verified_company badge (real verified
//    users — their display company comes from the badge, not this field)
//
// Usage: node scripts/backfill-post-companies.js [--dry]
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const BIG = ['Grab', 'Shopee', 'VNG', 'FPT Software', 'Viettel', 'MoMo', 'VNPAY', 'Tiki', 'Vingroup', 'Techcombank', 'Be Group', 'Lazada', 'Sea Group', 'Zalo']
const STARTUP = ['Sky Mavis', 'Coolmate', 'Katalon', 'Holistics', 'Base.vn', 'Got It', 'Elsa', 'Finhay', 'Timo', 'Lozi']
const rint = (a, b) => Math.floor(a + Math.random() * (b - a + 1))
const pick = (arr) => arr[rint(0, arr.length - 1)]

// ~33% unemployed (null), ~52% big, ~15% startup
function rollCompany() {
  const r = Math.random()
  if (r < 0.33) return null
  if (r < 0.85) return pick(BIG)
  return pick(STARTUP)
}

async function main() {
  const dry = process.argv.includes('--dry')

  const { data: posts, error } = await supabase
    .from('community_posts')
    .select('id, user_id, author_company')
    .is('author_company', null)
  if (error) throw error

  // Exclude users with an active verified_company badge.
  const { data: badges } = await supabase
    .from('user_badges')
    .select('user_id')
    .eq('badge_type', 'verified_company')
    .eq('is_active', true)
  const verified = new Set((badges || []).map((b) => b.user_id))

  const targets = posts.filter((p) => !verified.has(p.user_id))
  let filled = 0
  let unemployed = 0

  for (const p of targets) {
    const company = rollCompany()
    if (!company) { unemployed++; continue } // leave as unemployed
    if (dry) { filled++; continue }
    const { error: ue } = await supabase
      .from('community_posts')
      .update({ author_company: company, is_salary_verified: true })
      .eq('id', p.id)
    if (ue) { console.error('update failed', p.id, ue.message); continue }
    filled++
  }

  console.log(`posts null-company: ${posts.length}`)
  console.log(`skipped (verified author): ${posts.length - targets.length}`)
  console.log(`${dry ? '[dry] would fill' : 'filled'} with company: ${filled}`)
  console.log(`left unemployed (~33%): ${unemployed}`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
