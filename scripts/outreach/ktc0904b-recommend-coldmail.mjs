// KTC 라인 9/4 2차 등록 5공고 종합 추천 콜드메일 — s2e(파트너개발 CTV)·Komang(Python/RPA 개발)·
// QNT(다낭 통역비서·HR)·SKtax(HCMC 회계). ktc0904 패턴: 이력서 보유 풀 → 룰 캐스케이드(요건 좁은 순)
// → 1인1통 배정 → 공개/비공개 프레임. 당일(9/4) ktc0904 1차 778명 수신자는 todays 체크로 자동 제외.
// 산정 실측 9/4: 통역 7 · HR 1 · 회계 19 · 개발 193 · 세일즈 101 ≈ 321명(1차 수신자 제외 전).
// QNT 2건은 다낭 거주 제약으로 한 자릿수 — 풀 없음 실측 근거로 KTC 회신용.
//
//   node scripts/outreach/ktc0904b-recommend-coldmail.mjs                          # dry-run
//   node scripts/outreach/ktc0904b-recommend-coldmail.mjs --send [--group dev] [--max N]
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
  QI: 'daf3256a-c7a1-45ae-9407-c5ac217262ba', // QNT 통역·한국어 비서 (다낭)
  QH: 'e92c123a-fe38-4a2a-adf1-d7c77475c4a5', // QNT 인사 (다낭)
  SK: '3535bb5a-6a1f-4fc9-a66c-b7dc501ce039', // SKtax 회계 (HCMC An Phú, 13-15M, 1y+)
  KM: 'a2c89812-fec4-40fc-beb1-327925787ce9', // Komang E-commerce Automation Dev (HCM/ĐN/HN, 10-17M, 1y+)
  S2: '271c6595-052e-437d-ad4c-430bd0b50595', // s2e 파트너개발 협력자 (Remote CTV, 7-9M)
}

// ── 대상 선정(룰 기반, ktc0904와 동일 헬퍼) ──
const locBucket = (loc) => {
  const s = String(loc || '').toLowerCase()
  if (!s.trim()) return 'B'
  if (/(h[ồo]\s*ch[íi]\s*minh|hcm|sài gòn|sai gon|thủ đức|thu duc|bình dương|binh duong|biên hòa|bien hoa|đồng nai|dong nai)/.test(s)) return 'A'
  return 'X'
}
const inHcmc = (p) => ['A', 'B'].includes(locBucket(p.location))
const inHanoi = (p) => /(hà nội|ha noi|hanoi|\bhn\b)/i.test(String(p.location || ''))
const inDanang = (p) => /(đà nẵng|da nang|danang|quảng nam|quang nam)/i.test(String(p.location || ''))
const roles = (p) => new Set([p.position, ...(p.desired_roles || [])].filter(Boolean))
const hasAny = (p, arr) => [...roles(p)].some((r) => arr.includes(r))
const y = (p) => p.yoe_months ?? 0
const locA = (p) => (locBucket(p.location) === 'A' ? 2 : 0)

const SALES = ['Sales', 'Business Dev', 'Sales Director', 'Sales Engineer', 'Sales Admin', 'Sales & Business Development Assistant']
const DEV = ['Backend', 'Fullstack', 'Frontend', 'Data Engineer', 'AI/Data', 'ML Engineer', 'DevOps', 'QA Automation']
const FIN = ['Finance']
const HRR = ['HR']
const INTERP = ['Interpreter']
const pyRe = /(python|rpa|selenium|automation|crawl|scraping|django|flask|fastapi|pandas)/i
const pySkill = (p) => pyRe.test(JSON.stringify(p.skills || ''))

