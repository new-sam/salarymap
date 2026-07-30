// CREATUS(Global Content Marketer) + Electerior(AI Social Media Content Specialist) 추천 콜드메일.
// 두 공고가 같은 인재풀(비개발 콘텐츠/마케팅/디자인)을 놓고 겹치므로 **한 스크립트에서 1인 1통 배정**한다:
//   전략·어학형(헤드라인이 마케팅/브랜드/PR) → CREATUS
//   제작형(디자인·영상·사진·UI/UX)          → Electerior
// 프레임은 공개/비공개로 갈리고(공개="담당자가 봤다·우선검토", 비공개="FYI가 추천 명단에 선정 ·
// 이번 주 담당자 전달 · 우선검토"), 캠페인명도 프레임별로 분리해 goals탭에 네 줄로 집계된다.
// ⚠️비공개 카피가 "이번 주 명단 전달"을 약속하므로 발송 후 실제로 담당자에게 명단을 공유할 것.
//
//   node scripts/outreach/marketing-recommend-coldmail.mjs --test wsj@likelion.net
//   node scripts/outreach/marketing-recommend-coldmail.mjs                 # dry-run: 배정 결과
//   node scripts/outreach/marketing-recommend-coldmail.mjs --send [--max N]
import { Resend } from 'resend'
import { sb, env, fetchAll } from './lib.mjs'
import { makeToken } from '../../lib/campaignToken.js'

