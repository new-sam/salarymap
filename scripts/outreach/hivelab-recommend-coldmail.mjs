// KTC 9/8 HIVELAB 4공고 recommend — 하노이 온사이트(Taisei Square): BD Executive · 행정+Sale Support(TOPIK5+) ·
// Senior Graphic Designer(Aepick 뷰티) · Motion Designer(AE 필수).
// 9/8 풀 실측(코어만, 유저 지시): bd 12(Sales×HN×1y+×영/한) · admin 15(TOPIK5+×HN) ·
// gfx 42(Design×HN×3y+) · motion 24(Design×HN×AE시그널) — 합 93·유니크 81. 확장 풀은 발송 보류.
// 캐스케이드 = 희소 풀 우선(admin→bd→motion→gfx), 1인1통(당일 발송자 제외), 공개/비공개 프레임.
//
//   node scripts/outreach/hivelab-recommend-coldmail.mjs                          # dry-run
//   node scripts/outreach/hivelab-recommend-coldmail.mjs --send [--group bd] [--max N]
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
  HB1: 'c6d85fff-c88b-4fe1-8c29-7d3840e65bbf', // BD Executive (Sales 1-3y, 영/한)
  HB2: '93c379ea-aa6e-4de7-bc84-97af353ae24c', // 행정+Sale Support (TOPIK 5+)
  HB3: '27ff55d5-e7b4-4abc-bf48-b14f0950acb4', // Senior Graphic Designer (Aepick, 3-5y)
  HB4: '13574e6b-4b05-4536-b9df-9e2945f696af', // Motion Designer (AE 필수)
}

// ── 대상 선정(룰 기반, ktc0907 계열과 동일 헬퍼) ──
const hnBucket = (loc) => {
  const s = String(loc || '').toLowerCase().trim()
  if (!s) return 'B'
  return /(hà nội|ha noi|hanoi|\bhn\b)/.test(s) ? 'A' : 'X'
}
const inHN = (p) => ['A', 'B'].includes(hnBucket(p.location))
const hnA = (p) => (hnBucket(p.location) === 'A' ? 2 : 0)
const roles = (p) => new Set([p.position, ...(p.desired_roles || [])].filter(Boolean))
const hasAny = (p, arr) => [...roles(p)].some((r) => arr.includes(r))
const y = (p) => p.yoe_months ?? 0
const txt = (p) => (JSON.stringify(p.skills || '') + ' ' + String(p.position || '') + ' ' + String(p.resume_summary || '')).toLowerCase()

const SALES = ['Sales', 'Business Dev', 'Sales Director', 'Sales Engineer', 'Sales Admin', 'Sales & Business Development Assistant']
const topik5re = /(topik\s*(ii)?\s*[-–]?\s*(level|cấp|lv\.?)?\s*[56]|topik\s*[56]급|native)/i
const koSig = (p) => !!p.korean_cert || /(tiếng hàn|topik|korean|한국어)/i.test(txt(p))
const aeRe = /(after effects|aftereffects|\bmotion\b|animation|animator|premiere)/i
const salesAdmRe = /(sales support|sales admin|sale support|sales assistant|trợ lý kinh doanh|hỗ trợ kinh doanh|\bcrm\b|admin)/i
const beautyRe = /(mỹ phẩm|my pham|beauty|cosmetic|skincare|fashion|thời trang)/i
const threeDRe = /(cinema ?4d|blender|3ds ?max|\b3d\b)/i

// 캐스케이드 순서 = 배정 우선순위(희소 풀 순: TOPIK5+ → 하노이 Sales → AE시그널 → 3y+ 디자인), 1인 1그룹.
const GROUPS = [
  {
    // TOPIK 5+가 JD 하드컷(한국어 전공) — 희소해서 직군 무관. 세일즈어드민 경험 시그널 가점(코어 내 0명 실측).
    gkey: 'admin', jobKey: 'HB2', camp: 'hivelab-recommend1-admin',
    label: { vi: 'Nhân viên Hành chính kiêm Sale Support (tiếng Hàn)', ko: '행정+세일즈서포트(한국어)' },
    pick: (p) => (inHN(p) && topik5re.test(String(p.korean_cert || ''))
      ? hnA(p) + (salesAdmRe.test(txt(p)) || hasAny(p, SALES) ? 2 : 0) : null),
  },
  {
    // JD: BD/Sales/Marketing/Account 1~3y × 영어 or 한국어 유창. 1-3y 정합 가점(엄격 적용 시 3명뿐이라 1y+ 코어).
    gkey: 'bd', jobKey: 'HB1', camp: 'hivelab-recommend1-bd',
    label: { vi: 'Business Development Executive', ko: 'BD Executive' },
    pick: (p) => (hasAny(p, SALES) && inHN(p) && y(p) >= 12 && (p.english_cert || koSig(p))
      ? hnA(p) + (y(p) <= 36 ? 2 : 0) + (p.english_cert ? 1 : 0) + (koSig(p) ? 1 : 0) : null),
  },
  {
    // AE 필수 공고라 모션/AE 시그널 보유자만 코어. 3D 우대 가점.
    gkey: 'motion', jobKey: 'HB4', camp: 'hivelab-recommend1-motion',
    label: { vi: 'Motion Designer', ko: '모션 디자이너' },
    pick: (p) => (hasAny(p, ['Design']) && inHN(p) && aeRe.test(txt(p))
      ? hnA(p) + (threeDRe.test(txt(p)) ? 1 : 0) + (y(p) >= 12 ? 1 : 0) : null),
  },
  {
    // JD 3-5y 시니어 — 3y+ 하드컷, 3-5y 정합·뷰티/영상편집 가점(뷰티 시그널 0명 실측).
    gkey: 'gfx', jobKey: 'HB3', camp: 'hivelab-recommend1-gfx',
    label: { vi: 'Senior Graphic Designer', ko: '시니어 그래픽 디자이너' },
    pick: (p) => (hasAny(p, ['Design']) && inHN(p) && y(p) >= 36
      ? hnA(p) + (y(p) <= 60 ? 1 : 0) + (beautyRe.test(txt(p)) ? 1 : 0) + (aeRe.test(txt(p)) ? 1 : 0) : null),
  },
]

