// 어뮤징랩(R189) 베트남 시장조사 인턴(리서치) recommend — 9/11 Len FYI 등록 당일 발송(성영님 지인 기업·ASAP).
// JD: 트렌드 발굴·분석→인사이트, 뉴스/SNS/커뮤니티 정보수집, 경쟁사 조사, AI 활용 리서치.
//     학력·경력 무관·신입 가능 · 수습 5,000,000 VND/월 · 영문 CV 제출 · 공고 표기 HCMC 온사이트.
// 9/11 풀 실측(풀봇 코어53/확장141 재현): 인턴 적합(경력 1y 초과 컷 — until0909 전례: 30만원 인턴에 경력자 미스매치)
//   = 재학생(2026+) 53 + 갓졸업(24-25·≤1y) 21 + 기타 신입(≤1y) 19 = 93.
// 매칭은 풀봇과 동일: BA 직군 코어 | 인접(Marketing/Operations)×키워드1+ | 키워드 2+ 매치.
// 언어(영/한)는 JD 우대라 하드컷 없이 가점만. 1인1통(당일 recommend 기수신 제외) · 공개/비공개 프레임.
//
//   node scripts/outreach/amusing0911-recommend-coldmail.mjs                       # dry-run
//   node scripts/outreach/amusing0911-recommend-coldmail.mjs --send [--group student] [--max N] [--gap-hours N]
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

const JOB_ID = '82b40cf6-7418-4c71-9677-be654f1fe833' // Amusing Lab 시장조사 인턴 (R189)

