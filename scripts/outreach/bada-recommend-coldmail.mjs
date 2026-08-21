// Bada Fintech 3개 공고(BADA4201~4203) 추천 콜드메일 — kyndof 패턴(그룹 배정·공개/비공개 프레임·1일 1통).
// 배경: 바다핀테크(매출채권 유동화 핀테크, 하나은행 KR/VN) 베트남 진출 테스트 채용, 8/20 공고 게재.
// 선정은 룰 기반(LLM 채점 없음 — 빠른 소싱 요청): plan1=한국어(TOPIK3+)×기획/비즈/한국유학,
// uiux1=디자인·UX/UI감각 프론트 상위, mkt1=콘텐츠·퍼포먼스 마케터 상위. 배정 우선순위=모수 얇은 순.
// ⚠️ 카피가 "이번 주 담당자에게 명단 전달" 약속 — 발송 후 바다핀테크에 추천 명단 실제 공유할 것.
//
//   node scripts/outreach/bada-recommend-coldmail.mjs                          # dry-run
//   node scripts/outreach/bada-recommend-coldmail.mjs --send [--group plan1] [--max N]
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

// ── 대상 선정(룰 기반) ──
const norm = (v) => (Array.isArray(v) ? v.join(' ') : String(v || ''))
const txt = (p) => {
  const exp = Array.isArray(p.experiences) ? p.experiences.map((e) => `${e.title || e.position || ''} ${e.company || ''}`).join(' ') : ''
  return [p.position, p.headline, norm(p.desired_roles), norm(p.skills), exp, p.university].join(' ').toLowerCase()
}
const koLevel = (p) => {
  const c = String(p.korean_cert || '')
  const m = c.match(/topik\D*(\d)/i)
  if (m) return parseInt(m[1], 10)
  if (/fluent|advanced|native|thành thạo/i.test(c)) return 5
  if (c && !/none|basic|beginner/i.test(c)) return 2
  return 0
}
const KR_EDU = /seoul|yonsei|hanyang|kyung ?hee|sogang|chung-?ang|konkuk|sungkyunkwan|hongik|kongju|gongju|pusan|inha|ajou|hankuk|sejong ?univ|woosong|dongguk|daegu|gachon|가천|hàn quốc|한국/i
const BIZISH = /business|analyst|기획|planning|product|operations|finance|bank|fintech|consult|coordinator|interpreter|translat|sales|research/i

// 그룹별 (필터, 점수) — 점수는 그룹 내 정렬·컷용
const GROUPS = [
  {
    key: 'plan1', code: 'BADA4201', cap: null,
    label: { vi: 'Hoạch định Dịch vụ Tài chính & Nghiên cứu Thị trường', ko: '금융서비스 기획·시장조사' },
    pick: (p) => {
      if (koLevel(p) < 3) return null
      const t = txt(p)
      const biz = BIZISH.test(t) || ['PM', 'Business Analyst', 'Operations', 'Non-IT', 'Interpreter', 'Sales', 'Marketing'].includes(String(p.position))
      const edu = KR_EDU.test(String(p.university || ''))
      if (!biz && !edu) return null
      return koLevel(p) * 2 + (edu ? 3 : 0) + (biz ? 1 : 0)
    },
  },
  {
    key: 'uiux1', code: 'BADA4202', cap: 120,
    label: { vi: 'Frontend & UI/UX Localization', ko: 'UI/UX·프론트엔드' },
    pick: (p) => {
      const t = txt(p)
      const isDesign = String(p.position) === 'Design' || /ui\/?ux|product design|ux design/i.test(t)
      const isFe = String(p.position) === 'Frontend' && /ui|ux|figma|design/i.test(t)
      if (!isDesign && !isFe) return null
      let s = 0
      if (/figma/i.test(t)) s += 2
      if (/ui\/?ux|product design/i.test(t)) s += 2
      if (/mobile|app design|ios|android/i.test(t)) s += 1
      if (isFe) s += 1
      if ((p.yoe_months ?? 0) >= 12) s += 1
      return s >= 2 ? s : null
    },
  },
  {
    key: 'mkt1', code: 'BADA4203', cap: 150,
    label: { vi: 'Content & Performance Marketing', ko: '콘텐츠·퍼포먼스 마케팅' },
    pick: (p) => {
      const t = txt(p)
      const isMk = String(p.position) === 'Marketing' || /marketing|content creat|performance|growth|tiktok|social media/i.test(t)
      if (!isMk) return null
      let s = 0
      if (/performance|paid (ads|media)|meta ads|google ads|facebook ads|media buy/i.test(t)) s += 3
      if (/content|tiktok|social media|creative/i.test(t)) s += 2
      if (/growth|seo/i.test(t)) s += 1
      if ((p.yoe_months ?? 0) >= 12) s += 1
      return s >= 2 ? s : null
    },
  },
]
const campaignOf = (g, frame) => `bada-recommend1-${g}-${frame}`

