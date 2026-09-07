// KTC 9/7 신규 3사 recommend — 로보윙크(AI비전, 다낭)·유피드(선박 네트워크보안, 한국 직접채용)·언틸/배너팅(마케팅 인턴, 한·영·베 필수).
// 9/7 풀 실측(이력서 보유·unsub 제외): AI/ML 코어 85 + Data×Py 26 + 타직군 비전스킬 58 ≈ 최대 169 ·
// 넷섹 3y+ 12(코어 5 + 인접스킬 7) · 마케팅 한+영 Design/Marketing 35(하노이 13 최다).
// 유피드는 12명뿐이라 캠페인 최소규모 경계 — 유저 지시로 발송(한국어 인증 0명 실측, 우대 표기 정합).
// ktc0907 패턴: 룰 캐스케이드(요건 좁은 순) → 1인1통(당일 발송자 제외) → 공개/비공개 프레임.
//
//   node scripts/outreach/ktc0907b-recommend-coldmail.mjs                          # dry-run
//   node scripts/outreach/ktc0907b-recommend-coldmail.mjs --send [--group aiml] [--max N]
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
  UF1: '81cb15db-0d44-4ce5-a99f-d1b366add720', // Ufeed Network & Security Engineer (한국 직접채용)
  RW1: 'df5b8a80-a2f9-4bc0-a568-32be22878161', // Robowink AI/ML Engineer (다낭)
  BT1: '15bcad26-e30c-4ec8-89ed-72208972ee2a', // Bannerting Marketing Intern (HN/HCM/DN)
}

// ── 대상 선정(룰 기반, ktc0907 계열과 동일 헬퍼) ──
const roles = (p) => new Set([p.position, ...(p.desired_roles || [])].filter(Boolean))
const hasAny = (p, arr) => [...roles(p)].some((r) => arr.includes(r))
const y = (p) => p.yoe_months ?? 0
const txt = (p) => (JSON.stringify(p.skills || '') + ' ' + String(p.position || '') + ' ' + String(p.resume_summary || '')).toLowerCase()
const inHanoi = (p) => /(hà nội|ha noi|hanoi|\bhn\b)/i.test(String(p.location || ''))
const inDanang = (p) => /(đà nẵng|da nang|danang)/i.test(String(p.location || ''))

const AI_CORE = ['AI Engineer', 'ML Engineer', 'Data Scientist']
const DATA_EXT = ['Data Engineer', 'Data Analyst', 'Data']
const visionRe = /(computer vision|opencv|yolo|\bcnn\b|image processing|xử lý ảnh|thị giác máy|object detection|segmentation|pytorch|tensorflow|keras|deep learning)/i
const pyRe = /python/i
const NETSEC = ['Network', 'Security Engineer', 'Security Analyst', 'Penetration Tester']
const NETADJ = ['SysAdmin', 'DevOps', 'SRE', 'Cloud']
const netsecRe = /(ccna|ccnp|ccie|firewall|fortinet|palo alto|pfsense|vlan|tcp\/ip|tcpip|\brouting\b|ospf|\bbgp\b|mikrotik|cisco|network security|an ninh mạng|quản trị mạng|cissp|oscp|iec 62443|penetration|pentest|siem|wireshark)/i
const MKT = ['Design', 'Marketing', 'UX Researcher']
const koSignal = (p) => !!p.korean_cert || /(korean|tiếng hàn|topik|한국어)/i.test(txt(p))
const DEV = ['Backend', 'Frontend', 'Fullstack', 'Mobile', 'Web', 'Embedded', 'Game', 'DevOps', 'QA', 'QA Automation', 'AI/Data']
const aiWeakRe = /(machine learning|deep learning|data science|scikit|sklearn|kaggle|pandas|numpy|\bnlp\b|\bllm\b)/i

