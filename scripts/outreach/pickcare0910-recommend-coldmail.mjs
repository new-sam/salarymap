// 픽케어(R138 UI/UX 디자이너 · R139 디지털 마케터, FRESHER) recommend — 9/10 공고 등록 당일 발송.
// JD: 온사이트 HN/HCM/ĐN · 10–12M VND · 영문 CV 필수 · 언어 조건 없음(영어/한국어는 가점만).
// 9/10 실측(이력서·unsub 제외, ≤2y 컷): 마케팅 시그널 726 · UI/UX 코어 212 · 겸업(교집합) 34.
//   레벨 컷: 재학생(2026+) 또는 경력 ≤24개월 — 급여 밴드(10–12M) 미스매치 시니어 제외(pi0910 전례).
//   순수 그래픽 디자이너(UI/UX 증거 없음 ~133)는 1차 제외 — 무반응 시 recommend2 확장 후보(vnib 전례).
// 겸업(UI/UX+마케팅) = 클라이언트 "베스트" 요청: 가점 +2, 메일에 반대편 공고 링크 동봉,
//   events.meta.dual=true 기록 → 추천시트 note 표기용(9/10 클라이언트 요청).
// ktc0907b 패턴 + --gap-hours(같은 날 재실행용, [[feedback-time-gap-not-daily-cap]]).
//
//   node scripts/outreach/pickcare0910-recommend-coldmail.mjs                          # dry-run
//   node scripts/outreach/pickcare0910-recommend-coldmail.mjs --send [--group uiux|mkt] [--max N]
import { Resend } from 'resend'
import { sb, env, fetchAll } from './lib.mjs'
import { makeToken } from '../../lib/campaignToken.js'

