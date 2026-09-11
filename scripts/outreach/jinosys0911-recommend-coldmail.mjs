// Jinosys(R191) AI모바일/웹+IoT·로봇 인턴 recommend — 9/11 Mia FYI 등록 당일 발송(ASAP).
// 호현 지시: 다낭 지역 수습생(인턴) 한정, VKU면 좋지만 필수 아님. 수습 30만원/인턴 79만원(게재 지원금 3M VND/월).
// JD 자격: PHP, HTML5, CSS3, JavaScript, Android(Java/Kotlin). 우대: ROS·로봇/임베디드·RTSP/WebRTC·영어. 영문 CV.
// 9/11 풀 실측: 다낭 거주 × 인턴 적합(경력 1y 초과 컷 — 30만원 수습 미스매치) × 매치 = ~39명 (전국 확장은 ~400이나 지역 게이트가 지배).
//   매치는 풀봇 룰: 코어 직군(AI Engineer/Mobile/Web) | 인접(Embedded/Backend)×키워드 1+ | 키워드 2+.
// 우대(영어·VKU·로봇 시그널)는 하드컷 없이 가점만. 1인1통(당일 recommend 기수신 제외 — 코스모스 겹침 1명) · 공개/비공개 프레임.
//
//   node scripts/outreach/jinosys0911-recommend-coldmail.mjs                       # dry-run
//   node scripts/outreach/jinosys0911-recommend-coldmail.mjs --send [--group student] [--max N] [--gap-hours N]
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

const JOB_ID = '7ed417d4-8300-4814-a6bf-98cfa47091d8' // Jinosys AI·IoT·Robotics Intern (R191, 다낭)

// ── 대상 선정 — 풀봇(lib/poolEstimator.js) 동일 텍스트·매칭 + 다낭·인턴 게이트 ──
const txt = (p) => (JSON.stringify(p.skills || '') + ' ' + String(p.position || '') + ' ' + String(p.resume_summary || '')).toLowerCase()
const roles = (p) => [p.position, ...(p.desired_roles || [])].filter(Boolean)
const CORE = ['AI Engineer', 'Mobile', 'Web', 'AI/Data']
const ADJ = ['Embedded', 'Backend']
const KWS = ['php', 'html5', 'css3', 'android', 'kotlin', 'rtsp', 'webrtc'].map((k) => new RegExp(k, 'i'))
const kwHits = (p) => KWS.filter((re) => re.test(p.__t)).length
const hasAny = (p, arr) => roles(p).some((r) => arr.includes(r))
const match = (p) => hasAny(p, CORE) || (hasAny(p, ADJ) && kwHits(p) >= 1) || kwHits(p) >= 2
const inDanang = (p) => /(đà nẵng|da ?nang|danang)/i.test(String(p.location || ''))
const y = (p) => p.yoe_months ?? 0
const gy = (p) => Number(p.graduation_year) || 0
const vku = (p) => /vku|vietnam.?[\s–-]*korea|việt.?[\s–-]*hàn/i.test(String(p.university || '') + ' ' + String(p.email || ''))
const robotSig = (p) => /(\bros\b|robot|iot|embedded|opencv|yolo|firmware|arduino|raspberry)/i.test(p.__t)
// 가점: JD 스택 커버리지 > VKU(원요청) > 로봇/IoT 우대 시그널 > 영어(우대)
const score = (p) => kwHits(p) + (vku(p) ? 2 : 0) + (robotSig(p) ? 1 : 0) + (p.english_cert ? 1 : 0)