// 캐스케이드 순서 = 배정 우선순위(요건 좁은 순), 1인 1그룹.
const GROUPS = [
  {
    // JD 지원자격 3y+ 준수: 코어 직군 or 인접 직군×넷섹 스킬. 한국어 우대(가점만, 인증 보유 0명 실측).
    gkey: 'netsec', brand: 'ufeed', jobKey: 'UF1', camp: 'ufeed-recommend1-netsec',
    label: { vi: 'Network & Security Engineer', ko: '네트워크·보안 엔지니어' },
    pick: (p) => ((hasAny(p, NETSEC) || (hasAny(p, NETADJ) && netsecRe.test(txt(p)))) && y(p) >= 36
      ? (hasAny(p, NETSEC) ? 2 : 0) + (p.english_cert ? 1 : 0) + (p.korean_cert ? 2 : 0) : null),
  },
  {
    // 한·영 필수(베트남어는 현지 풀 전원 충족) × Design/Marketing. 인턴 레벨이라 저연차 가점, 하노이 선호 가점.
    gkey: 'mkt', brand: 'bannerting', jobKey: 'BT1', camp: 'bannerting-recommend1-mkt',
    label: { vi: 'Thực tập sinh Marketing', ko: '마케팅 인턴' },
    pick: (p) => (koSignal(p) && p.english_cert && hasAny(p, MKT)
      ? (inHanoi(p) ? 2 : 0) + (y(p) <= 36 ? 1 : 0) : null),
  },
  {
    // AI/ML/DS 코어 → Data직군×Python → 타직군 비전+Python 순 스코어. 지역 무관(공고는 다낭, 가점만).
    gkey: 'aiml', brand: 'robowink', jobKey: 'RW1', camp: 'robowink-recommend1-aiml',
    label: { vi: 'AI/ML Engineer', ko: 'AI·ML 엔지니어' },
    pick: (p) => {
      const vision = visionRe.test(txt(p)), py = pyRe.test(txt(p))
      if (hasAny(p, AI_CORE)) return 3 + (vision ? 1 : 0) + (inDanang(p) ? 2 : 0)
      if (hasAny(p, DATA_EXT) && py) return 1 + (vision ? 1 : 0) + (inDanang(p) ? 2 : 0)
      if (vision && py) return (inDanang(p) ? 2 : 0)
      return null
    },
  },
  // ── 2차 확장(9/7 당일 저녁, 신규 수신자 recommend2 — 유저 지시): 1차 지원 반응 확인 후 잔여 풀 확장 ──
  {
    // 로보윙크 룰 완화: 1차 미해당 개발직군 × Python × AI 약신호(ML/pandas 등) — 9/7 실측 13명.
    // Python만 걸면 317명이지만 JD 자격(AI·비전 기초) 미달 살포라 제외.
    gkey: 'aiml2', brand: 'robowink', jobKey: 'RW1', camp: 'robowink-recommend2-aiml',
    label: { vi: 'AI/ML Engineer', ko: 'AI·ML 엔지니어(확장)' },
    pick: (p) => {
      const t = txt(p)
      const orig = hasAny(p, AI_CORE) || (hasAny(p, DATA_EXT) && pyRe.test(t)) || (visionRe.test(t) && pyRe.test(t))
      if (orig) return null // 1차 룰 해당자는 recommend1 소관
      return hasAny(p, DEV) && pyRe.test(t) && aiWeakRe.test(t) ? (inDanang(p) ? 2 : 0) : null
    },
  },
  {
    // 배너팅 확장: 직군 무관 한+영(1차의 Design/Marketing 제외 잔여) — 9/7 실측 65명.
    gkey: 'mkt2', brand: 'bannerting', jobKey: 'BT1', camp: 'bannerting-recommend2-mkt',
    label: { vi: 'Thực tập sinh Marketing', ko: '마케팅 인턴(확장)' },
    pick: (p) => (koSignal(p) && p.english_cert && !hasAny(p, MKT)
      ? (inHanoi(p) ? 2 : 0) + (y(p) <= 36 ? 1 : 0) : null),
  },
]