const args = process.argv.slice(2)
const flag = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d }
const doSend = args.includes('--send')
const onlyGroup = flag('group', null)
const maxN = flag('max', null) ? parseInt(flag('max'), 10) : null
const gapHours = flag('gap-hours', null) ? parseFloat(flag('gap-hours')) : null
const sinceIso = gapHours != null ? new Date(Date.now() - gapHours * 3600 * 1000).toISOString() : new Date().toISOString().slice(0, 10)
const SITE = String(flag('site', env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com')).replace(/\/$/, '')
const RESEND_FROM = env.RESEND_FROM || 'FYI <hello@salary-fyi.com>'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const firstName = (n) => String(n || '').trim().split(/\s+/).slice(-1)[0] || 'bạn'
const strip = (s) => String(s).replace(/<[^>]+>/g, '')

const COMPANY = 'PickCare'
const INITIAL = 'P'
const META_VI = 'Onsite · HN / TP.HCM / ĐN · 10–12 triệu ₫'
const JOBS = {
  uiux: '2ceee468-83ff-4600-adee-57f8d76ff83c', // R138 UI/UX Designer
  mkt: '38896fad-04c0-4473-b928-8e3ea4f81238', // R139 Digital Marketer
}

// ── 대상 선정 ──
const norm = (v) => (Array.isArray(v) ? v.join(' ') : String(v || ''))
const txt = (p) => {
  const exp = Array.isArray(p.experiences) ? p.experiences.map((e) => `${e.title || e.position || ''} ${e.company || ''}`).join(' ') : ''
  return [p.position, p.headline, norm(p.desired_roles), norm(p.skills), exp, JSON.stringify(p.resume_summary || ''), p.university].join(' ').toLowerCase()
}
const y = (p) => p.yoe_months ?? 0
const gy = (p) => Number(p.graduation_year) || 0
const fresher = (p) => gy(p) >= 2026 || y(p) <= 24 // FRESHER 공고 — 시니어는 급여 미스매치 컷
const posOf = (p) => {
  const s = new Set()
  if (p.position) s.add(String(p.position))
  if (Array.isArray(p.desired_roles)) for (const r of p.desired_roles) s.add(String(r))
  return s
}
// 마케팅 — until0909와 동일 시그널
const mktRole = (p) => [...posOf(p)].some((r) => /marketing/i.test(r))
const mktRe = /(marketing|truyền thông|social media|content|seo|quảng cáo|digital marketing|tiktok|fanpage)/i
const mktSig = (p) => mktRole(p) || mktRe.test(txt(p))
// UI/UX 코어 — nx-designer 어휘 + JD 필수(Figma·wireframe·prototype). 순수 그래픽은 제외.
const dsgRole = (p) => [...posOf(p)].some((r) => ['Design', 'UI/UX Designer'].includes(r))
const UIUX_RE = /ui\/?ux|ux\/?ui|ui design|product design|web design|figma|wireframe|prototype/
const uiuxCore = (p) => [...posOf(p)].includes('UI/UX Designer') || UIUX_RE.test(txt(p))
const koSignal = (p) => !!p.korean_cert || /(korean|tiếng hàn|topik|한국어)/i.test(txt(p))
const inCity = (p) => /(hà nội|ha noi|hanoi|\bhn\b|đà nẵng|da ?nang|h[ồo]\s*ch[íi]\s*minh|hcm|sài gòn|sai gon|thủ đức|thu duc)/i.test(String(p.location || ''))
const score = (p, roleHit, dual) => 1 + (roleHit ? 2 : 0) + (dual ? 2 : 0) + (koSignal(p) ? 2 : 0) + (p.english_cert ? 1 : 0) + (inCity(p) ? 1 : 0)

// 배정: 겸업이면 명시 직군 따라(마케팅 직군이고 디자인 직군 아님 → mkt), 아니면 uiux 우선(희소 풀).
const assign = (p) => {
  if (!fresher(p)) return null
  const ui = uiuxCore(p), mk = mktSig(p)
  if (!ui && !mk) return null
  const dual = ui && mk
  const gkey = ui && !(dual && mktRole(p) && !dsgRole(p)) ? 'uiux' : 'mkt'
  return { gkey, dual, s: score(p, gkey === 'uiux' ? dsgRole(p) : mktRole(p), dual) }
}

const GROUPS = {
  uiux: { camp: 'pickcare0910-recommend1-uiux', label: { vi: 'UI/UX Designer', ko: 'UI/UX 디자이너' } },
  mkt: { camp: 'pickcare0910-recommend1-mkt', label: { vi: 'Digital Marketer', ko: '디지털 마케터' } },
}

// ── 카피(vi 실발송) — 정직 프레임: FRESHER·급여·온사이트 3개 도시·영문 CV 전부 명시해 자기선별 ──
const INTRO = {
  uiux: '<b>PickCare</b> — công ty pet-tech Hàn Quốc phát triển dịch vụ thú cưng ứng dụng AI (pickcare.co.kr) — đang tuyển <b>UI/UX Designer (Fresher)</b> qua FYI, làm việc onsite tại <b>Hà Nội / TP.HCM / Đà Nẵng</b>. Công việc: thiết kế UI/UX cho dịch vụ web·mobile, tạo wireframe &amp; prototype, nâng cấp design system, thiết kế thương hiệu &amp; nội dung. Yêu cầu: thành thạo <b>Figma</b>, Photoshop, Illustrator; có dự án UI/UX web/mobile. Mức lương <b>10–12 triệu VND/tháng</b>. <b>Lưu ý: nộp CV bằng tiếng Anh.</b>',
  mkt: '<b>PickCare</b> — công ty pet-tech Hàn Quốc phát triển dịch vụ thú cưng ứng dụng AI (pickcare.co.kr) — đang tuyển <b>Digital Marketer (Fresher)</b> qua FYI, làm việc onsite tại <b>Hà Nội / TP.HCM / Đà Nẵng</b>. Công việc: chiến lược digital marketing trong nước &amp; quốc tế, vận hành nội dung SNS (Instagram, TikTok, YouTube), quảng cáo Meta Ads, phân tích dữ liệu người dùng. Yêu cầu: kinh nghiệm vận hành kênh SNS, quảng cáo digital hoặc campaign online, phân tích dữ liệu. Mức lương <b>10–12 triệu VND/tháng</b>. <b>Lưu ý: nộp CV bằng tiếng Anh.</b>',
}
// 겸업(9/10 클라이언트: 둘 다 가능한 인력이 베스트) — 반대편 공고도 같이 노출
const DUAL_NOTE = (other) => `PickCare cho biết họ <b>đặc biệt ưu tiên</b> ứng viên có thể đảm nhận cả <b>UI/UX design và digital marketing</b> — hồ sơ của bạn cho thấy cả hai thế mạnh này. Công ty cũng đang tuyển vị trí <a href="${SITE}/ktc/jobs/${JOBS[other]}" style="color:#b0691a">${GROUPS[other].label.vi} →</a>`
const SUBJECT = {
  public: (role) => `[FYI] Bạn được chọn vào danh sách đề cử gửi ${COMPANY} — ${role}`,
  private: (role) => `[FYI] Bạn được chọn vào danh sách đề cử — ${role} tại ${COMPANY}`,
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

function emailHtml(name, url, unsubUrl, job, frame, gkey, dual) {
  const other = gkey === 'uiux' ? 'mkt' : 'uiux'
  const dualRow = dual ? `<tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:14px">${DUAL_NOTE(other)}</td></tr>` : ''
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1612">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f7"><tr><td align="center" style="padding:28px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
  <tr><td style="padding-bottom:18px"><img src="https://salary-fyi.com/fyi-logo.png" height="24" alt="FYI" style="height:24px;width:auto;display:block"></td></tr>
  <tr><td style="font-size:15px;line-height:1.6;color:#1a1612;padding-bottom:6px">Chào ${esc(firstName(name))},</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:14px">${INTRO[gkey]}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:14px">${HOOK}</td></tr>
  <tr><td style="padding-bottom:10px">${jobCard(job)}</td></tr>
  ${dualRow}
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-top:4px">${BENEFIT[frame]} ${ONETAP}</td></tr>
  <tr><td align="center" style="padding:16px 0 6px">
    <a href="${url}" style="display:inline-block;background:#ff6000;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 30px;border-radius:12px">Ứng tuyển 1 chạm →</a>
  </td></tr>
  <tr><td align="center" style="font-size:12.5px;padding-bottom:4px"><a href="${SITE}/ktc/jobs/${JOBS[gkey]}" style="color:#8a8073">Xem mô tả công việc đầy đủ →</a></td></tr>
  <tr><td style="font-size:11.5px;color:#a89f92;text-align:center;line-height:1.5;padding-top:20px">
    Bạn nhận được email này vì đã đăng ký hồ sơ trên FYI.<br>— Đội ngũ FYI · <a href="https://salary-fyi.com/jobs" style="color:#a89f92">salary-fyi.com/jobs</a>
    &nbsp;·&nbsp;<a href="${unsubUrl}" style="color:#a89f92;text-decoration:underline">Hủy đăng ký</a>
  </td></tr>
</table></td></tr></table></body></html>`
}

function emailText(name, url, unsubUrl, job, frame, gkey, dual) {
  const other = gkey === 'uiux' ? 'mkt' : 'uiux'
  return `Chào ${firstName(name)},

${strip(INTRO[gkey])}

${strip(HOOK)}

- ${job.title.trim()} (${COMPANY}) — ${META_VI} — ${SITE}/ktc/jobs/${JOBS[gkey]}
${dual ? `\n${strip(DUAL_NOTE(other))} ${SITE}/ktc/jobs/${JOBS[other]}\n` : ''}
${strip(BENEFIT[frame])} ${strip(ONETAP)}

${url}

Bạn nhận được email này vì đã đăng ký hồ sơ trên FYI.
— Đội ngũ FYI · salary-fyi.com/jobs
Hủy đăng ký: ${unsubUrl}`
}

async function main() {
  const { data: jobRows, error: jobErr } = await sb.from('jobs')
    .select('id,title,company,location,logo_url,is_active').in('id', Object.values(JOBS))
  if (jobErr || (jobRows || []).filter((j) => j.is_active).length !== 2) {
    console.error('공고 없음/비활성:', jobErr?.message || JSON.stringify(jobRows)); process.exit(1)
  }
  const jobBy = Object.fromEntries(Object.entries(JOBS).map(([k, id]) => [k, jobRows.find((j) => j.id === id)]))

  const resend = new Resend(env.RESEND_API_KEY)
  const url = (userId, camp, jobId) => `${SITE}/api/resume/recommend?t=${makeToken(userId, camp)}&j=${jobId}`
  const unsubFor = (userId, camp) => `${SITE}/api/coldmail/unsub?t=${makeToken(userId, camp)}`

  const [pool, unsubs, recs, apps, todays] = await Promise.all([
    fetchAll(() => sb.from('user_profiles')
      .select('id,email,full_name,position,desired_roles,yoe_months,graduation_year,location,english_cert,korean_cert,is_resume_public,skills,resume_summary,headline,experiences,university')
      .not('email', 'is', null).not('resume_url', 'is', null).order('created_at', { ascending: false })),
    fetchAll(() => sb.from('events').select('user_id').eq('event', 'coldmail_unsub').not('user_id', 'is', null).order('id')),
    fetchAll(() => sb.from('job_recommendations').select('user_id,job_id').in('job_id', Object.values(JOBS)).order('id')),
    fetchAll(() => sb.from('job_applications').select('user_id,job_id').in('job_id', Object.values(JOBS)).order('id')),
    fetchAll(() => sb.from('job_recommendations').select('user_id,to_email')
      .gte('created_at', sinceIso).order('id')),
  ])
  const unsubSet = new Set(unsubs.map((r) => r.user_id))
  const recSet = new Set(recs.map((r) => `${r.user_id}:${r.job_id}`))
  const appliedSet = new Set(apps.map((a) => `${a.user_id}:${a.job_id}`))
  const todayUsers = new Set(todays.map((r) => r.user_id))
  const todayEmails = new Set(todays.map((r) => (r.to_email || '').toLowerCase()).filter(Boolean))

  const seen = new Set()
  const assigned = []
  let skipToday = 0
  for (const p of pool) {
    if (!p.email || /likelion/i.test(p.email)) continue
    const e = p.email.toLowerCase()
    if (seen.has(e) || unsubSet.has(p.id)) continue
    const a = assign(p)
    if (!a) continue
    seen.add(e)
    const jobId = JOBS[a.gkey]
    if (appliedSet.has(`${p.id}:${jobId}`) || recSet.has(`${p.id}:${jobId}`)) continue
    if (todayUsers.has(p.id) || todayEmails.has(e)) { skipToday++; continue }
    assigned.push({ p, ...a, frame: p.is_resume_public ? 'public' : 'private' })
  }

  console.log('발송 대상(1인 1통 배정):')
  for (const gkey of Object.keys(GROUPS)) {
    const rows = assigned.filter((r) => r.gkey === gkey)
    const pub = rows.filter((x) => x.frame === 'public').length
    const du = rows.filter((x) => x.dual).length
    console.log(`  ${gkey} (${GROUPS[gkey].label.ko}): ${rows.length}명 (공개 ${pub} / 비공개 ${rows.length - pub} / 겸업 ${du})`)
  }
  console.log(`  ── 합계: ${assigned.length}명 (제외: 시간창 겹침 ${skipToday} — 익일 재실행 시 자동 발송)`)
  if (!doSend) {
    for (const gkey of Object.keys(GROUPS)) {
      const rows = assigned.filter((r) => r.gkey === gkey).sort((a, b) => b.s - a.s)
      if (!rows.length) continue
      console.log(`\n── ${gkey} 상위 5 ──`)
      for (const { p, s, frame, dual } of rows.slice(0, 5))
        console.log(`  [${s}·${frame}${dual ? '·겸업' : ''}] ${p.full_name} <${p.email}> · ${p.position || '?'} · 졸업 ${p.graduation_year || '?'} · ${Math.round((p.yoe_months || 0) / 12 * 10) / 10}y · ${p.location || '위치?'}`)
    }
    console.log('\n(dry-run — 실발송하려면 --send, 그룹 한정 --group <uiux|mkt>)')
    return
  }

  // 9/10 중복 발송 사고 재발 방지: 다른 인스턴스가 방금까지 발송 중이었으면 중단.
  // (백그라운드 task "완료" 알림이 떠도 실제 node 프로세스는 살아있을 수 있음 — 재실행 전 ps 확인 필수)
  const { data: recent } = await sb.from('events').select('id')
    .eq('event', 'recommend_sent').eq('page', '/scripts/pickcare0910-recommend-coldmail')
    .gte('created_at', new Date(Date.now() - 3 * 60 * 1000).toISOString()).limit(1)
  if ((recent || []).length && !args.includes('--force')) {
    console.error('⛔ 최근 3분 내 이 캠페인 발송 이벤트 존재 — 다른 인스턴스가 돌고 있을 수 있음. ps 확인 후 --force로 재실행.')
    process.exit(1)
  }

  let targets = assigned
  if (onlyGroup) targets = targets.filter((r) => r.gkey === onlyGroup)
  if (maxN) targets = targets.slice(0, maxN)
  let ok = 0, fail = 0
  for (const { p, gkey, dual, frame } of targets) {
    const g = GROUPS[gkey]
    const jobId = JOBS[gkey]
    const camp = `${g.camp}-${frame}`
    const u = url(p.id, camp, jobId), un = unsubFor(p.id, camp)
    const { error } = await resend.emails.send({
      from: RESEND_FROM, to: p.email, subject: SUBJECT[frame](g.label.vi),
      html: emailHtml(p.full_name, u, un, jobBy[gkey], frame, gkey, dual),
      text: emailText(p.full_name, u, un, jobBy[gkey], frame, gkey, dual),
      headers: { 'List-Unsubscribe': `<${un}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    })
    if (error) { console.error(`실패 ${p.email}:`, error.message || error); fail++; continue }
    await sb.from('job_recommendations').upsert([{
      user_id: p.id, to_email: p.email, job_id: jobId,
      job_title: jobBy[gkey].title, job_company: jobBy[gkey].company, sent_by: 'coldmail', kind: 'recommend', status: 'sent',
    }], { onConflict: 'user_id,job_id', ignoreDuplicates: true })
    await sb.from('events').insert([{
      event: 'recommend_sent', page: '/scripts/pickcare0910-recommend-coldmail',
      meta: { campaign: camp, job_ids: [jobId], frame, group: gkey, dual }, user_id: p.id,
    }])
    ok++
    if (ok % 25 === 0) console.log(`  …${ok}/${targets.length}`)
    await sleep(400)
  }
  console.log(`\n✅ 발송 완료: ${ok}/${targets.length} (실패 ${fail})`)
}

main().catch((e) => { console.error(e); process.exit(1) })
