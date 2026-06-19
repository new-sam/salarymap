// Backfill community_posts.author_company for SEEDED (bot) posts that were
// inserted with a null company. Mirrors the employment distribution used for
// comments in insert-bulk-community.js (~33% unemployed, ~52% big, ~15% startup).
//
// Safe-guards:
//  - ONLY touches posts authored by the system seed account
//    (community@system.local) — never real users' posts
//  - only touches posts where author_company IS NULL
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

async function findSystemAccountId() {
  let page = 1
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const sys = data.users.find((u) => u.email === 'community@system.local')
    if (sys) return sys.id
    if (data.users.length < 1000) break
    page++
  }
  return null
}

async function main() {
  const dry = process.argv.includes('--dry')

  const sysId = await findSystemAccountId()
  if (!sysId) throw new Error('system account community@system.local not found')

  // Only the bot's own posts — never real users'.
  const { data: targets, error } = await supabase
    .from('community_posts')
    .select('id, user_id, author_company')
    .eq('user_id', sysId)
    .is('author_company', null)
  if (error) throw error

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

  console.log(`bot posts null-company: ${targets.length}`)
  console.log(`${dry ? '[dry] would fill' : 'filled'} with company: ${filled}`)
  console.log(`left unemployed (~33%): ${unemployed}`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
