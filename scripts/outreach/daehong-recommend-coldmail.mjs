// DAEHONG COMMUNICATIONS VIETNAM — Art Director 추천 콜드메일 — bada/exporum 패턴(공개/비공개·1일 1통).
// 배경: 8/31 KTC 라인 등록. 롯데계 종합 광고사, Creative Solutions Team, Diamond Plaza HCMC 온사이트.
// JD는 광고/크리에이티브 10y+·시니어 리더십 3-5y·영어 필수·포트폴리오 제출 — 풀에 10y+는 1명뿐이라
// DB 등록 기준(experience_min=5)으로 Design×5y+×HCMC권을 잡는다(8/31 실측 24명). 점수는 10y+·영어인증 가점.
// ⚠️ 카피가 "이번 주 명단 전달" 약속 — 발송 후 DAEHONG(KTC 라인)에 추천 명단 실제 공유할 것.
//
//   node scripts/outreach/daehong-recommend-coldmail.mjs                          # dry-run
//   node scripts/outreach/daehong-recommend-coldmail.mjs --send [--max N]
import { Resend } from 'resend'
import { sb, env, fetchAll } from './lib.mjs'
import { makeToken } from '../../lib/campaignToken.js'

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

const JOB_ID = '951d1f55-487c-4e18-abba-e20de274bdc0' // Art Director

// ── 대상 선정(룰 기반) ──
const locBucket = (loc) => {
  const s = String(loc || '').toLowerCase()
  if (!s.trim()) return 'B'
  if (/(h[ồo]\s*ch[íi]\s*minh|hcm|sài gòn|sai gon|thủ đức|thu duc|bình dương|binh duong|biên hòa|bien hoa|đồng nai|dong nai)/.test(s)) return 'A'
  return 'X'
}
const inHcmc = (p) => ['A', 'B'].includes(locBucket(p.location))
const roles = (p) => new Set([p.position, ...(p.desired_roles || [])].filter(Boolean))
const pick = (p) => {
  if (!inHcmc(p) || !roles(p).has('Design') || (p.yoe_months ?? 0) < 60) return null
  let s = locBucket(p.location) === 'A' ? 2 : 0
  if ((p.yoe_months ?? 0) >= 120) s += 3
  if (p.english_cert) s += 2
  return s
}
const campaignOf = (frame) => `daehong-recommend1-ad-${frame}`

// ── 카피(vi 실발송) — kyndof 표준 정직 프레임(공개/비공개) ──
const ROLE_VI = 'Art Director (Creative Solutions Team)'
const COPY = {
  subject: {
    public: `[FYI] Bạn được chọn vào danh sách đề cử gửi DAEHONG COMMUNICATIONS VIETNAM — Art Director`,
    private: `[FYI] Bạn được chọn vào danh sách đề cử — Art Director tại DAEHONG COMMUNICATIONS VIETNAM`,
  },
  intro: '<b>DAEHONG COMMUNICATIONS VIETNAM</b> — công ty quảng cáo & truyền thông tích hợp thuộc tập đoàn Hàn Quốc — đang tuyển <b>Art Director</b> (Creative Solutions Team) qua FYI, làm việc tại Diamond Plaza, TP.HCM. Vị trí dành cho creative giàu kinh nghiệm, dẫn dắt định hướng hình ảnh cho các chiến dịch thương hiệu lớn; mức lương thỏa thuận theo kinh nghiệm.',
  hook: 'Đội ngũ FYI đã xem xét toàn bộ hồ sơ đã đăng ký và <b>chọn bạn vào danh sách đề cử</b> cho vị trí dưới đây — kinh nghiệm thiết kế của bạn phù hợp với yêu cầu của vị trí này.',
  benefit: {
    public: '<b>Trong tuần này</b>, FYI sẽ gửi danh sách đề cử trực tiếp cho người phụ trách tuyển dụng của DAEHONG. Hồ sơ của bạn đang ở chế độ công khai nên sẽ được gửi kèm danh sách. Nếu bạn ứng tuyển ngay, CV của bạn sẽ được <b>ưu tiên xem xét</b> cùng lời giới thiệu từ FYI.',
    private: '<b>Trong tuần này</b>, FYI sẽ gửi danh sách đề cử trực tiếp cho người phụ trách tuyển dụng của DAEHONG. Hồ sơ của bạn đang ở chế độ riêng tư — nếu bạn ứng tuyển ngay, CV của bạn sẽ được gửi kèm lời giới thiệu từ FYI và được <b>ưu tiên xem xét</b>.',
  },
  onetap: 'Chỉ cần <b>1 chạm</b> — CV đã đăng ký của bạn sẽ được gửi tự động. Hồ sơ cần kèm <b>Portfolio</b> và tiếng Anh tốt — bạn có thể bổ sung sau khi ứng tuyển.',
}

const META_VI = 'Onsite · Diamond Plaza, TP.HCM · Lương thỏa thuận'

