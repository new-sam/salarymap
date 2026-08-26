// Rothea(로테아, K뷰티 Resilience Cream) 북미 이커머스 Performance Marketer 추천 콜드메일 — bada/kyndof 표준.
// 배경: 8/26 소싱 요청(미국 아마존 셀러센트럴 3y+ × Amazon Ads × FBA, 32-35M, 영어 문서작성).
// 대상은 CV 원본 전수 스캔으로 확정한 data/rothea-candidates.json 30명
//   — A(8): 아마존 US 실무 접점 수동검증(핵심: Be Quynh Diem 셀러센트럴×Helium10×뷰티)
//   — B(22): (아마존 커머스 실언급 or 글로벌 마켓플레이스 운영) × 비개발·비디자인 × 2y+
//   동남아(Shopee/Lazada)만 있는 층은 JD가 명시 불인정이라 제외.
// ⚠️ 카피가 "이번 주 담당자에게 명단 전달" 약속 — 발송 후 로테아에 추천 명단 실제 공유할 것.
//
//   node scripts/outreach/rothea-recommend-coldmail.mjs                 # dry-run
//   node scripts/outreach/rothea-recommend-coldmail.mjs --send [--max N]
import { readFileSync } from 'node:fs'
import { Resend } from 'resend'
import { sb, env, fetchAll } from './lib.mjs'
import { makeToken } from '../../lib/campaignToken.js'

const JOB_ID = '65975789-367e-4650-9f2f-a5c440ecdd38' // Rothea — Performance Marketer (32-35M, HCM·ĐN·HN)
const ROLE_VI = 'Performance Marketer — Amazon US E-commerce'
const CANDIDATES = JSON.parse(readFileSync(new URL('../../data/rothea-candidates.json', import.meta.url), 'utf8'))

