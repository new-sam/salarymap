// Shared logic for daily community seeding — used by both the CLI runner
// (scripts/community-daily.js) and the Vercel cron route
// (pages/api/cron/community-daily.js) so the guardrails live in ONE place.
//
// CommonJS on purpose: requ​ire()-able by the raw-node CLI and import-able by
// the Next route (webpack CJS interop). Callers pass their own supabase/openai
// clients; this module never reads env or creates clients.

const CATEGORIES = ['daily', 'job_change']
const rint = (a, b) => Math.floor(a + Math.random() * (b - a + 1))
const maskName = (name) => (name ? name.trim().charAt(0) + '**' : 'Ẩn danh')

// posts are spread across the last 2..36h so a daily batch doesn't cluster
const postTime = () => Date.now() - rint(120, 2160) * 60000

// comments accumulate with real gaps: randomly scattered between the post time
// and now (never in the future), then sorted so they read in order
function commentTimes(base, n) {
  const now = Date.now()
  const start = base + rint(8, 25) * 60000
  const span = Math.max(now - start, n * 5 * 60000)
  const pts = []
  for (let i = 0; i < n; i++) pts.push(Math.min(now, start + Math.random() * span))
  pts.sort((a, b) => a - b)
  return pts.map((t) => new Date(t).toISOString())
}

// view/like distribution — views are the biggest number, post likes a healthy
// fraction of views with a floor so even quiet posts never sit at 0 likes.
function postStats() {
  const r = Math.random()
  const view = r < 0.1 ? rint(1500, 6000) : r < 0.8 ? rint(250, 1500) : rint(80, 260)
  const ratio = 0.03 + Math.pow(Math.random(), 1.6) * 0.06 // ~3–9% of views become likes
  const like = Math.max(rint(3, 8), Math.round(view * ratio)) // floor: 3–8 likes
  return { view_count: view, like_count: like }
}
// comment likes: usually 0–1, occasionally a few, capped low so a comment
// never out-likes its own post.
const commentLikes = () => Math.round(Math.pow(Math.random(), 3) * 5)

// declared author company for seeded comments — same pools/distribution as
// scripts/backfill-post-companies.js so comments blend with posts (~33%
// unemployed/null, ~52% big, ~15% startup)
const BIG_COMPANIES = ['Grab', 'Shopee', 'VNG', 'FPT Software', 'Viettel', 'MoMo', 'VNPAY', 'Tiki', 'Vingroup', 'Techcombank', 'Be Group', 'Lazada', 'Sea Group', 'Zalo']
const STARTUP_COMPANIES = ['Sky Mavis', 'Coolmate', 'Katalon', 'Holistics', 'Base.vn', 'Got It', 'Elsa', 'Finhay', 'Timo', 'Lozi']
const pickFrom = (arr) => arr[rint(0, arr.length - 1)]
function rollCompany() {
  const r = Math.random()
  if (r < 0.33) return null
  if (r < 0.85) return pickFrom(BIG_COMPANIES)
  return pickFrom(STARTUP_COMPANIES)
}

