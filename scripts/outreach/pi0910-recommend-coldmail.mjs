// PI Power Solutions(V85, 클린룸·그린빌딩 조명, HCMC Tân Sơn Nhất) Accountant recommend — 9/10 신규 등록 당일 발송.
// JD: 회계 1y+·MISA 경험·영어 커뮤니케이션·11~15M VND·헤드카운트 1·다음 주 출근 가능 우선(KTC 슬랙).
// 9/10 실측: 코어(Finance/Accounting×영어 인증×1~3.5y) 9명·확장 0 / 영어 인증 완화 +8 → HCMC권+미기재 게이트 시 ~10명.
//   유저 방향: 시니어(5y+ 14명)는 급여 미스매치(희망 ~$1,260 vs 제안 $430~590)라 제외, 저연차 소수정예.
//   영어는 인증 가점만(JD "good communication" 수준, 인증 없는 실무영어 층 포함) · 온사이트라 HCMC권+미기재만(atop 전례).
// ktc0907b 패턴 + --gap-hours(같은 날 재실행용, [[feedback-time-gap-not-daily-cap]]).
//
//   node scripts/outreach/pi0910-recommend-coldmail.mjs                          # dry-run
//   node scripts/outreach/pi0910-recommend-coldmail.mjs --send [--max N]
import { Resend } from 'resend'
import { sb, env, fetchAll } from './lib.mjs'
import { makeToken } from '../../lib/campaignToken.js'