// 캐스케이드 순서 = 배정 우선순위(요건 좁은 순), 1인 1그룹.
const GROUPS = [
  {
    gkey: 'interp', brand: 'qnt', jobKey: 'QI',
    label: { vi: 'Phiên dịch – Thư ký tiếng Hàn', ko: '통역·한국어 비서' },
    pick: (p) => (inDanang(p) && (hasAny(p, INTERP) || p.korean_cert)
      ? (p.korean_cert ? 2 : 0) + (hasAny(p, INTERP) ? 1 : 0) : null),
  },
  {
    gkey: 'hr', brand: 'qnt', jobKey: 'QH',
    label: { vi: 'Nhân viên Nhân sự', ko: '인사 담당자' },
    pick: (p) => (inDanang(p) && hasAny(p, HRR) ? (y(p) >= 12 ? 1 : 0) : null),
  },
  {
    gkey: 'acct', brand: 'sktax', jobKey: 'SK',
    label: { vi: 'Kế toán dịch vụ', ko: '회계 담당자' },
    pick: (p) => (inHcmc(p) && hasAny(p, FIN) && y(p) >= 12 ? locA(p) + (y(p) >= 24 ? 1 : 0) : null),
  },
  {
    gkey: 'dev', brand: 'komang', jobKey: 'KM',
    label: { vi: 'E-commerce Automation Developer (Python/RPA)', ko: '이커머스 자동화 개발자' },
    pick: (p) => ((inHcmc(p) || inHanoi(p) || inDanang(p)) && hasAny(p, DEV) && pySkill(p) && y(p) >= 12
      ? (/(python)/i.test(JSON.stringify(p.skills || '')) ? 2 : 0) + (y(p) >= 24 ? 1 : 0) : null),
  },
  {
    gkey: 'partner', brand: 's2e', jobKey: 'S2',
    label: { vi: 'Cộng tác viên phát triển đối tác', ko: '파트너 개발 협력자' },
    pick: (p) => (hasAny(p, SALES) ? locA(p) + (y(p) >= 12 ? 1 : 0) : null), // Remote CTV — 지역 무관
  },
]
const campaignOf = (brand, gkey, frame) => `${brand}-recommend1-${gkey}-${frame}`

