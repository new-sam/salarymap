// One-off: rebalance engagement numbers on EXISTING seeded community rows so
// they match the new distributions in lib/communityContent.js.
//
// Why: older seed posts (esp. hourly "trickle" posts) were inserted with
// like_count: 0 and never accrued likes, and comment likes were skewed too high
// (up to 15) — so comments often out-liked their own post. This fixes rows
// already in the DB; the generation logic fix only affects future seeds.
//
// What it does (system account community@system.local only):
//   - posts:    recompute like_count from the post's existing views (preserving
//               its viral/quiet character); raise absurdly-low views to a floor.
//   - comments: reassign like_count from the new low distribution.
//
// Usage:
//   node scripts/community-rebalance-engagement.js --dry   ← print summary, change nothing
//   node scripts/community-rebalance-engagement.js         ← apply
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const { fetchSystemAccount, commentLikes } = require('../lib/communityContent')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const dry = process.argv.slice(2).includes('--dry')
const rint = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a

// post likes from existing views: ~3–9% of views, floor 3–8 so nothing sits at 0
function postLike(view) {
  const ratio = 0.03 + Math.pow(Math.random(), 1.6) * 0.06
  return Math.max(rint(3, 8), Math.round(view * ratio))
}

async function fetchAll(table, cols, userId) {
  const all = []
  let from = 0
  const PAGE = 1000
  while (true) {
    const { data, error } = await supabase
      .from(table).select(cols).eq('user_id', userId)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    all.push(...(data || []))
    if (!data || data.length < PAGE) break
    from += PAGE
  }
  return all
}

async function main() {
  const sys = await fetchSystemAccount(supabase)
  if (!sys) throw new Error('system account community@system.local not found')

  const posts = await fetchAll('community_posts', 'id, view_count, like_count', sys.id)
  const comments = await fetchAll('community_comments', 'id, like_count', sys.id)
  console.log(`seed posts: ${posts.length}, seed comments: ${comments.length}`)

  let pChanged = 0
  for (const p of posts) {
    let view = p.view_count || 0
    if (view < 80) view = rint(80, 260) // raise dead-low views
    const like = postLike(view)
    if (view === p.view_count && like === p.like_count) continue
    pChanged++
    if (dry) continue
    const { error } = await supabase
      .from('community_posts').update({ view_count: view, like_count: like }).eq('id', p.id)
    if (error) console.error(`post ${p.id}: ${error.message}`)
  }

  let cChanged = 0
  for (const c of comments) {
    const like = commentLikes()
    if (like === c.like_count) continue
    cChanged++
    if (dry) continue
    const { error } = await supabase
      .from('community_comments').update({ like_count: like }).eq('id', c.id)
    if (error) console.error(`comment ${c.id}: ${error.message}`)
  }

  console.log(dry
    ? `(dry) would update ${pChanged} posts, ${cChanged} comments`
    : `done. updated ${pChanged} posts, ${cChanged} comments`)
}

main().catch((e) => { console.error(e); process.exit(1) })
