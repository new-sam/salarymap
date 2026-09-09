// 테크밸리(TechValley Vietnam, HCMC) 3공고 recommend — 9/9 Mia 게재 알림 → 당일 발송(유저 지시 "오늘 보낼 수 있는 사람 다").
// V82 클라우드 아키텍트(주니어): 경력 2y 미만·AWS 실무 필수·영어+영문 CV 필수 / V83 IT컴토 인턴: 경력 1y 미만·TOPIK5+(or 4+회화) 우대·400만 동
// V84 마케팅 인턴(9/9 source_id 백필): 4학년/갓졸업 마케팅·영어 필수·한국어 가점·400만 동.
// 9/9 풀봇 실측: cloud 코어3+확장134 / comtor 한국어×주니어 ~112(≤2y 기준, JD는 ≤1y라 더 좁힘) / mkt 코어 471(당일 겹침 304 → 오늘 신규 ~167).
// 셋 다 HCMC 온사이트 — 인턴 2건(comtor·mkt)은 HCMC권+미기재 지역 게이트(월 400만 동에 이주 비현실), cloud는 정규직이라 게이트 없이 HCMC 가점만.
// ktc0907b 패턴: 룰 캐스케이드(좁은 순: comtor→cloud→mkt) → 1인1통(당일 발송자 제외) → 공개/비공개 프레임.
//
//   node scripts/outreach/tv0909-recommend-coldmail.mjs                          # dry-run
//   node scripts/outreach/tv0909-recommend-coldmail.mjs --send [--group mkt] [--max N]
import { Resend } from 'resend'
import { sb, env, fetchAll } from './lib.mjs'
import { makeToken } from '../../lib/campaignToken.js'