function jobCard(job) {
  const logo = job.logo_url
    ? `<img src="${esc(job.logo_url)}" width="44" height="44" alt="" style="width:44px;height:44px;border-radius:10px;object-fit:cover;background:#f0ebe3;display:block">`
    : `<div style="width:44px;height:44px;border-radius:10px;background:#fff0e6;color:#ff6000;font-weight:800;font-size:16px;text-align:center;line-height:44px">D</div>`
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #eee5da;border-radius:14px;margin-bottom:8px"><tr>
    <td width="44" style="padding:14px 0 14px 14px;vertical-align:middle">${logo}</td>
    <td style="padding:14px 14px 14px 12px;vertical-align:middle">
      <div style="font-size:12px;color:#8a8073;margin-bottom:3px">DAEHONG COMMUNICATIONS VIETNAM</div>
      <div style="font-size:14.5px;font-weight:700;color:#1a1612;line-height:1.35">${esc(job.title.trim())}</div>
      <div style="font-size:12px;color:#b0691a;margin-top:3px">${esc(META_VI)}</div>
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

- ${job.title.trim()} (DAEHONG COMMUNICATIONS VIETNAM) — ${META_VI} — ${SITE}/ktc/jobs/${job.id}

${strip(COPY.benefit[frame])} ${strip(COPY.onetap)}

${url}

Bạn nhận được email này vì đã đăng ký hồ sơ trên FYI.
— Đội ngũ FYI · salary-fyi.com/jobs
Hủy đăng ký: ${unsubUrl}`
}

async function main() {
  const { data: job, error: jobErr } = await sb.from('jobs')
    .select('id,title,company,location,logo_url,is_active').eq('id', JOB_ID).single()
  if (jobErr || !job || !job.is_active) { console.error('공고 없음/비활성:', jobErr?.message || JOB_ID); process.exit(1) }
  const resend = new Resend(env.RESEND_API_KEY)
  const url = (userId, camp) => `${SITE}/api/resume/recommend?t=${makeToken(userId, camp)}&j=${JOB_ID}`
  const unsubFor = (userId, camp) => `${SITE}/api/coldmail/unsub?t=${makeToken(userId, camp)}`

  const [pool, unsubs, recs, apps, todays] = await Promise.all([
    fetchAll(() => sb.from('user_profiles')
      .select('id,email,full_name,position,desired_roles,yoe_months,location,english_cert,is_resume_public')
      .not('email', 'is', null).not('resume_url', 'is', null).order('created_at', { ascending: false })),
    fetchAll(() => sb.from('events').select('user_id').eq('event', 'coldmail_unsub').not('user_id', 'is', null).order('id')),
    fetchAll(() => sb.from('job_recommendations').select('user_id').eq('job_id', JOB_ID).order('id')),
    fetchAll(() => sb.from('job_applications').select('user_id').eq('job_id', JOB_ID).order('id')),
    fetchAll(() => sb.from('job_recommendations').select('user_id,to_email')
      .gte('created_at', new Date().toISOString().slice(0, 10)).order('id')),
  ])
  const unsubSet = new Set(unsubs.map((r) => r.user_id))
  const todayUsers = new Set(todays.map((r) => r.user_id))
  const todayEmails = new Set(todays.map((r) => (r.to_email || '').toLowerCase()).filter(Boolean))
  const recSet = new Set(recs.map((r) => r.user_id))
  const appSet = new Set(apps.map((a) => a.user_id))

  const seen = new Set()
  let rows = []
  for (const p of pool) {
    if (!p.email || /likelion/i.test(p.email)) continue
    const e = p.email.toLowerCase()
    if (seen.has(e) || unsubSet.has(p.id)) continue
    if (todayUsers.has(p.id) || todayEmails.has(e)) continue
    if (appSet.has(p.id) || recSet.has(p.id)) continue
    const s = pick(p)
    if (s == null) continue
    rows.push({ p, s, frame: p.is_resume_public ? 'public' : 'private' })
    seen.add(e)
  }
  rows.sort((a, b) => b.s - a.s)

  const pub = rows.filter((x) => x.frame === 'public').length
  console.log(`발송 대상: ${rows.length}명 (공개 ${pub} / 비공개 ${rows.length - pub})`)
  if (!doSend) {
    for (const { p, s, frame } of rows.slice(0, 30))
      console.log(`  [${s}·${frame}] ${p.full_name} <${p.email}> · ${Math.round((p.yoe_months || 0) / 12 * 10) / 10}y · ${p.location || '위치?'} · en:${p.english_cert ? 'Y' : '-'}`)
    console.log('\n(dry-run — 실발송하려면 --send)')
    return
  }

  let targets = maxN ? rows.slice(0, maxN) : rows
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
      user_id: p.id, to_email: p.email, job_id: job.id,
      job_title: job.title, job_company: job.company, sent_by: 'coldmail', kind: 'recommend', status: 'sent',
    }], { onConflict: 'user_id,job_id', ignoreDuplicates: true })
    await sb.from('events').insert([{
      event: 'recommend_sent', page: '/scripts/daehong-recommend-coldmail',
      meta: { campaign: camp, job_ids: [job.id], frame, group: 'ad' }, user_id: p.id,
    }])
    ok++
    if (ok % 10 === 0) console.log(`  …${ok}/${targets.length}`)
    await sleep(400)
  }
  console.log(`\n✅ 발송 완료: ${ok}/${targets.length} (실패 ${fail})`)
}

main().catch((e) => { console.error(e); process.exit(1) })