// ── 카피(vi 실발송) — kyndof 표준 정직 프레임(공개/비공개) ──
const COPY = {
  subject: {
    public: (role) => `[FYI] Bạn được chọn vào danh sách đề cử gửi Bada Fintech — ${role}`,
    private: (role) => `[FYI] Bạn được chọn vào danh sách đề cử — ${role} tại Bada Fintech`,
  },
  intro: '<b>Bada Fintech</b> — công ty fintech Hàn Quốc chuyên về giải pháp tài chính dựa trên khoản phải thu (receivables financing), kết nối với Ngân hàng Hana tại Hàn Quốc và Việt Nam — đang chuẩn bị ra mắt dịch vụ tại thị trường Việt Nam và tuyển dụng các vị trí chủ chốt qua FYI.',
  hook: 'Đội ngũ FYI đã xem xét toàn bộ hồ sơ đã đăng ký và <b>chọn bạn vào danh sách đề cử</b> cho vị trí dưới đây — hồ sơ của bạn phù hợp với yêu cầu của vị trí này.',
  benefit: {
    public: '<b>Trong tuần này</b>, FYI sẽ gửi danh sách đề cử trực tiếp cho người phụ trách tuyển dụng của Bada Fintech. Hồ sơ của bạn đang ở chế độ công khai nên sẽ được gửi kèm danh sách. Nếu bạn ứng tuyển ngay, CV của bạn sẽ được <b>ưu tiên xem xét</b> cùng lời giới thiệu từ FYI.',
    private: '<b>Trong tuần này</b>, FYI sẽ gửi danh sách đề cử trực tiếp cho người phụ trách tuyển dụng của Bada Fintech. Hồ sơ của bạn đang ở chế độ riêng tư — nếu bạn ứng tuyển ngay, CV của bạn sẽ được gửi kèm lời giới thiệu từ FYI và được <b>ưu tiên xem xét</b>.',
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
    : `<div style="width:44px;height:44px;border-radius:10px;background:#fff0e6;color:#ff6000;font-weight:800;font-size:16px;text-align:center;line-height:44px">B</div>`
  const meta = [salaryLine(job), job.location].filter(Boolean).map(esc).join(' · ')
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #eee5da;border-radius:14px;margin-bottom:8px"><tr>
    <td width="44" style="padding:14px 0 14px 14px;vertical-align:middle">${logo}</td>
    <td style="padding:14px 14px 14px 12px;vertical-align:middle">
      <div style="font-size:12px;color:#8a8073;margin-bottom:3px">Bada Fintech</div>
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

- ${job.title.trim()} (Bada Fintech) — ${[salaryLine(job), job.location].filter(Boolean).join(' · ')} — ${SITE}/ktc/jobs/${job.id}

${strip(COPY.benefit[frame])} ${strip(COPY.onetap)}

${url}

Bạn nhận được email này vì đã đăng ký hồ sơ trên FYI.
— Đội ngũ FYI · salary-fyi.com/jobs
Hủy đăng ký: ${unsubUrl}`
}

async function main() {
  const jobs = await fetchAll(() => sb.from('jobs')
    .select('id,source_id,title,company,location,logo_url,is_active,salary_min,salary_max')
    .ilike('company', '%bada%').order('source_id'))
  const jobByCode = Object.fromEntries(jobs.map((j) => [j.source_id, j]))
  for (const g of GROUPS) {
    if (!jobByCode[g.code] || !jobByCode[g.code].is_active) { console.error(`공고 없음/비활성: ${g.code}`); process.exit(1) }
  }
  const resend = new Resend(env.RESEND_API_KEY)
  const url = (userId, camp, jobId) => `${SITE}/api/resume/recommend?t=${makeToken(userId, camp)}&j=${jobId}`
  const unsubFor = (userId, camp) => `${SITE}/api/coldmail/unsub?t=${makeToken(userId, camp)}`

  const jobIds = jobs.map((j) => j.id)
  const [pool, unsubs, recs, apps, todays] = await Promise.all([
    fetchAll(() => sb.from('user_profiles')
      .select('id,email,full_name,position,headline,skills,desired_roles,yoe_months,experiences,is_resume_public,korean_cert,english_cert,university')
      .not('email', 'is', null).not('resume_url', 'is', null).order('created_at', { ascending: false })),
    fetchAll(() => sb.from('events').select('user_id').eq('event', 'coldmail_unsub').not('user_id', 'is', null).order('id')),
    fetchAll(() => sb.from('job_recommendations').select('user_id,job_id').in('job_id', jobIds).order('id')),
    fetchAll(() => sb.from('job_applications').select('user_id,job_id').in('job_id', jobIds).order('id')),
    fetchAll(() => sb.from('job_recommendations').select('user_id,to_email')
      .gte('created_at', new Date().toISOString().slice(0, 10)).order('id')),
  ])
  const unsubSet = new Set(unsubs.map((r) => r.user_id))
  const todayUsers = new Set(todays.map((r) => r.user_id))
  const todayEmails = new Set(todays.map((r) => (r.to_email || '').toLowerCase()).filter(Boolean))
  const recUserByJob = {}, appliedByJob = {}
  for (const r of recs) (recUserByJob[r.job_id] ||= new Set()).add(r.user_id)
  for (const a of apps) (appliedByJob[a.job_id] ||= new Set()).add(a.user_id)

  // 배정: GROUPS 순서 = 우선순위(모수 얇은 plan1 먼저), 1인 1그룹
  const seen = new Set()
  const byGroup = { plan1: [], uiux1: [], mkt1: [] }
  for (const p of pool) {
    if (!p.email || /likelion/i.test(p.email)) continue
    const e = p.email.toLowerCase()
    if (seen.has(e) || unsubSet.has(p.id)) continue
    if (todayUsers.has(p.id) || todayEmails.has(e)) continue
    for (const g of GROUPS) {
      const job = jobByCode[g.code]
      if ((appliedByJob[job.id] || new Set()).has(p.id)) continue
      if ((recUserByJob[job.id] || new Set()).has(p.id)) continue
      const s = g.pick(p)
      if (s == null) continue
      byGroup[g.key].push({ p, s, frame: p.is_resume_public ? 'public' : 'private' })
      seen.add(e)
      break
    }
  }
  for (const g of GROUPS) {
    byGroup[g.key].sort((a, b) => b.s - a.s)
    if (g.cap) byGroup[g.key] = byGroup[g.key].slice(0, g.cap)
  }

  console.log('발송 대상(1인 1통 배정):')
  for (const g of GROUPS) {
    const rows = byGroup[g.key]
    const pub = rows.filter((x) => x.frame === 'public').length
    console.log(`  ${g.key} (${g.label.ko}, ${g.code}): ${rows.length}명 (공개 ${pub} / 비공개 ${rows.length - pub})`)
  }
  if (!doSend) {
    for (const g of GROUPS) {
      console.log(`\n── ${g.key} 상위 10 ──`)
      for (const { p, s, frame } of byGroup[g.key].slice(0, 10))
        console.log(`  [${s}·${frame}] ${p.full_name} <${p.email}> · ${p.position || '?'} · ${Math.round((p.yoe_months || 0) / 12 * 10) / 10}y · ko:${p.korean_cert || '-'}`)
    }
    console.log('\n(dry-run — 실발송하려면 --send, 그룹 한정 --group <key>)')
    return
  }

  let targets = []
  for (const g of GROUPS) {
    if (onlyGroup && g.key !== onlyGroup) continue
    for (const row of byGroup[g.key]) targets.push({ ...row, g })
  }
  if (maxN) targets = targets.slice(0, maxN)
  let ok = 0, fail = 0
  for (const { p, frame, g } of targets) {
    const job = jobByCode[g.code]
    const camp = campaignOf(g.key, frame)
    const u = url(p.id, camp, job.id), un = unsubFor(p.id, camp)
    const { error } = await resend.emails.send({
      from: RESEND_FROM, to: p.email, subject: COPY.subject[frame](g.label.vi),
      html: emailHtml(p.full_name, u, un, job, frame), text: emailText(p.full_name, u, un, job, frame),
      headers: { 'List-Unsubscribe': `<${un}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    })
    if (error) { console.error(`실패 ${p.email}:`, error.message || error); fail++; continue }
    await sb.from('job_recommendations').upsert([{
      user_id: p.id, to_email: p.email, job_id: job.id,
      job_title: job.title, job_company: job.company, sent_by: 'coldmail', kind: 'recommend', status: 'sent',
    }], { onConflict: 'user_id,job_id', ignoreDuplicates: true })
    await sb.from('events').insert([{
      event: 'recommend_sent', page: '/scripts/bada-recommend-coldmail',
      meta: { campaign: camp, job_ids: [job.id], frame, group: g.key }, user_id: p.id,
    }])
    ok++
    if (ok % 25 === 0) console.log(`  …${ok}/${targets.length}`)
    await sleep(400)
  }
  console.log(`\n✅ 발송 완료: ${ok}/${targets.length} (실패 ${fail})`)
}

main().catch((e) => { console.error(e); process.exit(1) })