// ── 카피(vi 실발송) — ktc0904 정직 프레임(공개/비공개), 브랜드별 intro/meta만 갈림 ──
const BRANDS = {
  qnt: {
    company: 'QNT', initial: 'Q', meta: 'Onsite · Nhà máy, Đà Nẵng',
    intro: '<b>QNT</b> — doanh nghiệp sản xuất với Ban giám đốc người Hàn, đang trong giai đoạn chuẩn bị vận hành nhà máy tại Đà Nẵng — đang tuyển nhân sự văn phòng qua FYI, làm việc tại nhà máy (Phú Ninh, Đà Nẵng).',
  },
  sktax: {
    company: 'SKtax', initial: 'S', meta: 'Onsite · An Phú, TP.HCM · 13–15 triệu',
    intro: '<b>SKtax</b> — công ty dịch vụ kế toán – thuế — đang tuyển <b>Kế toán dịch vụ</b> qua FYI, làm việc tại An Phú, TP.HCM (Thứ 2 – Thứ 6, 8:00–17:00).',
  },
  komang: {
    company: 'Komang', initial: 'K', meta: 'TP.HCM / Đà Nẵng / Hà Nội · 10–17 triệu',
    intro: '<b>Komang</b> — công ty thương mại điện tử Hàn Quốc, nhập khẩu sản phẩm sourcing từ nước ngoài để bán trên Coupang và Naver — đang tuyển <b>E-commerce Automation Developer (Python / RPA)</b> qua FYI: tự động hóa đăng sản phẩm, nhập kho và quản lý tồn kho bằng Python và các công cụ AI.',
  },
  s2e: {
    company: 's2e', initial: 'S', meta: 'Remote · Freelance/CTV theo dự án POC · 7–9 triệu',
    intro: '<b>s2e</b> — công ty Hàn Quốc trong lĩnh vực thể thao – giáo dục, đang mở rộng thí điểm (POC) ra thị trường Việt Nam — đang tuyển <b>Cộng tác viên phát triển đối tác</b> qua FYI: tìm kiếm và kết nối các học viện thể thao, trung tâm đào tạo hoặc trường học tại địa phương. Làm việc từ xa, hình thức cộng tác viên theo dự án.',
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
  for (const id of Object.values(JOBS)) {
    if (!jobById[id] || !jobById[id].is_active) { console.error(`공고 없음/비활성: ${id}`); process.exit(1) }
  }
  const resend = new Resend(env.RESEND_API_KEY)
  const url = (userId, camp, jobId) => `${SITE}/api/resume/recommend?t=${makeToken(userId, camp)}&j=${jobId}`
  const unsubFor = (userId, camp) => `${SITE}/api/coldmail/unsub?t=${makeToken(userId, camp)}`

  const [pool, unsubs, recs, apps, todays] = await Promise.all([
    fetchAll(() => sb.from('user_profiles')
      .select('id,email,full_name,position,desired_roles,yoe_months,location,english_cert,korean_cert,is_resume_public,skills')
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

  // 배정: GROUPS 순서 = 우선순위, 1인 1그룹.
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
      assigned.push({ p, s, brand: g.brand, gkey: g.gkey, jobKey: g.jobKey, label: g.label, frame: p.is_resume_public ? 'public' : 'private' })
      seen.add(e)
      break
    }
  }

  const keys = [...new Set(assigned.map((r) => `${r.brand}-${r.gkey}`))]
  console.log('발송 대상(1인 1통 배정):')
  for (const k of keys) {
    const rows = assigned.filter((r) => `${r.brand}-${r.gkey}` === k)
    const pub = rows.filter((x) => x.frame === 'public').length
    console.log(`  ${k} [${rows[0].jobKey}] (${rows[0].label.ko}): ${rows.length}명 (공개 ${pub} / 비공개 ${rows.length - pub})`)
  }
  console.log(`  ── 합계: ${assigned.length}명`)
  if (!doSend) {
    for (const k of keys) {
      const rows = assigned.filter((r) => `${r.brand}-${r.gkey}` === k).sort((a, b) => b.s - a.s)
      console.log(`\n── ${k} 상위 5 ──`)
      for (const { p, s, frame } of rows.slice(0, 5))
        console.log(`  [${s}·${frame}] ${p.full_name} <${p.email}> · ${p.position || '?'} · ${Math.round((p.yoe_months || 0) / 12 * 10) / 10}y · ${p.location || '위치?'}`)
    }
    console.log('\n(dry-run — 실발송하려면 --send, 그룹 한정 --group <gkey>)')
    return
  }

  let targets = assigned
  if (onlyGroup) targets = targets.filter((r) => r.gkey === onlyGroup)
  if (maxN) targets = targets.slice(0, maxN)
  let ok = 0, fail = 0
  for (const { p, frame, brand: bk, gkey, jobKey, label } of targets) {
    const brand = BRANDS[bk]
    const job = jobById[JOBS[jobKey]]
    const camp = campaignOf(bk, gkey, frame)
    const u = url(p.id, camp, job.id), un = unsubFor(p.id, camp)
    const { error } = await resend.emails.send({
      from: RESEND_FROM, to: p.email, subject: SUBJECT[frame](brand.company, label.vi),
      html: emailHtml(p.full_name, u, un, brand, job, frame), text: emailText(p.full_name, u, un, brand, job, frame),
      headers: { 'List-Unsubscribe': `<${un}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    })
    if (error) { console.error(`실패 ${p.email}:`, error.message || error); fail++; continue }
    await sb.from('job_recommendations').upsert([{
      user_id: p.id, to_email: p.email, job_id: job.id,
      job_title: job.title, job_company: job.company, sent_by: 'coldmail', kind: 'recommend', status: 'sent',
    }], { onConflict: 'user_id,job_id', ignoreDuplicates: true })
    await sb.from('events').insert([{
      event: 'recommend_sent', page: '/scripts/ktc0904b-recommend-coldmail',
      meta: { campaign: camp, job_ids: [job.id], frame, group: `${bk}-${gkey}` }, user_id: p.id,
    }])
    ok++
    if (ok % 25 === 0) console.log(`  …${ok}/${targets.length}`)
    await sleep(400)
  }
  console.log(`\n✅ 발송 완료: ${ok}/${targets.length} (실패 ${fail})`)
}

main().catch((e) => { console.error(e); process.exit(1) })