const args = process.argv.slice(2)
const flag = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d }
const doSend = args.includes('--send')
const maxN = flag('max', null) ? parseInt(flag('max'), 10) : null
const SITE = String(flag('site', env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com')).replace(/\/$/, '')
const RESEND_FROM = env.RESEND_FROM || 'FYI <hello@salary-fyi.com>'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const firstName = (n) => String(n || '').trim().split(/\s+/).slice(-1)[0] || 'bạn'
const strip = (s) => String(s).replace(/<[^>]+>/g, '')

const campaignOf = (frame) => `rothea-recommend1-${frame}`

// ── 카피(vi 실발송) — kyndof 표준 정직 프레임(공개/비공개) ──
const COPY = {
  subject: {
    public: `[FYI] Bạn được chọn vào danh sách đề cử gửi Rothea — ${ROLE_VI}`,
    private: `[FYI] Bạn được chọn vào danh sách đề cử — ${ROLE_VI} tại Rothea`,
  },
  intro: '<b>Rothea</b> — thương hiệu skincare Hàn Quốc (Resilience Cream) đang vận hành và mở rộng kênh e-commerce tại thị trường Bắc Mỹ: <b>Amazon US/Canada, Walmart Marketplace và TikTok Shop US</b> — đang tuyển vị trí vận hành kênh &amp; quảng cáo Amazon qua FYI. Làm việc hoàn toàn bằng <b>tiếng Anh</b>, không yêu cầu tiếng Hàn.',
  hook: 'Đội ngũ FYI đã xem xét toàn bộ hồ sơ đã đăng ký và <b>chọn bạn vào danh sách đề cử</b> cho vị trí dưới đây — kinh nghiệm e-commerce / marketplace của bạn phù hợp với yêu cầu của vị trí này.',
  benefit: {
    public: '<b>Trong tuần này</b>, FYI sẽ gửi danh sách đề cử trực tiếp cho người phụ trách tuyển dụng của Rothea. Hồ sơ của bạn đang ở chế độ công khai nên sẽ được gửi kèm danh sách. Nếu bạn ứng tuyển ngay, CV của bạn sẽ được <b>ưu tiên xem xét</b> cùng lời giới thiệu từ FYI.',
    private: '<b>Trong tuần này</b>, FYI sẽ gửi danh sách đề cử trực tiếp cho người phụ trách tuyển dụng của Rothea. Hồ sơ của bạn đang ở chế độ riêng tư — nếu bạn ứng tuyển ngay, CV của bạn sẽ được gửi kèm lời giới thiệu từ FYI và được <b>ưu tiên xem xét</b>.',
  },
  onetap: 'Chỉ cần <b>1 chạm</b> — CV đã đăng ký của bạn sẽ được gửi tự động.',
}

const salaryLine = (job) => {
  const mn = job.salary_min, mx = job.salary_max
  if (!mn || !mx) return ''
  return `${Math.round(mn / 1e6)}–${Math.round(mx / 1e6)} triệu ₫/tháng`
}

function jobCard(job) {
  const logo = job.logo_url
    ? `<img src="${esc(job.logo_url)}" width="44" height="44" alt="" style="width:44px;height:44px;border-radius:10px;object-fit:cover;background:#f0ebe3;display:block">`
    : `<div style="width:44px;height:44px;border-radius:10px;background:#fff0e6;color:#ff6000;font-weight:800;font-size:16px;text-align:center;line-height:44px">R</div>`
  const meta = [salaryLine(job), job.location].filter(Boolean).map(esc).join(' · ')
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #eee5da;border-radius:14px;margin-bottom:8px"><tr>
    <td width="44" style="padding:14px 0 14px 14px;vertical-align:middle">${logo}</td>
    <td style="padding:14px 14px 14px 12px;vertical-align:middle">
      <div style="font-size:12px;color:#8a8073;margin-bottom:3px">Rothea</div>
      <div style="font-size:14.5px;font-weight:700;color:#1a1612;line-height:1.35">${esc(job.title.trim())}</div>
      <div style="font-size:12px;color:#b0691a;margin-top:3px">${meta}</div>
    </td>
  </tr></table>`
}

function emailHtml(name, url, unsubUrl, job, frame) {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1612">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f7"><tr><td align="center" style="padding:28px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
  <tr><td style="padding-bottom:18px"><img src="https://salary-fyi.com/fyi-logo.png" height="24" alt="FYI" style="height:24px;width:auto;display:block"></td></tr>
  <tr><td style="font-size:15px;line-height:1.6;color:#1a1612;padding-bottom:6px">Chào ${esc(firstName(name))},</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:14px">${COPY.intro}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:14px">${COPY.hook}</td></tr>
  <tr><td style="padding-bottom:10px">${jobCard(job)}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-top:4px">${COPY.benefit[frame]} ${COPY.onetap}</td></tr>
  <tr><td align="center" style="padding:16px 0 6px">
    <a href="${url}" style="display:inline-block;background:#ff6000;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 30px;border-radius:12px">Ứng tuyển 1 chạm →</a>
  </td></tr>
  <tr><td align="center" style="font-size:12.5px;padding-bottom:4px"><a href="${SITE}/ktc/jobs/${job.id}" style="color:#8a8073">Xem mô tả công việc đầy đủ →</a></td></tr>
  <tr><td style="font-size:11.5px;color:#a89f92;text-align:center;line-height:1.5;padding-top:20px">
    Bạn nhận được email này vì đã đăng ký hồ sơ trên FYI.<br>— Đội ngũ FYI · <a href="https://salary-fyi.com/jobs" style="color:#a89f92">salary-fyi.com/jobs</a>
    &nbsp;·&nbsp;<a href="${unsubUrl}" style="color:#a89f92;text-decoration:underline">Hủy đăng ký</a>
  </td></tr>
</table></td></tr></table></body></html>`
}

function emailText(name, url, unsubUrl, job, frame) {
  return `Chào ${firstName(name)},

${strip(COPY.intro)}

${strip(COPY.hook)}

- ${job.title.trim()} (Rothea) — ${[salaryLine(job), job.location].filter(Boolean).join(' · ')} — ${SITE}/ktc/jobs/${job.id}

${strip(COPY.benefit[frame])} ${strip(COPY.onetap)}

${url}

Bạn nhận được email này vì đã đăng ký hồ sơ trên FYI.
— Đội ngũ FYI · salary-fyi.com/jobs
Hủy đăng ký: ${unsubUrl}`
}

async function main() {
  const { data: job, error: jobErr } = await sb.from('jobs')
    .select('id,title,company,location,logo_url,is_active,salary_min,salary_max').eq('id', JOB_ID).single()
  if (jobErr || !job || !job.is_active) { console.error('공고 없음/비활성:', jobErr?.message || JOB_ID); process.exit(1) }

  const resend = new Resend(env.RESEND_API_KEY)
  const url = (userId, camp) => `${SITE}/api/resume/recommend?t=${makeToken(userId, camp)}&j=${JOB_ID}`
  const unsubFor = (userId, camp) => `${SITE}/api/coldmail/unsub?t=${makeToken(userId, camp)}`

  const ids = CANDIDATES.map((c) => c.user_id)
  const [profiles, unsubs, recs, apps, todays] = await Promise.all([
    fetchAll(() => sb.from('user_profiles').select('id,email,full_name,is_resume_public').in('id', ids).order('id')),
    fetchAll(() => sb.from('events').select('user_id').eq('event', 'coldmail_unsub').not('user_id', 'is', null).order('id')),
    fetchAll(() => sb.from('job_recommendations').select('user_id').eq('job_id', JOB_ID).order('id')),
    fetchAll(() => sb.from('job_applications').select('user_id').eq('job_id', JOB_ID).order('id')),
    fetchAll(() => sb.from('job_recommendations').select('user_id,to_email')
      .gte('created_at', new Date().toISOString().slice(0, 10)).order('id')),
  ])
  const live = Object.fromEntries(profiles.map((p) => [p.id, p]))
  const unsubSet = new Set(unsubs.map((r) => r.user_id))
  const recSet = new Set(recs.map((r) => r.user_id))
  const appSet = new Set(apps.map((r) => r.user_id))
  const todayUsers = new Set(todays.map((r) => r.user_id))
  const todayEmails = new Set(todays.map((r) => (r.to_email || '').toLowerCase()).filter(Boolean))

  let targets = []
  for (const c of CANDIDATES) {
    const p = live[c.user_id]
    if (!p || !p.email) { console.log(`  건너뜀(프로필 없음): ${c.full_name}`); continue }
    const e = p.email.toLowerCase()
    if (unsubSet.has(p.id) || recSet.has(p.id) || appSet.has(p.id)) { console.log(`  건너뜀(unsub/기추천/기지원): ${c.full_name}`); continue }
    if (todayUsers.has(p.id) || todayEmails.has(e)) { console.log(`  건너뜀(오늘 타 캠페인 수신): ${c.full_name}`); continue }
    targets.push({ c, p, frame: p.is_resume_public ? 'public' : 'private' })
  }
  if (maxN) targets = targets.slice(0, maxN)

  const pub = targets.filter((t) => t.frame === 'public').length
  console.log(`\n발송 대상: ${targets.length}명 (공개 ${pub} / 비공개 ${targets.length - pub})`)
  for (const { c, p, frame } of targets)
    console.log(`  [${c.tier}·${frame}] ${p.full_name} <${p.email}> · ${c.position || '?'} · ${((c.yoe_months || 0) / 12).toFixed(1)}y`)
  if (!doSend) { console.log('\n(dry-run — 실발송하려면 --send)'); return }

  let ok = 0, fail = 0
  for (const { p, frame } of targets) {
    const camp = campaignOf(frame)
    const u = url(p.id, camp), un = unsubFor(p.id, camp)
    const { error } = await resend.emails.send({
      from: RESEND_FROM, to: p.email, subject: COPY.subject[frame],
      html: emailHtml(p.full_name, u, un, job, frame), text: emailText(p.full_name, u, un, job, frame),
      headers: { 'List-Unsubscribe': `<${un}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    })
    if (error) { console.error(`실패 ${p.email}:`, error.message || error); fail++; continue }
    await sb.from('job_recommendations').upsert([{
      user_id: p.id, to_email: p.email, job_id: JOB_ID,
      job_title: job.title, job_company: job.company, sent_by: 'coldmail', kind: 'recommend', status: 'sent',
    }], { onConflict: 'user_id,job_id', ignoreDuplicates: true })
    await sb.from('events').insert([{
      event: 'recommend_sent', page: '/scripts/rothea-recommend-coldmail',
      meta: { campaign: camp, job_ids: [JOB_ID], frame }, user_id: p.id,
    }])
    ok++
    if (ok % 10 === 0) console.log(`  …${ok}/${targets.length}`)
    await sleep(400)
  }
  console.log(`\n✅ 발송 완료: ${ok}/${targets.length} (실패 ${fail})`)
}

main().catch((e) => { console.error(e); process.exit(1) })
