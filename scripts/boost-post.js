require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const POST_ID = '947d2abb-3b2b-4ed7-b1d8-4cb90f763f02'
const TARGET_VIEWS = 3159
const TARGET_LIKES = 118
const DRY = process.argv.includes('--dry')

// --- conventions copied from lib/communityContent.js so this blends in ---
const rint = (a, b) => Math.floor(a + Math.random() * (b - a + 1))
const maskName = (name) => (name ? name.trim().charAt(0) + '**' : 'Anon')
const commentLikes = () => Math.round(Math.pow(Math.random(), 2.6) * 15)
const BIG = ['Grab', 'Shopee', 'VNG', 'FPT Software', 'Viettel', 'MoMo', 'VNPAY', 'Tiki', 'Techcombank']
const STARTUP = ['Sky Mavis', 'Coolmate', 'Katalon', 'Holistics', 'Base.vn', 'Got It', 'Elsa']
const pick = (a) => a[rint(0, a.length - 1)]
function rollCompany() {
  const r = Math.random()
  if (r < 0.4) return null
  if (r < 0.85) return pick(BIG)
  return pick(STARTUP)
}

// English comments engaging the post's topic (dev resumes / what Korean startups want)
// is_anonymous ~50%; author_name stays a real-ish name (masked at display when anon)
const COMMENTS = [
  { name: 'Minh', anon: false, content: "Honestly needed to hear this. Trimmed my CV from 14 'frameworks' to 4 things I can actually defend and got way more callbacks." },
  { name: 'Trang', anon: true, content: "So what do they actually want then? Ownership, or just deep knowledge in one stack?" },
  { name: 'Daniel', anon: false, content: "I interview for a startup here and 100% this. A candidate who ships beats a candidate who lists, every time." },
  { name: 'Hoang', anon: true, content: "Disagree a little. For junior roles the keyword filter is real, you still need the frameworks on paper to pass the first screen." },
  { name: 'Kevin', anon: false, content: "The 'show me one thing you built end to end' part is gold. Saving this." },
  { name: 'Phuong', anon: true, content: "BE dev in HCMC eyeing Korean startups, this is super useful. Thank you." },
  { name: 'Sang', anon: false, content: "Frameworks are cheap now, judgment isn't. Took me 5 years to learn that the hard way." },
  { name: 'Anh', anon: true, content: "Any tips on phrasing impact without sounding like a bot wrote it lol" },
  { name: 'Jisoo', anon: false, content: "They also care a lot about communication and speed, not just tech depth. Can confirm from the inside." },
  { name: 'Tuan', anon: true, content: "Sent this to my whole team. Half of them have the 15-framework resume problem 😂" },
  { name: 'Linh', anon: false, content: "Curious how this differs from what SG or JP startups want. Is it really Korea-specific?" },
  { name: 'David', anon: true, content: "Stop optimizing for the ATS and start optimizing for the human reading line 2 of your resume. This." },
  { name: 'Quan', anon: false, content: "Bookmarked. Wish I'd read this before my last 3 rejections." },
]

async function main() {
  // resolve created_at to scatter comments between post time and now
  const { data: post, error: pErr } = await supabase
    .from('community_posts')
    .select('id, title, created_at, like_count, view_count, comment_count')
    .eq('id', POST_ID)
    .single()
  if (pErr || !post) throw new Error('post not found: ' + (pErr?.message || ''))

  // system account holds all seeded comments
  let page = 1, sys = null
  while (!sys) {
    const { data } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    sys = data.users.find((u) => u.email === 'community@system.local')
    if (sys || data.users.length < 1000) break
    page++
  }
  if (!sys) throw new Error('community@system.local not found')

  // comment timestamps: scattered from a few min after post → now, sorted
  const base = new Date(post.created_at).getTime()
  const now = Date.now()
  const start = base + 4 * 60000
  const span = Math.max(now - start, COMMENTS.length * 4 * 60000)
  const times = COMMENTS.map(() => Math.min(now, start + Math.random() * span)).sort((a, b) => a - b)

  const rows = COMMENTS.map((c, i) => ({
    post_id: POST_ID,
    user_id: sys.id,
    author_name: c.anon ? maskName(c.name) : c.name,
    content: c.content,
    is_anonymous: c.anon,
    like_count: commentLikes(),
    author_company: rollCompany(),
    created_at: new Date(times[i]).toISOString(),
  }))

  console.log(`Post: "${post.title}"`)
  console.log(`  views ${post.view_count} → ${TARGET_VIEWS} | likes ${post.like_count} → ${TARGET_LIKES} | comments ${post.comment_count} → +${rows.length}`)
  console.log(`  hotScore after ≈ ${(rows.length * 4 + TARGET_LIKES * 3 + TARGET_VIEWS * 0.3).toFixed(0)}`)
  if (DRY) {
    rows.forEach((r) => console.log(`   └ ${r.author_name}${r.author_company ? ' ('+r.author_company+')' : ''}: ${r.content}`))
    console.log('\n[dry] nothing written')
    return
  }

  const { error: cErr } = await supabase.from('community_comments').insert(rows)
  if (cErr) throw new Error('comment insert: ' + cErr.message)

  const { error: uErr } = await supabase
    .from('community_posts')
    .update({ view_count: TARGET_VIEWS, like_count: TARGET_LIKES, comment_count: (post.comment_count || 0) + rows.length })
    .eq('id', POST_ID)
  if (uErr) throw new Error('post update: ' + uErr.message)

  console.log(`\n✓ inserted ${rows.length} comments, set views=${TARGET_VIEWS}, likes=${TARGET_LIKES}`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