// ── 대상 선정 — 풀봇(lib/poolEstimator.js)과 동일 텍스트·매칭으로 실측 93명 재현 ──
const txt = (p) => (JSON.stringify(p.skills || '') + ' ' + String(p.position || '') + ' ' + String(p.resume_summary || '')).toLowerCase()
const roles = (p) => [p.position, ...(p.desired_roles || [])].filter(Boolean)
const CORE = ['Business Analyst']
const ADJ = ['Marketing', 'Operations']
const KWS = ['market research', 'trend analysis', 'competitive analysis', 'data collection', 'insight generation', 'ai research', 'business intelligence', 'social media analysis']
  .map((k) => new RegExp(k.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'), 'i'))
const kwHits = (p) => KWS.filter((re) => re.test(p.__t)).length
const coreRole = (p) => roles(p).some((r) => CORE.includes(r))
const adjRole = (p) => roles(p).some((r) => ADJ.includes(r))
const match = (p) => coreRole(p) || (adjRole(p) && kwHits(p) >= 1) || kwHits(p) >= 2
const y = (p) => p.yoe_months ?? 0
const gy = (p) => Number(p.graduation_year) || 0
const langSig = (p) => !!p.english_cert || !!p.korean_cert || /(korean|tiếng hàn|topik|한국어)/i.test(p.__t)
const aiRe = /(chatgpt|chat[- ]?gpt|midjourney|generative ai|\bgenai\b|prompt|notion ai|gemini|copilot)/i
const inHcmc = (p) => /(h[ồo]\s*ch[íi]\s*minh|hcm|sài gòn|sai gon|thủ đức|thu duc)/i.test(String(p.location || ''))
// 가점: 언어(JD 우대) > BA 코어 > AI 활용 시그널 > HCMC 거주(공고 표기 온사이트)
const score = (p) => (langSig(p) ? 2 : 0) + (coreRole(p) ? 2 : 1) + (aiRe.test(p.__t) ? 1 : 0) + (inHcmc(p) ? 1 : 0)

// 캐스케이드: 재학생 → 갓졸업 → 기타 신입. 경력 1y 초과는 수습 5M 인턴 미스매치라 제외.
const GROUPS = [
  {
    gkey: 'student', camp: 'amusing0911-recommend1-student',
    label: { vi: 'Thực tập sinh Nghiên cứu thị trường', ko: '시장조사 인턴(재학생)' },
    pick: (p) => (gy(p) >= 2026 && match(p) ? score(p) : null),
  },
  {
    gkey: 'grad', camp: 'amusing0911-recommend1-grad',
    label: { vi: 'Thực tập sinh Nghiên cứu thị trường', ko: '시장조사 인턴(갓졸업 신입)' },
    pick: (p) => (gy(p) >= 2024 && gy(p) <= 2025 && y(p) <= 12 && match(p) ? score(p) : null),
  },
  {
    gkey: 'fresh', camp: 'amusing0911-recommend1-fresh',
    label: { vi: 'Thực tập sinh Nghiên cứu thị trường', ko: '시장조사 인턴(기타 신입 ≤1y)' },
    pick: (p) => (y(p) <= 12 && match(p) ? score(p) : null),
  },
]

// ── 카피(vi 실발송) — 조건(수습 5M·영문 CV·신입 환영) 명시해 자기선별 유도 ──
const COMPANY = 'Amusing Lab'
const INITIAL = 'A'
const META_VI = 'Thực tập (Research) · TP.HCM · Thử việc 5.000.000 ₫/tháng'
const INTRO = '<b>Amusing Lab</b> — công ty Hàn Quốc — đang tuyển <b>Thực tập sinh Nghiên cứu thị trường Việt Nam (Research)</b> qua FYI. Công việc: phát hiện nhanh những xu hướng đang “hot” tại Việt Nam và phân tích nguyên nhân để biến thành insight cho kinh doanh; nghiên cứu doanh nghiệp, dịch vụ, xu hướng tiêu dùng; thu thập thông tin từ tin tức, mạng xã hội, cộng đồng; nghiên cứu đối thủ cạnh tranh; <b>sử dụng AI</b> để nghiên cứu hiệu quả hơn. <b>Không yêu cầu học vấn, kinh nghiệm, chuyên ngành</b> — sinh viên và bạn mới tốt nghiệp đều ứng tuyển được. Thử việc <b>5.000.000 VND/tháng</b>; ưu tiên biết tiếng Anh hoặc tiếng Hàn. <b>Nộp CV bằng tiếng Anh.</b>'
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
      .select('id,email,full_name,position,desired_roles,yoe_months,graduation_year,location,english_cert,korean_cert,is_resume_public,skills,resume_summary')
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
  let skipRec = 0, skipToday = 0
  for (const p of pool) {
    if (!p.email || /likelion/i.test(p.email)) continue
    const e = p.email.toLowerCase()
    if (seen.has(e) || unsubSet.has(p.id)) continue
    p.__t = txt(p)
    for (const g of GROUPS) {
      const s = g.pick(p)
      if (s == null) continue
      seen.add(e)
      if (appliedSet.has(p.id)) break
      if (recSet.has(p.id)) { skipRec++; break }
      if (todayUsers.has(p.id) || todayEmails.has(e)) { skipToday++; break }
      assigned.push({ p, s, g, frame: p.is_resume_public ? 'public' : 'private' })
      break
    }
  }

  console.log('발송 대상(1인 1통 배정):')
  for (const g of GROUPS) {
    const rows = assigned.filter((r) => r.g.gkey === g.gkey)
    const pub = rows.filter((x) => x.frame === 'public').length
    console.log(`  ${g.gkey} (${g.label.ko}): ${rows.length}명 (공개 ${pub} / 비공개 ${rows.length - pub})`)
  }
  console.log(`  ── 합계: ${assigned.length}명 (제외: 본 공고 기수신 ${skipRec} · 당일 발송 겹침 ${skipToday})`)
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
    const camp = `${g.camp}-${frame}`
    const u = url(p.id, camp), un = unsubFor(p.id, camp)
    const { error } = await resend.emails.send({
      from: RESEND_FROM, to: p.email, subject: SUBJECT[frame](g.label.vi),
      html: emailHtml(p.full_name, u, un, job, frame), text: emailText(p.full_name, u, un, job, frame),
      headers: { 'List-Unsubscribe': `<${un}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    })
    if (error) { console.error(`실패 ${p.email}:`, error.message || error); fail++; continue }
    await sb.from('job_recommendations').upsert([{
      user_id: p.id, to_email: p.email, job_id: JOB_ID,
      job_title: job.title, job_company: job.company, sent_by: 'coldmail', kind: 'recommend', status: 'sent',
    }], { onConflict: 'user_id,job_id', ignoreDuplicates: true })
    await sb.from('events').insert([{
      event: 'recommend_sent', page: '/scripts/amusing0911-recommend-coldmail',
      meta: { campaign: camp, job_ids: [JOB_ID], frame, group: g.gkey }, user_id: p.id,
    }])
    ok++
    if (ok % 25 === 0) console.log(`  …${ok}/${targets.length}`)
    await sleep(400)
  }
  console.log(`\n✅ 발송 완료: ${ok}/${targets.length} (실패 ${fail})`)
}

main().catch((e) => { console.error(e); process.exit(1) })