const args = process.argv.slice(2)
const flag = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d }
const doSend = args.includes('--send')
const maxN = flag('max', null) ? parseInt(flag('max'), 10) : null
const gapHours = flag('gap-hours', null) ? parseFloat(flag('gap-hours')) : null
const sinceIso = gapHours != null ? new Date(Date.now() - gapHours * 3600 * 1000).toISOString() : new Date().toISOString().slice(0, 10)
const SITE = String(flag('site', env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com')).replace(/\/$/, '')
const RESEND_FROM = env.RESEND_FROM || 'FYI <hello@salary-fyi.com>'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const firstName = (n) => String(n || '').trim().split(/\s+/).slice(-1)[0] || 'bạn'
const strip = (s) => String(s).replace(/<[^>]+>/g, '')

const JOB_ID = 'ecfa6417-5992-4d6b-ab9c-eb80e1112c0c' // V85 PI Power Solutions — ACCOUNTANT
const COMPANY = 'PI Power Solutions'
const INITIAL = 'P'
const CAMP = 'pi0910-recommend1-acct'
const META_VI = 'Onsite · Tân Sơn Nhất, TP.HCM · 11–15 triệu ₫'

// ── 대상 선정: 저연차 회계(1~3.5y) × HCMC권+미기재. 영어 인증은 가점만 ──
const txt = (p) => {
  const exp = Array.isArray(p.experiences) ? p.experiences.map((e) => `${e.title || e.position || ''} ${e.company || ''}`).join(' ') : ''
  return [p.position, p.headline, (p.desired_roles || []).join(' '), JSON.stringify(p.skills || ''), exp, JSON.stringify(p.resume_summary || ''), p.major].join(' ').toLowerCase()
}
const finRole = (p) => [p.position, ...(p.desired_roles || [])].filter(Boolean).some((r) => /finance|account/i.test(r))
const acctRe = /(kế toán|ke toan|accounting|accountant|misa|\bvat\b|hóa đơn|tax report|general ledger|bookkeep)/i
const y = (p) => p.yoe_months ?? 0
const inHcmc = (p) => /(h[ồo]\s*ch[íi]\s*minh|hcm|sài gòn|sai gon|thủ đức|thu duc|bình dương|binh duong|tân sơn|tan son)/i.test(String(p.location || ''))
const noLoc = (p) => !String(p.location || '').trim()
// 9/10 손선별 제외: MISA API 연동 개발자(회계 아님 오탐)·동일인 중복 계정 구계정
const EXCLUDE = new Set(['vohuudat282224@gmail.com', 'ngonhu10424@gmail.com'])
const pick = (p) => {
  if (EXCLUDE.has(String(p.email || '').toLowerCase())) return null
  if (!(finRole(p) || acctRe.test(txt(p)))) return null
  if (y(p) < 12 || y(p) > 42) return null // JD 1y+ 필수, 급여 밴드(11-15M) 적합 상한 ~3.5y — 시니어 제외(유저 방향)
  if (!(inHcmc(p) || noLoc(p))) return null // 온사이트 HCMC
  const t = txt(p)
  return (finRole(p) ? 2 : 0) + (/misa/i.test(t) ? 3 : 0) + (p.english_cert ? 2 : 0) + (inHcmc(p) ? 1 : 0) + (acctRe.test(t) ? 1 : 0)
}

// ── 카피(vi 실발송) — 정직 프레임. 급여·MISA·즉시 출근 우선을 전부 명시해 자기선별 ──
const INTRO = '<b>PI Power Solutions</b> — công ty tiên phong về chiếu sáng phòng sạch (clean room) và công trình xanh trong ngành xây dựng tại Việt Nam, với Giám đốc người Hàn Quốc — đang tuyển <b>Accountant</b> qua FYI, làm việc tại <b>Tân Sơn Nhất, TP.HCM</b>. Công việc: giao dịch ngân hàng &amp; quản lý quỹ, xuất hóa đơn VAT, đối chiếu tồn kho, báo cáo dòng tiền/P&amp;L, phối hợp với đơn vị dịch vụ thuế. Yêu cầu: <b>1+ năm kinh nghiệm kế toán</b>, kinh nghiệm phần mềm <b>MISA</b>, tiếng Anh giao tiếp. Lương <b>11–15 triệu VND</b>, lương tháng 13, review 6 tháng/lần, lộ trình rõ ràng lên <b>Kế toán tổng hợp / Kế toán trưởng</b>. Công ty <b>ưu tiên ứng viên có thể đi làm ngay trong tuần sau</b>.'
const SUBJECT = {
  public: `[FYI] Bạn được chọn vào danh sách đề cử gửi ${COMPANY} — Accountant`,
  private: `[FYI] Bạn được chọn vào danh sách đề cử — Accountant tại ${COMPANY}`,
}
const HOOK = 'Đội ngũ FYI đã xem xét toàn bộ hồ sơ đã đăng ký và <b>chọn bạn vào danh sách đề cử</b> cho vị trí dưới đây — hồ sơ của bạn phù hợp nhất với yêu cầu của vị trí này.'
const BENEFIT = {
  public: `<b>Trong tuần này</b>, FYI sẽ gửi danh sách đề cử trực tiếp cho người phụ trách tuyển dụng của ${COMPANY}. Hồ sơ của bạn đang ở chế độ công khai nên sẽ được gửi kèm danh sách. Nếu bạn ứng tuyển ngay, CV của bạn sẽ được <b>ưu tiên xem xét</b> cùng lời giới thiệu từ FYI.`,
  private: `<b>Trong tuần này</b>, FYI sẽ gửi danh sách đề cử trực tiếp cho người phụ trách tuyển dụng của ${COMPANY}. Hồ sơ của bạn đang ở chế độ riêng tư — nếu bạn ứng tuyển ngay, CV của bạn sẽ được gửi kèm lời giới thiệu từ FYI và được <b>ưu tiên xem xét</b>.`,
}
const ONETAP = 'Chỉ cần <b>1 chạm</b> — CV đã đăng ký của bạn sẽ được gửi tự động.'

function jobCard(job) {
  const logo = job.logo_url
    ? `<img src="${esc(job.logo_url)}" width="44" height="44" alt="" style="width:44px;height:44px;border-radius:10px;object-fit:cover;background:#f0ebe3;display:block">`
    : `<div style="width:44px;height:44px;border-radius:10px;background:#fff0e6;color:#ff6000;font-weight:800;font-size:16px;text-align:center;line-height:44px">${INITIAL}</div>`
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #eee5da;border-radius:14px;margin-bottom:8px"><tr>
    <td width="44" style="padding:14px 0 14px 14px;vertical-align:middle">${logo}</td>
    <td style="padding:14px 14px 14px 12px;vertical-align:middle">
      <div style="font-size:12px;color:#8a8073;margin-bottom:3px">${esc(COMPANY)}</div>
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
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:14px">${INTRO}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:14px">${HOOK}</td></tr>
  <tr><td style="padding-bottom:10px">${jobCard(job)}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-top:4px">${BENEFIT[frame]} ${ONETAP}</td></tr>
  <tr><td align="center" style="padding:16px 0 6px">
    <a href="${url}" style="display:inline-block;background:#ff6000;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 30px;border-radius:12px">Ứng tuyển 1 chạm →</a>
  </td></tr>
  <tr><td align="center" style="font-size:12.5px;padding-bottom:4px"><a href="${SITE}/ktc/jobs/${JOB_ID}" style="color:#8a8073">Xem mô tả công việc đầy đủ →</a></td></tr>
  <tr><td style="font-size:11.5px;color:#a89f92;text-align:center;line-height:1.5;padding-top:20px">
    Bạn nhận được email này vì đã đăng ký hồ sơ trên FYI.<br>— Đội ngũ FYI · <a href="https://salary-fyi.com/jobs" style="color:#a89f92">salary-fyi.com/jobs</a>
    &nbsp;·&nbsp;<a href="${unsubUrl}" style="color:#a89f92;text-decoration:underline">Hủy đăng ký</a>
  </td></tr>
</table></td></tr></table></body></html>`
}

function emailText(name, url, unsubUrl, job, frame) {
  return `Chào ${firstName(name)},

${strip(INTRO)}

${strip(HOOK)}

- ${job.title.trim()} (${COMPANY}) — ${META_VI} — ${SITE}/ktc/jobs/${JOB_ID}

${strip(BENEFIT[frame])} ${strip(ONETAP)}

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
      .select('id,email,full_name,position,desired_roles,yoe_months,location,english_cert,korean_cert,is_resume_public,skills,resume_summary,headline,experiences,major')
      .not('email', 'is', null).not('resume_url', 'is', null).order('created_at', { ascending: false })),
    fetchAll(() => sb.from('events').select('user_id').eq('event', 'coldmail_unsub').not('user_id', 'is', null).order('id')),
    fetchAll(() => sb.from('job_recommendations').select('user_id').eq('job_id', JOB_ID).order('id')),
    fetchAll(() => sb.from('job_applications').select('user_id').eq('job_id', JOB_ID).order('id')),
    fetchAll(() => sb.from('job_recommendations').select('user_id,to_email')
      .gte('created_at', sinceIso).order('id')),
  ])
  const unsubSet = new Set(unsubs.map((r) => r.user_id))
  const recSet = new Set(recs.map((r) => r.user_id))
  const appliedSet = new Set(apps.map((a) => a.user_id))
  const todayUsers = new Set(todays.map((r) => r.user_id))
  const todayEmails = new Set(todays.map((r) => (r.to_email || '').toLowerCase()).filter(Boolean))

  const seen = new Set()
  const assigned = []
  let skipToday = 0
  for (const p of pool) {
    if (!p.email || /likelion/i.test(p.email)) continue
    const e = p.email.toLowerCase()
    if (seen.has(e) || unsubSet.has(p.id)) continue
    const s = pick(p)
    if (s == null) continue
    seen.add(e)
    if (appliedSet.has(p.id) || recSet.has(p.id)) continue
    if (todayUsers.has(p.id) || todayEmails.has(e)) { skipToday++; continue }
    assigned.push({ p, s, frame: p.is_resume_public ? 'public' : 'private' })
  }

  const pub = assigned.filter((x) => x.frame === 'public').length
  console.log(`발송 대상: ${assigned.length}명 (공개 ${pub} / 비공개 ${assigned.length - pub}) · 시간창 겹침 제외 ${skipToday}`)
  if (!doSend) {
    for (const { p, s, frame } of assigned.sort((a, b) => b.s - a.s))
      console.log(`  [${s}·${frame}] ${p.full_name} <${p.email}> · ${p.position || '?'} · ${Math.round((p.yoe_months || 0) / 12 * 10) / 10}y · ${p.location || '위치?'} · 영어 ${p.english_cert ? 'O' : 'X'}`)
    console.log('\n(dry-run — 실발송하려면 --send)')
    return
  }

  let targets = assigned
  if (maxN) targets = targets.slice(0, maxN)
  let ok = 0, fail = 0
  for (const { p, frame } of targets) {
    const camp = `${CAMP}-${frame}`
    const u = url(p.id, camp), un = unsubFor(p.id, camp)
    const { error } = await resend.emails.send({
      from: RESEND_FROM, to: p.email, subject: SUBJECT[frame],
      html: emailHtml(p.full_name, u, un, job, frame), text: emailText(p.full_name, u, un, job, frame),
      headers: { 'List-Unsubscribe': `<${un}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    })
    if (error) { console.error(`실패 ${p.email}:`, error.message || error); fail++; continue }
    await sb.from('job_recommendations').upsert([{
      user_id: p.id, to_email: p.email, job_id: JOB_ID,
      job_title: job.title, job_company: job.company, sent_by: 'coldmail', kind: 'recommend', status: 'sent',
    }], { onConflict: 'user_id,job_id', ignoreDuplicates: true })
    await sb.from('events').insert([{
      event: 'recommend_sent', page: '/scripts/pi0910-recommend-coldmail',
      meta: { campaign: camp, job_ids: [JOB_ID], frame, group: 'acct' }, user_id: p.id,
    }])
    ok++
    await sleep(400)
  }
  console.log(`\n✅ 발송 완료: ${ok}/${targets.length} (실패 ${fail})`)
}

main().catch((e) => { console.error(e); process.exit(1) })