// ── 카피(vi 실발송) — ktc0907 정직 프레임(공개/비공개), 브랜드별 intro/meta만 갈림 ──
const BRANDS = {
  ufeed: {
    company: 'Ufeed', initial: 'U', meta: 'Làm việc tại Hàn Quốc · Hỗ trợ visa & chỗ ở',
    intro: '<b>Ufeed</b> — công ty Hàn Quốc trong lĩnh vực an ninh mạng cho tàu biển (chứng nhận IACS UR E26) — đang tuyển <b>Network &amp; Security Engineer</b> (kinh nghiệm mạng/bảo mật 3 năm trở lên) làm việc trực tiếp tại <b>Hàn Quốc</b> qua FYI: lương theo mặt bằng Hàn Quốc, hỗ trợ visa và chỗ ở. Công việc: thiết kế mạng OT/IT và hệ thống địa chỉ IP trên tàu, định tuyến L3, chính sách firewall theo Zone/Conduit, đối ứng chứng nhận đăng kiểm (DNV, ABS, KR). Tiếng Hàn/tiếng Anh là lợi thế, không bắt buộc.',
  },
  robowink: {
    company: 'Robowink', initial: 'R', meta: 'Onsite · Đà Nẵng',
    intro: '<b>Robowink</b> — công ty Hàn Quốc phát triển giải pháp AI vision cho drone &amp; robot — đang tuyển <b>AI/ML Engineer</b> qua FYI, làm việc tại Đà Nẵng. Công việc: phát triển SW AI vision từ dữ liệu hình ảnh/cảm biến, thuật toán phát hiện chướng ngại vật và đánh giá mức độ nguy hiểm, phân tích dữ liệu thử nghiệm drone/robot. Cần nền tảng Python và hiểu biết cơ bản về AI/computer vision; tiếng Anh là lợi thế, không bắt buộc. Công ty mong muốn tuyển <b>càng sớm càng tốt</b>.',
  },
  bannerting: {
    company: 'Bannerting', initial: 'B', meta: 'Hà Nội / TP.HCM / Đà Nẵng · Thực tập sinh',
    intro: '<b>Bannerting</b> — dịch vụ quảng cáo băng rôn/biển hiệu của công ty Hàn Quốc — đang tuyển <b>Thực tập sinh Marketing</b> qua FYI (ưu tiên Hà Nội, chấp nhận TP.HCM/Đà Nẵng). Công việc: vận hành dịch vụ banner, dịch và kiểm tra nội dung (Anh–Việt), đăng ký online, quản lý báo cáo, khảo sát thị trường quảng cáo ngoài trời tại Việt Nam. Yêu cầu sử dụng được <b>tiếng Hàn, tiếng Anh và tiếng Việt</b>.',
  },
}
const SUBJECT = {
  public: (co, role) => `[FYI] Bạn được chọn vào danh sách đề cử gửi ${co} — ${role}`,
  private: (co, role) => `[FYI] Bạn được chọn vào danh sách đề cử — ${role} tại ${co}`,
}
const HOOK = 'Đội ngũ FYI đã xem xét toàn bộ hồ sơ đã đăng ký và <b>chọn bạn vào danh sách đề cử</b> cho vị trí dưới đây — hồ sơ của bạn phù hợp nhất với yêu cầu của vị trí này.'
const BENEFIT = {
  public: (co) => `<b>Trong tuần này</b>, FYI sẽ gửi danh sách đề cử trực tiếp cho người phụ trách tuyển dụng của ${co}. Hồ sơ của bạn đang ở chế độ công khai nên sẽ được gửi kèm danh sách. Nếu bạn ứng tuyển ngay, CV của bạn sẽ được <b>ưu tiên xem xét</b> cùng lời giới thiệu từ FYI.`,
  private: (co) => `<b>Trong tuần này</b>, FYI sẽ gửi danh sách đề cử trực tiếp cho người phụ trách tuyển dụng của ${co}. Hồ sơ của bạn đang ở chế độ riêng tư — nếu bạn ứng tuyển ngay, CV của bạn sẽ được gửi kèm lời giới thiệu từ FYI và được <b>ưu tiên xem xét</b>.`,
}
const ONETAP = 'Chỉ cần <b>1 chạm</b> — CV đã đăng ký của bạn sẽ được gửi tự động.'

