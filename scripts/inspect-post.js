require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  // 1. Find the target post
  const { data: posts, error } = await supabase
    .from('community_posts')
    .select('id, title, author_name, author_company, like_count, comment_count, view_count, created_at, user_id, is_anonymous')
    .ilike('title', '%15 frameworks%')
  if (error) throw error
  console.log('=== MATCHING POSTS ===')
  console.log(JSON.stringify(posts, null, 2))

  // 2. List seed / system accounts present in prod
  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const seeds = (list?.users || []).filter(u =>
    (u.email || '').endsWith('@dummy.local') || (u.email || '') === 'community@system.local'
  )
  console.log(`\n=== SEED/SYSTEM ACCOUNTS PRESENT: ${seeds.length} ===`)
  seeds.forEach(u => console.log(`${u.id}  ${u.email}  ${u.user_metadata?.full_name || ''}`))

  // 3. existing comments on the post (if found)
  if (posts && posts.length) {
    for (const p of posts) {
      const { data: cmts } = await supabase
        .from('community_comments')
        .select('id, author_name, content, user_id, created_at')
        .eq('post_id', p.id)
      console.log(`\n=== EXISTING COMMENTS on "${p.title.slice(0,40)}": ${cmts?.length || 0} ===`)
      ;(cmts || []).forEach(c => console.log(`- ${c.author_name}: ${c.content.slice(0,60)}`))
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