// Guardrails live here — this keeps us on "seed the conversation", not
// "fabricate facts users transact on".
const SYSTEM_PROMPT = `Bạn tạo nội dung cộng đồng cho một app về lương & sự nghiệp ở Việt Nam (đối tượng: dân văn phòng / IT trẻ).
Mục tiêu: gieo những chủ đề ĐỜI THƯỜNG, mở để người thật vào bình luận.

GIỌNG VĂN:
- tiếng Việt, casual, viết thường, như post tâm sự trên forum / group Facebook.
- chân thật, có cảm xúc thật (đôi khi bức xúc, mệt mỏi, hoang mang — không phải lúc nào cũng tích cực). ngắn gọn 3-6 câu mỗi post.
- bình luận như người thật nhắn trên forum: RẤT NGẮN, đa số chỉ 1 câu ngắn hoặc 1 mệnh đề cụt (vd "outsource cân bằng cuộc sống hơn b ơi", "same, mệt vc", "lương vậy ổn mà b", "cố lên b ơi"), họa hoằn mới 2 câu. Dùng viết tắt tự nhiên (b=bạn, k/ko=không, đc=được, vs=với, mn=mọi người, vc), viết thường, không cần dấu câu chuẩn, đôi khi cụt lủn. Nhiều góc nhìn: đồng cảm, khuyên thẳng, kể trải nghiệm riêng, phản biện, hỏi lại — nhưng TUYỆT ĐỐI đừng dài dòng / lên lớp.
- mỗi post và mỗi comment có author_name là một tên/nickname Việt khác nhau (vd: "Tuấn", "Mai Anh", "ng đi làm mệt mỏi", "Khoa BE"...). đa dạng, đừng lặp.
- LUÔN để is_anonymous = true (mọi post và comment đều ẩn danh).
- QUAN TRỌNG: author_name LUÔN là tên/nickname thật, KỂ CẢ khi is_anonymous = true (hệ thống sẽ tự che thành "chữ-đầu + **"). TUYỆT ĐỐI KHÔNG dùng "Ẩn danh" / "ẩn danh" làm author_name.

CHỦ ĐỀ: không nhất thiết về công việc. Đa dạng:
- công sở: deal lương, review, nhảy việc, sếp/đồng nghiệp, burnout, fresher tìm việc, OT, work-life balance.
- đời thường & tâm sự: chuyện vui buồn trong ngày, cô đơn ở thành phố lớn, cuối tuần làm gì, ăn uống, sức khỏe, tiền bạc cá nhân.
- kết bạn / giao lưu: rủ làm quen, hỏi mng cùng ngành/cùng quận, chia sẻ sở thích.
- xin lời khuyên: chuyện tình cảm, gia đình giục cưới, có nên học thêm, quản lý chi tiêu, định hướng tương lai.
Mỗi post chọn một category phù hợp: "job_change" nếu thật sự về chuyện đổi việc, còn lại để "daily".

QUY TẮC BẮT BUỘC (không được vi phạm):
- TUYỆT ĐỐI KHÔNG nhắc TÊN một công ty thật nào (vd cấm: VNG, FPT, Shopee, Grab...). Nói chung chung: "công ty mình", "1 cty lớn", "chỗ cũ".
- KHÔNG để comment nào tự nhận "mình từng làm ở [công ty X]" với công ty có tên thật.
- KHÔNG nêu con số lương cụ thể gắn với tên công ty thật. Số lương chỉ là trải nghiệm cá nhân chung chung.
- KHÔNG nói xấu / cáo buộc tiêu cực nhắm vào công ty thật có tên.
- Chỉ cảm nhận, câu hỏi, trải nghiệm cá nhân. Khác chủ đề với danh sách tiêu đề gần đây.

Trả về JSON:
{ "posts": [ { "category": "daily|job_change", "title": string, "content": string, "author_name": string, "is_anonymous": boolean,
  "comments": [ { "author_name": string, "content": string, "is_anonymous": boolean } ] } ] }
Mỗi post 5-10 comments, số lượng KHÁC NHAU rõ rệt giữa các post (có post chỉ 5, có post 9-10).`

async function fetchSystemAccount(supabase) {
  let page = 1
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const sys = data.users.find((u) => u.email === 'community@system.local')
    if (sys) return sys
    if (data.users.length < 1000) break
    page++
  }
  return null
}

async function fetchRecentTitles(supabase) {
  const { data } = await supabase
    .from('community_posts')
    .select('title')
    .order('created_at', { ascending: false })
    .limit(40)
  return (data || []).map((p) => p.title)
}