const args = process.argv.slice(2)
const flag = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d }
const testTo = flag('test', null)
const doSend = args.includes('--send')
const SITE = String(flag('site', env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com')).replace(/\/$/, '')
const RESEND_FROM = env.RESEND_FROM || 'FYI <hello@salary-fyi.com>'
const maxN = flag('max', null) ? parseInt(flag('max'), 10) : null
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const firstName = (n) => String(n || '').trim().split(/\s+/).slice(-1)[0] || 'bạn'

const JOBS = {
  creatus: {
    id: '2b6aa84a-6269-412f-9649-c689d0a441e4',
    campaign: { public: 'creatus-recommend1-public', private: 'creatus-recommend1-private' },
    initial: 'C',
    meta: 'HCM · Hà Nội · 20–25 triệu',
    subject: {
      public: '[FYI] CREATUS đã xem hồ sơ của bạn và mời bạn ứng tuyển',
      private: '[FYI] Bạn được chọn vào danh sách đề cử cho vị trí Global Content Marketer tại CREATUS',
    },
    intro: {
      public: 'Nhà tuyển dụng của <b>CREATUS</b> — công ty Hàn Quốc trong lĩnh vực Education, Content và Influencer Marketing, đang mở rộng ra thị trường toàn cầu — đã xem hồ sơ của bạn trên FYI và <b>gửi cho bạn vị trí này</b> vì kinh nghiệm marketing của bạn phù hợp với yêu cầu.',
      private: '<b>CREATUS</b> — công ty Hàn Quốc trong lĩnh vực Education, Content và Influencer Marketing, đang mở rộng ra thị trường Bắc Mỹ và Nhật Bản — đang tuyển Global Content Marketer qua FYI. Đội ngũ FYI đã xem xét toàn bộ hồ sơ đã đăng ký và <b>chọn bạn vào danh sách đề cử</b> gửi cho nhà tuyển dụng.',
    },
    line: 'Sản xuất nội dung cho thị trường Bắc Mỹ và Nhật Bản, xây dựng kênh social từ giai đoạn đầu và triển khai influencer seeding. Ưu tiên ứng viên thành thạo <b>tiếng Anh</b> (hoặc tiếng Nhật/tiếng Trung). Lương <b>20–25 triệu</b>, có thể làm part-time.',
    lineText: 'Sản xuất nội dung cho thị trường Bắc Mỹ và Nhật Bản, xây dựng kênh social từ giai đoạn đầu và triển khai influencer seeding. Ưu tiên ứng viên thành thạo tiếng Anh (hoặc tiếng Nhật/tiếng Trung). Lương 20–25 triệu, có thể làm part-time.',
  },
  electerior: {
    id: 'cc53cef4-96c2-44f8-adb8-0de2a8af86fa',
    campaign: { public: 'electerior-recommend1-public', private: 'electerior-recommend1-private' },
    initial: 'E',
    meta: 'Hà Nội · HCM · 20–25 triệu',
    subject: {
      public: '[FYI] Electerior đã xem hồ sơ của bạn và mời bạn ứng tuyển',
      private: '[FYI] Bạn được chọn vào danh sách đề cử cho vị trí AI Content Specialist tại Electerior',
    },
    intro: {
      public: 'Nhà tuyển dụng của <b>Electerior</b> — công ty Hàn Quốc trong lĩnh vực nội thất và giải pháp không gian, đang xây dựng hệ thống marketing dựa trên AI — đã xem hồ sơ của bạn trên FYI và <b>gửi cho bạn vị trí này</b> vì kinh nghiệm sản xuất nội dung của bạn phù hợp với yêu cầu.',
      private: '<b>Electerior</b> — công ty Hàn Quốc trong lĩnh vực nội thất và giải pháp không gian, đang xây dựng hệ thống marketing và tự động hóa nội dung bằng AI — đang tuyển AI-based Social Media Content Specialist qua FYI. Đội ngũ FYI đã xem xét toàn bộ hồ sơ đã đăng ký và <b>chọn bạn vào danh sách đề cử</b> gửi cho nhà tuyển dụng.',
    },
    line: 'Lên kế hoạch và sản xuất nội dung social bằng các công cụ AI (<b>ChatGPT, Midjourney, CapCut</b>), vận hành Content Calendar trên Notion và quản lý kênh Instagram / YouTube Shorts. Lương <b>20–25 triệu</b>.',
    lineText: 'Lên kế hoạch và sản xuất nội dung social bằng các công cụ AI (ChatGPT, Midjourney, CapCut), vận hành Content Calendar trên Notion và quản lý kênh Instagram / YouTube Shorts. Lương 20–25 triệu.',
  },
}

const BENEFIT = {
  public: ' Vì đây là lời mời trực tiếp từ nhà tuyển dụng, hồ sơ của bạn sẽ được <b>ưu tiên xem xét</b> khi ứng tuyển.',
  private: ' <b>Trong tuần này</b>, FYI sẽ gửi danh sách đề cử trực tiếp cho nhà tuyển dụng. Nếu bạn ứng tuyển ngay, CV của bạn sẽ được gửi kèm lời giới thiệu từ FYI và được <b>ưu tiên xem xét</b> so với ứng viên thông thường.',
}
const BENEFIT_TEXT = {
  public: ' Vì đây là lời mời trực tiếp từ nhà tuyển dụng, hồ sơ của bạn sẽ được ưu tiên xem xét khi ứng tuyển.',
  private: ' Trong tuần này, FYI sẽ gửi danh sách đề cử trực tiếp cho nhà tuyển dụng. Nếu bạn ứng tuyển ngay, CV của bạn sẽ được gửi kèm lời giới thiệu từ FYI và được ưu tiên xem xét so với ứng viên thông thường.',
}

function emailHtml(name, url, job, cfg, frame) {
  const logo = job.logo_url
    ? `<img src="${esc(job.logo_url)}" width="44" height="44" alt="" style="width:44px;height:44px;border-radius:10px;object-fit:cover;background:#f0ebe3;display:block">`
    : `<div style="width:44px;height:44px;border-radius:10px;background:#fff0e6;color:#ff6000;font-weight:800;font-size:16px;text-align:center;line-height:44px">${cfg.initial}</div>`
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1612">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f7"><tr><td align="center" style="padding:28px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
  <tr><td style="font-size:20px;font-weight:800;color:#ff6000;padding-bottom:18px">FYI</td></tr>
  <tr><td style="font-size:15px;line-height:1.6;color:#1a1612;padding-bottom:6px">Chào ${esc(firstName(name))},</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:18px">${cfg.intro[frame]}</td></tr>
  <tr><td style="padding-bottom:14px">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #eee5da;border-radius:14px"><tr>
      <td width="44" style="padding:14px 0 14px 14px;vertical-align:middle">${logo}</td>
      <td style="padding:14px 14px 14px 12px;vertical-align:middle">
        <div style="font-size:12px;color:#8a8073;margin-bottom:3px">${esc(job.company)}</div>
        <div style="font-size:14.5px;font-weight:700;color:#1a1612;line-height:1.35">${esc(job.title)}</div>
        <div style="font-size:12px;color:#b0691a;margin-top:3px">${esc(cfg.meta)}</div>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:6px">
    ${cfg.line}${BENEFIT[frame]} Chỉ cần <b>1 chạm</b> — CV đã đăng ký của bạn sẽ được gửi tự động.
  </td></tr>
  <tr><td align="center" style="padding:16px 0 6px">
    <a href="${url}" style="display:inline-block;background:#ff6000;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 30px;border-radius:12px">Ứng tuyển 1 chạm →</a>
  </td></tr>
  <tr><td style="font-size:11.5px;color:#a89f92;text-align:center;line-height:1.5;padding-top:20px">
    Bạn nhận được email này vì đã đăng ký hồ sơ trên FYI.<br>— Đội ngũ FYI · <a href="https://salary-fyi.com/jobs" style="color:#a89f92">salary-fyi.com/jobs</a>
  </td></tr>
</table></td></tr></table></body></html>`
}

const strip = (s) => String(s).replace(/<[^>]+>/g, '')
function emailText(name, url, job, cfg, frame) {
  return `Chào ${firstName(name)},

${strip(cfg.intro[frame])}

${job.title} — ${job.company} (${cfg.meta})

${cfg.lineText}${BENEFIT_TEXT[frame]} Ứng tuyển chỉ với 1 chạm — CV của bạn được gửi tự động:

${url}

— Đội ngũ FYI · salary-fyi.com/jobs`
}

// ── 매칭·배정 ──
const hayOf = (p) => [
  ...(Array.isArray(p.skills) ? p.skills : []),
  p.position, p.headline, p.major,
  JSON.stringify(p.experiences || []),
  JSON.stringify(p.resume_summary || {}),
].map((s) => String(s || '').toLowerCase()).join(' | ')

const DEV_POS = ['fullstack', 'backend', 'frontend', 'devops', 'qa', 'mobile', 'ai/data', 'data', 'it', '개발', 'frontend developer', 'dev', 'developer']
const isDev = (p) => DEV_POS.includes(String(p.position || '').toLowerCase())
  || /\b(developer|engineer|programmer|lập trình)\b/i.test(String(p.headline || ''))
const langOk = (p) => /ielts|toeic|toefl|fluent|business|advanced|b2|c1|c2|native|thành thạo|proficient|upper/i.test(p.english_cert || '')
  || /topik|jlpt|hsk|tiếng hàn|tiếng nhật|tiếng trung/.test(hayOf(p))
// 헤드라인 기준으로만 성향 판정 — 이력서 본문 키워드만 걸린 무관자(세일즈·IT지원 등)를 배제
const isMarketer = (p) => /market|content|social|brand|pr\b|communication|truyền thông|copywrit|seo/i.test(p.headline || '')
const isMaker = (p) => /design|thiết kế|graphic|ui\/ux|video|photo|media|editor|artist|creator|production|3d/i.test(p.headline || '')

async function main() {
  const jobRows = await fetchAll(() => sb.from('jobs')
    .select('id,title,company,role,location,logo_url,is_active')
    .in('id', Object.values(JOBS).map((j) => j.id)))
  const jobById = Object.fromEntries(jobRows.map((j) => [j.id, j]))
  for (const [key, cfg] of Object.entries(JOBS)) {
    const j = jobById[cfg.id]
    if (!j || !j.is_active) { console.error(`공고 없음/비활성: ${key}`); process.exit(1) }
    console.log(`공고 ${key}: ${j.company} — ${j.title}`)
  }

  const resend = new Resend(env.RESEND_API_KEY)
  const url = (userId, cfg, frame) => `${SITE}/api/resume/recommend?t=${makeToken(userId, cfg.campaign[frame])}&j=${cfg.id}`

  // ── 테스트: 4가지 조합(공고2 × 프레임2) ──
  if (testTo) {
    const rows = await fetchAll(() => sb.from('user_profiles').select('id,email,full_name').ilike('email', testTo))
    const p = rows[0]
    if (!p) { console.error(`프로필 없음: ${testTo}`); process.exit(1) }
    for (const [key, cfg] of Object.entries(JOBS)) {
      for (const frame of ['public', 'private']) {
        const job = jobById[cfg.id]
        const u = url(p.id, cfg, frame)
        const { data, error } = await resend.emails.send({
          from: RESEND_FROM, to: p.email, subject: cfg.subject[frame],
          text: emailText(p.full_name, u, job, cfg, frame), html: emailHtml(p.full_name, u, job, cfg, frame),
        })
        if (error) { console.error(`발송 실패(${key}/${frame}):`, error); process.exit(1) }
        console.log(`✅ 테스트(${key}/${frame}):`, data?.id)
        await sleep(400)
      }
    }
    return
  }

  // ── 제외: 두 공고 중 하나라도 기발송·기지원 ──
  const jobIds = Object.values(JOBS).map((j) => j.id)
  const [recs, apps] = await Promise.all([
    fetchAll(() => sb.from('job_recommendations').select('user_id,to_email,job_id').in('job_id', jobIds)),
    fetchAll(() => sb.from('job_applications').select('user_id,job_id').in('job_id', jobIds)),
  ])
  const excl = new Set([...recs, ...apps].map((r) => r.user_id).filter(Boolean))
  const exclEmail = new Set(recs.map((r) => (r.to_email || '').toLowerCase()).filter(Boolean))

  const pool = await fetchAll(() => sb.from('user_profiles')
    .select('id,email,full_name,position,headline,skills,major,yoe_months,experiences,resume_summary,resume_url,is_resume_public,english_cert')
    .not('resume_url', 'is', null))

  const cohort = []
  for (const p of pool) {
    if (!p.email || /likelion/i.test(p.email)) continue
    if (excl.has(p.id) || exclEmail.has(p.email.toLowerCase())) continue
    if (isDev(p)) continue
    if (p.yoe_months != null && p.yoe_months > 96) continue
    const hay = hayOf(p)
    const hit = ['marketing', 'content', 'social media', 'copywrit', 'seo', 'branding', 'tiktok', 'kol', 'influencer',
      'designer', 'video', 'photo', 'media', 'creator', 'editor'].some((k) => hay.includes(k))
    if (!hit) continue
    const m = isMarketer(p), k = isMaker(p)
    let key = null
    if (m && !k) key = (langOk(p) || (p.yoe_months || 0) >= 24) ? 'creatus' : 'electerior'
    else if (k && !m) key = 'electerior'
    else if (m && k) key = langOk(p) ? 'creatus' : 'electerior'
    else continue // 헤드라인이 어느 쪽도 아님 — 본문만 걸린 무관자
    cohort.push({ p, key, frame: p.is_resume_public ? 'public' : 'private' })
  }
  cohort.sort((a, b) => (b.p.yoe_months || 0) - (a.p.yoe_months || 0))

  const count = (k, f) => cohort.filter((c) => c.key === k && (!f || c.frame === f)).length
  console.log(`\n대상 ${cohort.length}명 — 1인 1통 배정`)
  for (const k of Object.keys(JOBS)) console.log(`  ${k}: ${count(k)}명 (공개 ${count(k, 'public')} / 비공개 ${count(k, 'private')})`)
  for (const { p, key, frame } of cohort)
    console.log(`  [${key}·${frame === 'public' ? '공개' : '비공개'}] ${p.full_name} <${p.email}> · ${Math.round((p.yoe_months || 0) / 12 * 10) / 10}y · ${String(p.headline || '').slice(0, 48)}`)

  if (!doSend) { console.log('\n(dry-run — 실발송하려면 --send)'); return }

  const list = maxN ? cohort.slice(0, maxN) : cohort
  let ok = 0
  for (const { p, key, frame } of list) {
    const cfg = JOBS[key]
    const job = jobById[cfg.id]
    const u = url(p.id, cfg, frame)
    const { error } = await resend.emails.send({
      from: RESEND_FROM, to: p.email, subject: cfg.subject[frame],
      text: emailText(p.full_name, u, job, cfg, frame), html: emailHtml(p.full_name, u, job, cfg, frame),
    })
    if (error) { console.error(`실패 ${p.email}:`, error.message || error); continue }
    await sb.from('job_recommendations').upsert([{
      user_id: p.id, to_email: p.email, job_id: cfg.id,
      job_title: job.title, job_company: job.company, sent_by: 'coldmail', kind: 'recommend', status: 'sent',
    }], { onConflict: 'user_id,job_id', ignoreDuplicates: true })
    await sb.from('events').insert([{
      event: 'recommend_sent', page: '/scripts/marketing-recommend-coldmail',
      meta: { campaign: cfg.campaign[frame], job_ids: [cfg.id], frame }, user_id: p.id,
    }])
    ok++
    await sleep(400)
  }
  console.log(`\n✅ 발송 완료: ${ok}/${list.length}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