const args = process.argv.slice(2)
const flag = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d }
const doSend = args.includes('--send')
const onlyGroup = flag('group', null)
const maxN = flag('max', null) ? parseInt(flag('max'), 10) : null
const SITE = String(flag('site', env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com')).replace(/\/$/, '')
const RESEND_FROM = env.RESEND_FROM || 'FYI <hello@salary-fyi.com>'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const firstName = (n) => String(n || '').trim().split(/\s+/).slice(-1)[0] || 'bạn'
const strip = (s) => String(s).replace(/<[^>]+>/g, '')

const JOBS = {
  CLOUD: '3124c03e-41f3-42bb-8248-c4a7d4979b43', // V82 Cloud Solutions Architect (Junior)
  COMTOR: '34ebad6c-a992-4978-9b00-137cf3850120', // V83 INTERN - Phiên dịch Tiếng Hàn (IT COMTOR)
  MKT: 'eae4f1ba-b0e1-449c-80fe-001af84ead1d', // V84 MARKETING INTERN
}
const COMPANY = 'TechValley'
const INITIAL = 'T'

// ── 대상 선정 ──
const norm = (v) => (Array.isArray(v) ? v.join(' ') : String(v || ''))
const txt = (p) => {
  const exp = Array.isArray(p.experiences) ? p.experiences.map((e) => `${e.title || e.position || ''} ${e.company || ''}`).join(' ') : ''
  return [p.position, p.headline, norm(p.desired_roles), norm(p.skills), exp, JSON.stringify(p.resume_summary || ''), p.university, p.major].join(' ').toLowerCase()
}
const roles = (p) => [p.position, ...(p.desired_roles || [])].filter(Boolean)
const hasAny = (p, arr) => roles(p).some((r) => arr.includes(r))
const y = (p) => p.yoe_months ?? 0
const gy = (p) => Number(p.graduation_year) || 0
const inHcmc = (p) => /(h[ồo]\s*ch[íi]\s*minh|hcm|sài gòn|sai gon|thủ đức|thu duc|bình dương|binh duong)/i.test(String(p.location || ''))
const noLoc = (p) => !String(p.location || '').trim()
const koSignal = (p) => !!p.korean_cert || /(korean|tiếng hàn|topik|한국어)/i.test(txt(p))
const koLevel = (p) => {
  const c = String(p.korean_cert || '')
  const m = c.match(/topik\D*(\d)/i)
  if (m) return parseInt(m[1], 10)
  if (/fluent|advanced|native|thành thạo/i.test(c)) return 5
  if (c && !/none|basic|beginner/i.test(c)) return 2
  return 0
}
// 클라우드 스킬(풀봇 추출과 동일, docker/python은 범용이라 제외됨)
const CLOUD_KWS = ['aws', 'vpc', 'ec2', '\\bs3\\b', 'rds', '\\biam\\b', '\\belb\\b', 'cloudwatch', 'route ?53', 'cloudfront', 'vmware', 'terraform', 'cloudformation', 'linux', 'centos', 'ubuntu', '\\becs\\b', '\\beks\\b', '\\bbash\\b', 'powershell']
  .map((k) => new RegExp(k, 'i'))
const cloudHits = (p) => { const t = txt(p); return CLOUD_KWS.filter((re) => re.test(t)).length }
const CLOUD_ROLES = ['Solutions Architect', 'Cloud', 'SysAdmin', 'DevOps', 'SRE']
const mktRole = (p) => roles(p).some((r) => /marketing/i.test(r))
const contentRe = /(content|social media|video edit|canva|capcut|photoshop|design|fanpage|tiktok|youtube|seo)/i
const koMajorRe = /(ngôn ngữ hàn|hàn quốc học|korean (language|studies)|한국어|tiếng hàn)/i
// 인턴 연령대: 재학(2026+ 졸업예정) or 갓졸업(2024~25 × ≤1y) or 졸업연도 미기재 × ≤1y
const internAge = (p) => gy(p) >= 2026 || ((gy(p) === 0 || (gy(p) >= 2024 && gy(p) <= 2025)) && y(p) <= 12)

// 캐스케이드: 요건 좁은 순(comtor 한국어×≤1y → cloud 스킬 게이트 → mkt), 1인 1그룹.
const GROUPS = [
  {
    gkey: 'comtor', jobKey: 'COMTOR', camp: 'tv0909-recommend1-comtor',
    label: { vi: 'Thực tập sinh Phiên dịch tiếng Hàn (IT COMTOR)', ko: 'IT컴토 인턴' },
    meta: 'Onsite · TP.HCM · Thực tập · 4tr ₫/tháng',
    // JD: 경력 1y 미만 × 한국어 시그널 × HCMC권(미기재 허용). TOPIK 급수·한국어 전공·영어 가점.
    pick: (p) => {
      if (!koSignal(p) || y(p) > 12 || !(inHcmc(p) || noLoc(p))) return null
      const lv = koLevel(p)
      return (lv >= 5 ? 3 : lv >= 4 ? 2 : lv > 0 ? 1 : 0) + (koMajorRe.test(txt(p)) ? 2 : 0) + (hasAny(p, ['Interpreter', 'Non-IT']) ? 1 : 0) + (p.english_cert ? 1 : 0) + (inHcmc(p) ? 1 : 0)
    },
    intro: '<b>TechValley Vietnam</b> — công ty Hàn Quốc về IT outsourcing tổng hợp, hạ tầng cloud &amp; tư vấn, trụ sở tại <b>TP.HCM</b>, phục vụ khách hàng doanh nghiệp Việt Nam và Hàn Quốc — đang tuyển <b>Thực tập sinh Phiên dịch tiếng Hàn (IT COMTOR)</b> qua FYI. Công việc: tham gia meeting với khách hàng/đối tác Hàn Quốc cùng Manager, hỗ trợ biên phiên dịch tài liệu Hàn–Việt/Anh, làm đầu mối giao tiếp với Manager người Hàn. Dành cho <b>sinh viên hoặc bạn mới tốt nghiệp</b> ngành tiếng Hàn/Hàn Quốc học (kinh nghiệm dưới 1 năm); ưu tiên <b>TOPIK 5+</b> hoặc TOPIK 4 giao tiếp tốt. Trợ cấp <b>4.000.000 VND/tháng</b>, có cơ hội chuyển hợp đồng thử việc sau 3 tháng.',
  },
  {
    gkey: 'cloud', jobKey: 'CLOUD', camp: 'tv0909-recommend1-cloud',
    label: { vi: 'Cloud Solutions Architect (Junior)', ko: '클라우드 솔루션스 아키텍트(주니어)' },
    meta: 'Onsite · TP.HCM · Junior (<2 năm)',
    // JD: 클라우드 경력 2y 미만 주니어(총경력 ≤3y로 운용) × 영어 필수 × AWS 실무 증거(스킬 2개+ or 인접 직군×1개+).
    pick: (p) => {
      if (!p.english_cert || y(p) > 36) return null
      const hits = cloudHits(p)
      const roleMatch = hasAny(p, CLOUD_ROLES)
      if (!(hits >= 2 || (roleMatch && hits >= 1))) return null
      return hits + (roleMatch ? 2 : 0) + (/aws certified|solutions architect.*associate|saa-c/i.test(txt(p)) ? 2 : 0) + (y(p) <= 24 ? 1 : 0) + (inHcmc(p) ? 1 : 0)
    },
    intro: '<b>TechValley Vietnam</b> — công ty Hàn Quốc về IT outsourcing tổng hợp, hạ tầng cloud &amp; tư vấn, trụ sở tại <b>TP.HCM</b>, phục vụ khách hàng doanh nghiệp Việt Nam và Hàn Quốc — đang tuyển <b>Cloud Solutions Architect (Junior)</b> qua FYI. Công việc: thiết kế &amp; triển khai hạ tầng AWS (VPC, EC2, S3, RDS, IAM…), vận hành môi trường cloud production, hỗ trợ migration VMware/on-premises lên AWS và cloud nội địa. Yêu cầu: <b>dưới 2 năm kinh nghiệm</b> cloud, kỹ năng <b>AWS thực chiến</b>, tiếng Anh tốt. Được mentorship từ senior architect và <b>tài trợ lệ phí thi chứng chỉ AWS</b>. Lưu ý: vui lòng ứng tuyển bằng <b>CV tiếng Anh</b>.',
  },
  {
    gkey: 'mkt', jobKey: 'MKT', camp: 'tv0909-recommend1-mkt',
    label: { vi: 'Marketing Intern', ko: '마케팅 인턴' },
    meta: 'Onsite · TP.HCM · Thực tập · 4tr ₫/tháng',
    // JD: 4학년/갓졸업 마케팅·커뮤니케이션·PR × 영어 필수 × HCMC권(미기재 허용). 한국어·콘텐츠 제작 가점.
    pick: (p) => {
      if (!mktRole(p) || !p.english_cert || !internAge(p) || !(inHcmc(p) || noLoc(p))) return null
      return 1 + (gy(p) >= 2026 ? 1 : 0) + (koSignal(p) ? 2 : 0) + (contentRe.test(txt(p)) ? 1 : 0) + (inHcmc(p) ? 1 : 0)
    },
    intro: '<b>TechValley Vietnam</b> — công ty Hàn Quốc về IT outsourcing tổng hợp, hạ tầng cloud &amp; tư vấn, trụ sở tại <b>TP.HCM</b>, phục vụ khách hàng doanh nghiệp Việt Nam và Hàn Quốc — đang tuyển <b>Marketing Intern</b> qua FYI. Công việc: sáng tạo nội dung trên Facebook Fanpage, YouTube, Website &amp; Naver Blog, chạy campaign cùng Marketing Manager, hỗ trợ sự kiện/hội thảo B2B. Dành cho <b>sinh viên năm 4 hoặc bạn mới tốt nghiệp</b> ngành Marketing/Truyền thông/PR, tiếng Anh tốt (tiếng Hàn là điểm cộng). Trợ cấp <b>4.000.000 VND/tháng</b>, có cơ hội chuyển hợp đồng thử việc sau 3 tháng.',
  },
]

// ── 카피(vi 실발송) — ktc0907b 정직 프레임(공개/비공개) ──
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

function jobCard(g, job) {
  const logo = job.logo_url
    ? `<img src="${esc(job.logo_url)}" width="44" height="44" alt="" style="width:44px;height:44px;border-radius:10px;object-fit:cover;background:#f0ebe3;display:block">`
    : `<div style="width:44px;height:44px;border-radius:10px;background:#fff0e6;color:#ff6000;font-weight:800;font-size:16px;text-align:center;line-height:44px">${INITIAL}</div>`
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #eee5da;border-radius:14px;margin-bottom:8px"><tr>
    <td width="44" style="padding:14px 0 14px 14px;vertical-align:middle">${logo}</td>
    <td style="padding:14px 14px 14px 12px;vertical-align:middle">
      <div style="font-size:12px;color:#8a8073;margin-bottom:3px">${esc(COMPANY)}</div>
      <div style="font-size:14.5px;font-weight:700;color:#1a1612;line-height:1.35">${esc(job.title.trim())}</div>
      <div style="font-size:12px;color:#b0691a;margin-top:3px">${esc(g.meta)}</div>
    </td>
  </tr></table>`
}

function emailHtml(name, url, unsubUrl, g, job, frame) {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1612">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f7"><tr><td align="center" style="padding:28px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
  <tr><td style="padding-bottom:18px"><img src="https://salary-fyi.com/fyi-logo.png" height="24" alt="FYI" style="height:24px;width:auto;display:block"></td></tr>
  <tr><td style="font-size:15px;line-height:1.6;color:#1a1612;padding-bottom:6px">Chào ${esc(firstName(name))},</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:14px">${g.intro}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:14px">${HOOK}</td></tr>
  <tr><td style="padding-bottom:10px">${jobCard(g, job)}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-top:4px">${BENEFIT[frame]} ${ONETAP}</td></tr>
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

function emailText(name, url, unsubUrl, g, job, frame) {
  return `Chào ${firstName(name)},

${strip(g.intro)}

${strip(HOOK)}

- ${job.title.trim()} (${COMPANY}) — ${g.meta} — ${SITE}/ktc/jobs/${job.id}

${strip(BENEFIT[frame])} ${strip(ONETAP)}

${url}

Bạn nhận được email này vì đã đăng ký hồ sơ trên FYI.
— Đội ngũ FYI · salary-fyi.com/jobs
Hủy đăng ký: ${unsubUrl}`
}

async function main() {
  const { data: jobRows, error: jobErr } = await sb.from('jobs')
    .select('id,title,company,location,logo_url,is_active').in('id', Object.values(JOBS))
  if (jobErr) { console.error(jobErr.message); process.exit(1) }
  const jobById = Object.fromEntries((jobRows || []).map((j) => [j.id, j]))
  for (const [code, id] of Object.entries(JOBS)) {
    if (!jobById[id] || !jobById[id].is_active) { console.error(`공고 없음/비활성: ${code} ${id}`); process.exit(1) }
  }
  const resend = new Resend(env.RESEND_API_KEY)
  const url = (userId, camp, jobId) => `${SITE}/api/resume/recommend?t=${makeToken(userId, camp)}&j=${jobId}`
  const unsubFor = (userId, camp) => `${SITE}/api/coldmail/unsub?t=${makeToken(userId, camp)}`

  const [pool, unsubs, recs, apps, todays] = await Promise.all([
    fetchAll(() => sb.from('user_profiles')
      .select('id,email,full_name,position,desired_roles,yoe_months,graduation_year,location,english_cert,korean_cert,is_resume_public,skills,resume_summary,headline,experiences,university,major')
      .not('email', 'is', null).not('resume_url', 'is', null).order('created_at', { ascending: false })),
    fetchAll(() => sb.from('events').select('user_id').eq('event', 'coldmail_unsub').not('user_id', 'is', null).order('id')),
    fetchAll(() => sb.from('job_recommendations').select('user_id,job_id').in('job_id', Object.values(JOBS)).order('id')),
    fetchAll(() => sb.from('job_applications').select('user_id,job_id').in('job_id', Object.values(JOBS)).order('id')),
    fetchAll(() => sb.from('job_recommendations').select('user_id,to_email')
      .gte('created_at', new Date().toISOString().slice(0, 10)).order('id')),
  ])
  const unsubSet = new Set(unsubs.map((r) => r.user_id))
  const todayUsers = new Set(todays.map((r) => r.user_id))
  const todayEmails = new Set(todays.map((r) => (r.to_email || '').toLowerCase()).filter(Boolean))
  const recUserByJob = {}, appliedByJob = {}
  for (const r of recs) (recUserByJob[r.job_id] ||= new Set()).add(r.user_id)
  for (const a of apps) (appliedByJob[a.job_id] ||= new Set()).add(a.user_id)

  const seen = new Set()
  const assigned = []
  let skipToday = 0
  for (const p of pool) {
    if (!p.email || /likelion/i.test(p.email)) continue
    const e = p.email.toLowerCase()
    if (seen.has(e) || unsubSet.has(p.id)) continue
    for (const g of GROUPS) {
      const s = g.pick(p)
      if (s == null) continue
      const jid = JOBS[g.jobKey]
      if ((recUserByJob[jid] || new Set()).has(p.id) || (appliedByJob[jid] || new Set()).has(p.id)) continue
      seen.add(e)
      if (todayUsers.has(p.id) || todayEmails.has(e)) { skipToday++; break }
      assigned.push({ p, s, g, frame: p.is_resume_public ? 'public' : 'private' })
      break
    }
  }

  console.log('발송 대상(1인 1통 배정):')
  for (const g of GROUPS) {
    const rows = assigned.filter((r) => r.g.gkey === g.gkey)
    const pub = rows.filter((x) => x.frame === 'public').length
    console.log(`  ${g.gkey} [${g.jobKey}] (${g.label.ko}): ${rows.length}명 (공개 ${pub} / 비공개 ${rows.length - pub})`)
  }
  console.log(`  ── 합계: ${assigned.length}명 (당일 발송 겹침 제외 ${skipToday} — 익일 재실행 시 자동 발송)`)
  if (!doSend) {
    for (const g of GROUPS) {
      const rows = assigned.filter((r) => r.g.gkey === g.gkey).sort((a, b) => b.s - a.s)
      if (!rows.length) continue
      console.log(`\n── ${g.gkey} 상위 5 ──`)
      for (const { p, s, frame } of rows.slice(0, 5))
        console.log(`  [${s}·${frame}] ${p.full_name} <${p.email}> · ${p.position || '?'} · 졸업 ${p.graduation_year || '?'} · ${Math.round((p.yoe_months || 0) / 12 * 10) / 10}y · ${p.location || '위치?'}`)
    }
    console.log('\n(dry-run — 실발송하려면 --send, 그룹 한정 --group <gkey>)')
    return
  }

  let targets = assigned
  if (onlyGroup) targets = targets.filter((r) => r.g.gkey === onlyGroup)
  if (maxN) targets = targets.slice(0, maxN)
  let ok = 0, fail = 0
  for (const { p, g, frame } of targets) {
    const job = jobById[JOBS[g.jobKey]]
    const camp = `${g.camp}-${frame}`
    const u = url(p.id, camp, job.id), un = unsubFor(p.id, camp)
    const { error } = await resend.emails.send({
      from: RESEND_FROM, to: p.email, subject: SUBJECT[frame](g.label.vi),
      html: emailHtml(p.full_name, u, un, g, job, frame), text: emailText(p.full_name, u, un, g, job, frame),
      headers: { 'List-Unsubscribe': `<${un}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    })
    if (error) { console.error(`실패 ${p.email}:`, error.message || error); fail++; continue }
    await sb.from('job_recommendations').upsert([{
      user_id: p.id, to_email: p.email, job_id: job.id,
      job_title: job.title, job_company: job.company, sent_by: 'coldmail', kind: 'recommend', status: 'sent',
    }], { onConflict: 'user_id,job_id', ignoreDuplicates: true })
    await sb.from('events').insert([{
      event: 'recommend_sent', page: '/scripts/tv0909-recommend-coldmail',
      meta: { campaign: camp, job_ids: [job.id], frame, group: g.gkey }, user_id: p.id,
    }])
    ok++
    if (ok % 25 === 0) console.log(`  …${ok}/${targets.length}`)
    await sleep(400)
  }
  console.log(`\n✅ 발송 완료: ${ok}/${targets.length} (실패 ${fail})`)
}

main().catch((e) => { console.error(e); process.exit(1) })