async function generate(openai, recentTitles, count) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Tạo ${count} post mới, ưu tiên mỗi cái một category/chủ đề khác nhau.\nTiêu đề gần đây (tránh trùng chủ đề):\n${recentTitles.map((t) => '- ' + t).join('\n') || '(chưa có)'}`,
      },
    ],
    temperature: 1.0,
  })
  const parsed = JSON.parse(completion.choices[0].message.content)
  return Array.isArray(parsed.posts) ? parsed.posts : []
}

// Generate `count` posts and insert them under the system account.
// dry=true prints nothing and inserts nothing — it just returns the payload.
// log is an optional (msg) => void for progress output.
async function runDailySeed({ supabase, openai, count = 6, dry = false, log = () => {} }) {
  const sys = await fetchSystemAccount(supabase)
  if (!sys) throw new Error('system account community@system.local not found')

  const posts = await generate(openai, await fetchRecentTitles(supabase), count)
  if (!posts.length) throw new Error('model returned no posts')

  let insertedPosts = 0
  let insertedComments = 0

  for (const p of posts) {
    const category = CATEGORIES.includes(p.category) ? p.category : 'daily'
    const base = postTime()
    const stats = postStats()
    const comments = Array.isArray(p.comments) ? p.comments.slice(0, 10) : []

    if (dry) {
      log(`\n[${category}] ${p.title}  — by ${maskName(p.author_name)}`)
      log(p.content)
      comments.forEach((c) => log(`   └ ${maskName(c.author_name)}: ${c.content}`))
      continue
    }

    const { data: post, error: pErr } = await supabase
      .from('community_posts')
      .insert({
        user_id: sys.id,
        author_name: maskName(p.author_name),
        category,
        title: p.title,
        content: p.content,
        is_anonymous: true,
        like_count: stats.like_count,
        comment_count: comments.length,
        view_count: stats.view_count,
        author_company: rollCompany(),
        created_at: new Date(base).toISOString(),
      })
      .select()
      .single()

    if (pErr || !post) {
      log(`Insert post lỗi: ${pErr?.message}`)
      continue
    }
    insertedPosts++

    if (comments.length) {
      const cTimes = commentTimes(base, comments.length)
      const rows = comments.map((c, i) => ({
        post_id: post.id,
        user_id: sys.id,
        author_name: maskName(c.author_name),
        content: c.content,
        is_anonymous: true,
        like_count: commentLikes(),
        author_company: rollCompany(),
        created_at: cTimes[i],
      }))
      const { error: cErr } = await supabase.from('community_comments').insert(rows)
      if (cErr) log(`Insert comments lỗi: ${cErr.message}`)
      else insertedComments += rows.length
    }

    log(`✓ [${category}] ${p.title} (+${comments.length} comments)`)
  }

  return { posts: insertedPosts, comments: insertedComments, generated: posts.length, dry }
}

// ---------------------------------------------------------------------------
// Trickle mode: called frequently (hourly). Each tick probabilistically drops a
// post at a jittered recent minute, and drips at most a couple of comments onto
// recent posts with real time gaps — so posts and comments appear gradually,
// not all at once.
// ---------------------------------------------------------------------------

const COMMENT_SYSTEM_PROMPT = `Bạn viết MỘT bình luận tiếng Việt cho một bài đăng trong cộng đồng lương & sự nghiệp ở VN.
- viết như người thật nhắn trên forum: casual, viết thường, RẤT NGẮN — đa số chỉ 1 câu ngắn hoặc 1 mệnh đề cụt (vd "outsource cân bằng cuộc sống hơn b ơi", "same, mệt vc", "cố lên b ơi", "lương vậy ổn mà b"), họa hoằn mới 2 câu. Dùng viết tắt tự nhiên (b=bạn, k/ko=không, đc=được, vs=với, mn=mọi người, vc), không cần dấu câu chuẩn, đôi khi cụt lủn. Hợp ngữ cảnh bài: đồng cảm / khuyên thẳng / kể trải nghiệm riêng / phản biện / hỏi lại — nhưng TUYỆT ĐỐI KHÔNG dài dòng / lên lớp.
- author_name là một tên/nickname Việt thật, KỂ CẢ khi is_anonymous = true (hệ thống tự che thành "chữ-đầu + **"). TUYỆT ĐỐI KHÔNG dùng "Ẩn danh".
- LUÔN để is_anonymous = true (mọi comment đều ẩn danh).
QUY TẮC BẮT BUỘC: KHÔNG nhắc tên công ty thật; KHÔNG tự nhận "từng làm ở [công ty X]" có tên thật; KHÔNG nêu lương gắn công ty thật; KHÔNG nói xấu công ty thật.
Trả về JSON: { "author_name": string, "content": string, "is_anonymous": boolean }`

const ictHour = () => (new Date().getUTCHours() + 7) % 24
function hashCode(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}
// stable per-post target comment count (5..10), so a post fills up then stops
const targetComments = (id) => 5 + (hashCode(id) % 6)
// real-user posts get 5..8 bot comments (user request: min 5, max 8)
const realTargetComments = (id) => 5 + (hashCode(id) % 4)
// post appears at a random minute within the last ~hour → irregular timing
const jitteredPostTime = () => new Date(Date.now() - rint(0, 55) * 60000).toISOString()

async function generateComment(openai, post) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    temperature: 1.0,
    messages: [
      { role: 'system', content: COMMENT_SYSTEM_PROMPT },
      { role: 'user', content: `Bài đăng:\nTiêu đề: ${post.title}\nNội dung: ${post.content}` },
    ],
  })
  return JSON.parse(completion.choices[0].message.content)
}

async function runTick({ supabase, openai, log = () => {}, dry = false, postProb = 0.35, force = false }) {
  const hour = ictHour()
  if (!force && (hour < 7 || hour >= 23)) {
    log(`ngoài giờ hoạt động (ICT ${hour}h) — bỏ qua`)
    return { skipped: true, hour }
  }
  const sys = await fetchSystemAccount(supabase)
  if (!sys) throw new Error('system account community@system.local not found')

  let posted = 0
  let commented = 0

  // --- POST phase (probabilistic, jittered minute) ---
  if (force || Math.random() < postProb) {
    const n = Math.random() < 0.1 ? 2 : 1
    const generated = await generate(openai, await fetchRecentTitles(supabase), n)
    for (const p of generated) {
      const category = CATEGORIES.includes(p.category) ? p.category : 'daily'
      if (dry) {
        log(`[would post] [${category}] ${p.title} — by ${maskName(p.author_name)}`)
        posted++
        continue
      }
      const { error } = await supabase.from('community_posts').insert({
        user_id: sys.id,
        author_name: maskName(p.author_name),
        category,
        title: p.title,
        content: p.content,
        is_anonymous: true,
        like_count: rint(1, 4),
        comment_count: 0,
        view_count: rint(25, 90),
        author_company: rollCompany(),
        created_at: jitteredPostTime(),
      })
      if (error) log(`post insert lỗi: ${error.message}`)
      else { posted++; log(`✓ post [${category}] ${p.title}`) }
    }
  }

  // --- COMMENT DRIP phase (recent posts, spaced, capped per post) ---
  const sinceIso = new Date(Date.now() - 48 * 3600 * 1000).toISOString()
  const { data: recent } = await supabase
    .from('community_posts')
    .select('id, title, content, comment_count, view_count, like_count, created_at')
    .eq('user_id', sys.id)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(50)
  const candidates = (recent || []).filter((p) => (p.comment_count || 0) < targetComments(p.id))

  // most-recent comment time per candidate, for spacing
  const lastByPost = {}
  const ids = candidates.map((p) => p.id)
  if (ids.length) {
    const { data: cs } = await supabase
      .from('community_comments')
      .select('post_id, created_at')
      .in('post_id', ids)
    for (const c of cs || []) {
      const t = new Date(c.created_at).getTime()
      if (!lastByPost[c.post_id] || t > lastByPost[c.post_id]) lastByPost[c.post_id] = t
    }
  }

  const now = Date.now()
  const eligible = candidates.filter((p) => {
    const base = lastByPost[p.id] || new Date(p.created_at).getTime()
    return now - base > (20 + Math.random() * 40) * 60000 // >20-60 min since last activity
  })
  eligible.sort(() => Math.random() - 0.5)

  for (const p of eligible.slice(0, 2)) {
    const c = await generateComment(openai, p)
    if (!c || !c.content) continue
    if (dry) {
      log(`[would comment] "${p.title}" ← ${maskName(c.author_name)}: ${c.content}`)
      commented++
      continue
    }
    const { error } = await supabase.from('community_comments').insert({
      post_id: p.id,
      user_id: sys.id,
      author_name: maskName(c.author_name),
      content: c.content,
      is_anonymous: true,
      like_count: commentLikes(),
      author_company: rollCompany(),
      created_at: new Date(now - rint(0, 15) * 60000).toISOString(),
    })
    if (error) { log(`comment insert lỗi: ${error.message}`); continue }
    // bump comment_count, nudge views, and occasionally add a like or two so
    // the post accrues engagement over time (not stuck at its initial likes)
    await supabase
      .from('community_posts')
      .update({
        comment_count: (p.comment_count || 0) + 1,
        view_count: (p.view_count || 0) + rint(20, 70),
        like_count: (p.like_count || 0) + rint(0, 3),
      })
      .eq('id', p.id)
    commented++
    log(`✓ comment on "${p.title}"`)
  }

  return { posted, commented, hour, dry }
}

// ---------------------------------------------------------------------------
// Real-user post drip: called frequently (every ~5 min via GitHub Actions).
// Seeds bot comments onto REAL users' posts (user_id != system account) so a
// fresh post doesn't sit at 0 comments. Each post fills to a stable 5..8 target,
// a couple comments per tick with real time gaps — first comment lands within a
// few minutes, the full set trickles in over ~15-20 min. No post generation and
// no seed-post drip here (that stays in runTick); this ONLY comments on real
// posts. Bot comments are attributed to the same system account.
// ---------------------------------------------------------------------------
async function runRealPostDrip({ supabase, openai, log = () => {}, dry = false, force = false }) {
  const hour = ictHour()
  if (!force && (hour < 7 || hour >= 23)) {
    log(`ngoài giờ hoạt động (ICT ${hour}h) — bỏ qua`)
    return { skipped: true, hour }
  }
  const sys = await fetchSystemAccount(supabase)
  if (!sys) throw new Error('system account community@system.local not found')

  // real-user posts from the last 3h still under their bot-comment target
  const sinceIso = new Date(Date.now() - 3 * 3600 * 1000).toISOString()
  const { data: recent } = await supabase
    .from('community_posts')
    .select('id, title, content, comment_count, view_count, like_count, created_at')
    .neq('user_id', sys.id)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(50)
  const candidates = (recent || []).filter((p) => (p.comment_count || 0) < realTargetComments(p.id))
  if (!candidates.length) return { commented: 0, posts: 0, hour, dry }

  // most-recent bot (system) comment time per post — used to space our drip so
  // comments trickle in rather than landing together. real replies don't gate us.
  const ids = candidates.map((p) => p.id)
  const { data: cs } = await supabase
    .from('community_comments')
    .select('post_id, created_at')
    .in('post_id', ids)
    .eq('user_id', sys.id)
  const lastBot = {}
  for (const c of cs || []) {
    const t = new Date(c.created_at).getTime()
    if (!lastBot[c.post_id] || t > lastBot[c.post_id]) lastBot[c.post_id] = t
  }

  const now = Date.now()
  let commented = 0
  let touched = 0
  for (const p of candidates) {
    const room = realTargetComments(p.id) - (p.comment_count || 0)
    if (room <= 0) continue
    // spacing: first bot comment 1-3 min after the post, later ones 2-4 min apart
    const base = lastBot[p.id] || new Date(p.created_at).getTime()
    const gapMin = lastBot[p.id] ? 2 + Math.random() * 2 : 1 + Math.random() * 2
    if (now - base < gapMin * 60000) continue

    const n = Math.min(room, 2) // at most 2 per tick so it accrues gradually
    const postMs = new Date(p.created_at).getTime()
    // stagger this batch across the last few minutes so they don't share a timestamp
    const offsets = Array.from({ length: n }, () => rint(0, 3) * 60000 + rint(0, 59) * 1000).sort((a, b) => b - a)

    let added = 0
    for (let i = 0; i < n; i++) {
      const c = await generateComment(openai, p)
      if (!c || !c.content) continue
      const ts = Math.max(postMs + 60000, now - offsets[i])
      if (dry) {
        log(`[would comment] "${p.title}" ← ${maskName(c.author_name)}: ${c.content}`)
        added++
        continue
      }
      const { error } = await supabase.from('community_comments').insert({
        post_id: p.id,
        user_id: sys.id,
        author_name: maskName(c.author_name),
        content: c.content,
        is_anonymous: true,
        like_count: commentLikes(),
        author_company: rollCompany(),
        created_at: new Date(ts).toISOString(),
      })
      if (error) { log(`comment insert lỗi: ${error.message}`); continue }
      added++
    }
    if (!dry && added) {
      await supabase
        .from('community_posts')
        .update({
          comment_count: (p.comment_count || 0) + added,
          view_count: (p.view_count || 0) + rint(15, 50),
          like_count: (p.like_count || 0) + rint(0, 2),
        })
        .eq('id', p.id)
    }
    if (added) { commented += added; touched++; log(`✓ ${added} comment(s) on real post "${p.title}"`) }
  }

  return { commented, posts: touched, hour, dry }
}

module.exports = { runDailySeed, runTick, runRealPostDrip, SYSTEM_PROMPT, fetchSystemAccount, postStats, commentLikes }