function jobCard(brand, job) {
  const logo = job.logo_url
    ? `<img src="${esc(job.logo_url)}" width="44" height="44" alt="" style="width:44px;height:44px;border-radius:10px;object-fit:cover;background:#f0ebe3;display:block">`
    : `<div style="width:44px;height:44px;border-radius:10px;background:#fff0e6;color:#ff6000;font-weight:800;font-size:16px;text-align:center;line-height:44px">${brand.initial}</div>`
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #eee5da;border-radius:14px;margin-bottom:8px"><tr>
    <td width="44" style="padding:14px 0 14px 14px;vertical-align:middle">${logo}</td>
    <td style="padding:14px 14px 14px 12px;vertical-align:middle">
      <div style="font-size:12px;color:#8a8073;margin-bottom:3px">${esc(brand.company)}</div>
      <div style="font-size:14.5px;font-weight:700;color:#1a1612;line-height:1.35">${esc(job.title.trim())}</div>
      <div style="font-size:12px;color:#b0691a;margin-top:3px">${esc(brand.meta)}</div>
    </td>
  </tr></table>`
}

function emailHtml(name, url, unsubUrl, brand, job, frame) {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1612">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f7"><tr><td align="center" style="padding:28px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
  <tr><td style="padding-bottom:18px"><img src="https://salary-fyi.com/fyi-logo.png" height="24" alt="FYI" style="height:24px;width:auto;display:block"></td></tr>
  <tr><td style="font-size:15px;line-height:1.6;color:#1a1612;padding-bottom:6px">Chào ${esc(firstName(name))},</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:14px">${brand.intro}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:14px">${HOOK}</td></tr>
  <tr><td style="padding-bottom:10px">${jobCard(brand, job)}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-top:4px">${BENEFIT[frame](brand.company)} ${ONETAP}</td></tr>
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

function emailText(name, url, unsubUrl, brand, job, frame) {
  return `Chào ${firstName(name)},

${strip(brand.intro)}

${strip(HOOK)}

- ${job.title.trim()} (${brand.company}) — ${brand.meta} — ${SITE}/ktc/jobs/${job.id}

${strip(BENEFIT[frame](brand.company))} ${strip(ONETAP)}

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
      .select('id,email,full_name,position,desired_roles,yoe_months,location,english_cert,korean_cert,is_resume_public,skills,resume_summary')
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
  const recdOrApplied = (jobKey, uid) =>
    (recUserByJob[JOBS[jobKey]] || new Set()).has(uid) || (appliedByJob[JOBS[jobKey]] || new Set()).has(uid)

  // 배정: GROUPS 순서 = 우선순위, 1인 1그룹. 이메일 중복 프로필은 최신 1건만.
  const seen = new Set()
  const assigned = []
  for (const p of pool) {
    if (!p.email || /likelion/i.test(p.email)) continue
    const e = p.email.toLowerCase()
    if (seen.has(e) || unsubSet.has(p.id)) continue
    if (todayUsers.has(p.id) || todayEmails.has(e)) continue
    for (const g of GROUPS) {
      const s = g.pick(p)
      if (s == null) continue
      if (recdOrApplied(g.jobKey, p.id)) continue
      assigned.push({ p, s, g, frame: p.is_resume_public ? 'public' : 'private' })
      seen.add(e)
      break
    }
  }

  const keys = [...new Set(assigned.map((r) => `${r.g.brand}-${r.g.gkey}`))]
  console.log('발송 대상(1인 1통 배정):')
  for (const k of keys) {
    const rows = assigned.filter((r) => `${r.g.brand}-${r.g.gkey}` === k)
    const pub = rows.filter((x) => x.frame === 'public').length
    console.log(`  ${k} [${rows[0].g.jobKey}] (${rows[0].g.label.ko}): ${rows.length}명 (공개 ${pub} / 비공개 ${rows.length - pub})`)
  }
  console.log(`  ── 합계: ${assigned.length}명`)
  if (!doSend) {
    for (const k of keys) {
      const rows = assigned.filter((r) => `${r.g.brand}-${r.g.gkey}` === k).sort((a, b) => b.s - a.s)
      console.log(`\n── ${k} 상위 5 ──`)
      for (const { p, s, frame } of rows.slice(0, 5))
        console.log(`  [${s}·${frame}] ${p.full_name} <${p.email}> · ${p.position || '?'} · ${Math.round((p.yoe_months || 0) / 12 * 10) / 10}y · ${p.location || '위치?'}`)
    }
    console.log('\n(dry-run — 실발송하려면 --send, 그룹 한정 --group <gkey>)')
    return
  }

  let targets = assigned
  if (onlyGroup) targets = targets.filter((r) => r.g.gkey === onlyGroup)
  if (maxN) targets = targets.slice(0, maxN)
  let ok = 0, fail = 0
  for (const { p, g, frame } of targets) {
    const brand = BRANDS[g.copyKey || g.brand]
    const job = jobById[JOBS[g.jobKey]]
    const camp = `${g.camp}-${frame}`
    const u = url(p.id, camp, job.id), un = unsubFor(p.id, camp)
    const { error } = await resend.emails.send({
      from: RESEND_FROM, to: p.email, subject: SUBJECT[frame](brand.company, g.label.vi),
      html: emailHtml(p.full_name, u, un, brand, job, frame), text: emailText(p.full_name, u, un, brand, job, frame),
      headers: { 'List-Unsubscribe': `<${un}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    })
    if (error) { console.error(`실패 ${p.email}:`, error.message || error); fail++; continue }
    await sb.from('job_recommendations').upsert([{
      user_id: p.id, to_email: p.email, job_id: job.id,
      job_title: job.title, job_company: job.company, sent_by: 'coldmail', kind: 'recommend', status: 'sent',
    }], { onConflict: 'user_id,job_id', ignoreDuplicates: true })
    await sb.from('events').insert([{
      event: 'recommend_sent', page: '/scripts/ktc0907b-recommend-coldmail',
      meta: { campaign: camp, job_ids: [job.id], frame, group: `${g.brand}-${g.gkey}` }, user_id: p.id,
    }])
    ok++
    if (ok % 25 === 0) console.log(`  …${ok}/${targets.length}`)
    await sleep(400)
  }
  console.log(`\n✅ 발송 완료: ${ok}/${targets.length} (실패 ${fail})`)
}

main().catch((e) => { console.error(e); process.exit(1) })