// 캐스케이드: 재학생 → 갓졸업 → 기타 신입(≤1y). 전 그룹 다낭 거주 필수.
const GROUPS = [
  {
    gkey: 'student', camp: 'jinosys0911-recommend1-student',
    label: { vi: 'Thực tập sinh AI·IoT·Robot', ko: 'AI·IoT·로봇 인턴(재학생)' },
    pick: (p) => (inDanang(p) && gy(p) >= 2026 && match(p) ? score(p) : null),
  },
  {
    gkey: 'grad', camp: 'jinosys0911-recommend1-grad',
    label: { vi: 'Thực tập sinh AI·IoT·Robot', ko: 'AI·IoT·로봇 인턴(갓졸업 신입)' },
    pick: (p) => (inDanang(p) && gy(p) >= 2024 && gy(p) <= 2025 && y(p) <= 12 && match(p) ? score(p) : null),
  },
  {
    gkey: 'fresh', camp: 'jinosys0911-recommend1-fresh',
    label: { vi: 'Thực tập sinh AI·IoT·Robot', ko: 'AI·IoT·로봇 인턴(기타 신입 ≤1y)' },
    pick: (p) => (inDanang(p) && y(p) <= 12 && match(p) ? score(p) : null),
  },
]

// ── 카피(vi 실발송) — 조건(다낭 온사이트·지원금 3M·영문 CV·스택) 명시해 자기선별 유도 ──
const COMPANY = 'Jinosys'
const INITIAL = 'J'
const META_VI = 'Thực tập · Onsite Đà Nẵng · Trợ cấp 3.000.000 ₫/tháng'
const INTRO = '<b>Jinosys</b> — công ty Hàn Quốc phát triển công nghệ phát hiện cháy bằng <b>AI on-device</b> kết hợp <b>IoT &amp; robot</b> (Physical AI) — đang tuyển <b>Thực tập sinh phát triển Mobile/Web AI &amp; tích hợp IoT·Robot</b> (03 người) tại <b>Đà Nẵng</b> qua FYI. Công việc: phát triển chức năng kết nối &amp; điều khiển robot/thiết bị di động, kết nối AI phát hiện cháy qua camera với hệ thống robot, API điều khiển tích hợp cảm biến IoT, streaming video thời gian thực, hỗ trợ huấn luyện mô hình AI. Stack: <b>PHP, HTML5/CSS3, JavaScript, Android (Java/Kotlin)</b>; ưu tiên ROS, embedded, RTSP/WebRTC, tiếng Anh. Trợ cấp <b>3.000.000 VND/tháng</b>; dự án từ 1 năm trở lên, có thể gia hạn hoặc tuyển dụng chính thức sau. <b>Nộp CV bằng tiếng Anh.</b>'
const SUBJECT = {
  public: (role) => `[FYI] Bạn được chọn vào danh sách đề cử gửi ${COMPANY} — ${role} (Đà Nẵng)`,
  private: (role) => `[FYI] Bạn được chọn vào danh sách đề cử — ${role} tại ${COMPANY} (Đà Nẵng)`,
}
const HOOK = 'Đội ngũ FYI đã xem xét toàn bộ hồ sơ đã đăng ký và <b>chọn bạn vào danh sách đề cử</b> cho vị trí dưới đây — hồ sơ của bạn (đang ở Đà Nẵng, nền tảng phát triển phù hợp) khớp với yêu cầu của vị trí này.'
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
      .select('id,email,full_name,position,desired_roles,yoe_months,graduation_year,location,english_cert,korean_cert,is_resume_public,skills,resume_summary,university')
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
        console.log(`  [${s}·${frame}] ${p.full_name} <${p.email}> · ${p.position || '?'} · 졸업 ${p.graduation_year || '?'} · ${Math.round((p.yoe_months || 0) / 12 * 10) / 10}y · ${String(p.university || '').slice(0, 35)}`)
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
      event: 'recommend_sent', page: '/scripts/jinosys0911-recommend-coldmail',
      meta: { campaign: camp, job_ids: [JOB_ID], frame, group: g.gkey }, user_id: p.id,
    }])
    ok++
    if (ok % 25 === 0) console.log(`  …${ok}/${targets.length}`)
    await sleep(400)
  }
  console.log(`\n✅ 발송 완료: ${ok}/${targets.length} (실패 ${fail})`)
}

main().catch((e) => { console.error(e); process.exit(1) })