// ── 카피(vi 실발송) — ktc0907 정직 프레임(공개/비공개). HIVELAB 공통 인트로 + 그룹별 요건 한 줄. gfx만 Aepick 브랜드. ──
const HIVELAB_BASE = '<b>HIVELAB</b> — agency truyền thông số đa nền tảng của Hàn Quốc (thành lập 2012: UX/UI, game, web/mobile, branding &amp; marketing) — đang tuyển qua FYI, làm việc tại Hà Nội (tòa nhà Taisei Square, Khuất Duy Tiến). Đãi ngộ tương đương 14 tháng lương/năm.'
const GROUP_COPY = {
  bd: {
    company: 'HIVELAB', initial: 'H', meta: 'Onsite · Hà Nội · 1–3 năm',
    intro: `${HIVELAB_BASE} Vị trí <b>Business Development Executive</b>: phát triển kinh doanh ITO/SI, quản lý pipeline/CRM, phối hợp khách hàng B2B. Yêu cầu 1–3 năm kinh nghiệm BD/Sales/Marketing/Account và <b>thành thạo tiếng Anh hoặc tiếng Hàn</b>.`,
  },
  admin: {
    company: 'HIVELAB', initial: 'H', meta: 'Onsite · Hà Nội · TOPIK 5+',
    intro: `${HIVELAB_BASE} Vị trí <b>Nhân viên Hành chính kiêm Sale Support (tiếng Hàn)</b>: xử lý hợp đồng/chứng từ Hàn–Việt, quản lý pipeline khách hàng (CRM/Excel). Yêu cầu chuyên ngành tiếng Hàn, <b>TOPIK 5 trở lên</b>, thành thạo Excel; kinh nghiệm Sales Support/Sales Admin là lợi thế.`,
  },
  gfx: {
    company: 'HIVELAB', initial: 'H', meta: 'Onsite · Hà Nội · 3–5 năm',
    intro: `${HIVELAB_BASE} HIVELAB tuyển <b>Senior Graphic Designer</b> cho <b>Aepick</b> — thương hiệu mỹ phẩm: thiết kế E-commerce/Social, UI cơ bản, ấn phẩm in ấn/POSM. Yêu cầu 3–5 năm kinh nghiệm, thành thạo Photoshop/Illustrator/Figma, ưu tiên ngành mỹ phẩm/làm đẹp. Lưu ý: cần <b>portfolio đính kèm trong CV</b>.`,
  },
  motion: {
    company: 'HIVELAB', initial: 'H', meta: 'Onsite · Hà Nội',
    intro: `${HIVELAB_BASE} Vị trí <b>Motion Designer</b>: thiết kế video motion 2D &amp; 3D cho Game Ads/Gameplay và nội dung truyền thông. Yêu cầu <b>thành thạo After Effects</b>, dùng tốt Photoshop/Illustrator; kỹ năng 3D là lợi thế. Lưu ý: cần <b>CV kèm portfolio</b> (bắt buộc).`,
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

  const keys = [...new Set(assigned.map((r) => r.g.gkey))]
  console.log('발송 대상(1인 1통 배정):')
  for (const k of keys) {
    const rows = assigned.filter((r) => r.g.gkey === k)
    const pub = rows.filter((x) => x.frame === 'public').length
    console.log(`  hivelab-${k} [${rows[0].g.jobKey}] (${rows[0].g.label.ko}): ${rows.length}명 (공개 ${pub} / 비공개 ${rows.length - pub})`)
  }
  console.log(`  ── 합계: ${assigned.length}명`)
  if (!doSend) {
    for (const k of keys) {
      const rows = assigned.filter((r) => r.g.gkey === k).sort((a, b) => b.s - a.s)
      console.log(`\n── hivelab-${k} 상위 5 ──`)
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
    const brand = GROUP_COPY[g.gkey]
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
      event: 'recommend_sent', page: '/scripts/hivelab-recommend-coldmail',
      meta: { campaign: camp, job_ids: [job.id], frame, group: `hivelab-${g.gkey}` }, user_id: p.id,
    }])
    ok++
    if (ok % 25 === 0) console.log(`  …${ok}/${targets.length}`)
    await sleep(400)
  }
  console.log(`\n✅ 발송 완료: ${ok}/${targets.length} (실패 ${fail})`)
}

main().catch((e) => { console.error(e); process.exit(1) })
