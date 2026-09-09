// KTC 9/9 Motive Pictures recommend — Project Manager (한·베 합작 영화 제작 프로젝트, HCM/HN, Junior 15–17tr).
// JD: 영화 프로젝트 관리(한·베 제작진/파트너/스폰서 조율)·영화 마케팅·스폰서십/B2B 파트너십.
// 요건: 영어 필수(한국어 우대)·기업 마케팅 경험. 9/9 풀봇 실측: 코어(PM) 20 · 확장(+Marketing/BD·스킬) 62.
// vnib 패턴: 룰 캐스케이드 → 1인1통(당일 발송자 제외) → 공개/비공개 프레임. 유저 지시 "확장해서 보내".
//
//   node scripts/outreach/motive-recommend-coldmail.mjs                          # dry-run
//   node scripts/outreach/motive-recommend-coldmail.mjs --send [--group pm] [--max N]
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
  MO1: '3374ec2b-711c-4fc3-916b-6e607fd9a64a', // Motive Pictures Project Manager (source_id 미기입 — 원장 코드 백필 대기)
}

// ── 대상 선정 ── 근무지 HCM/하노이 양쪽이라 두 권역 다 허용(미기재 포함).
const locBucket = (loc) => {
  const s = String(loc || '').toLowerCase()
  if (!s.trim()) return 'B'
  if (/(h[ồo]\s*ch[íi]\s*minh|hcm|sài gòn|sai gon|thủ đức|thu duc|bình dương|binh duong|biên hòa|bien hoa|đồng nai|dong nai)/.test(s)) return 'A'
  if (/(hà nội|ha noi|hanoi)/.test(s)) return 'H'
  return 'X'
}
const inLoc = (p) => ['A', 'H', 'B'].includes(locBucket(p.location))
const roles = (p) => new Set([p.position, ...(p.desired_roles || [])].filter(Boolean))
const hasAny = (p, arr) => [...roles(p)].some((r) => arr.includes(r))
const txt = (p) => (JSON.stringify(p.skills || '') + ' ' + String(p.position || '') + ' ' + String(p.resume_summary || '')).toLowerCase()
const enOk = (p) => !!p.english_cert || /(ielts|toeic|toefl)/i.test(txt(p))

// 영화·미디어/스폰서십 실경험 시그널 — 확장 그룹 스킬 매치 + 코어 정렬 점수에 사용
const filmRe = /(film|phim|điện ảnh|dien anh|movie|cinema|media production|video production|entertainment|content production|sản xuất nội dung|san xuat noi dung)/i
const bizRe = /(sponsor|tài trợ|tai tro|b2b|partnership|đối tác|doi tac|stakeholder)/i
const DEVISH = ['Backend', 'Frontend', 'Fullstack', 'Mobile', 'Web', 'Embedded', 'Game', 'DevOps', 'QA', 'QA Automation',
  'AI Engineer', 'ML Engineer', 'Data Scientist', 'Data Engineer', 'SysAdmin', 'SRE', 'Cloud', 'Security Engineer']

// 캐스케이드 = 배정 우선순위, 1인 1그룹. 공통 하드컷: HCM/HN(미기재 허용)·영어(JD 필수). Junior 공고라 경력 하한 없음.
const score = (p) => (filmRe.test(txt(p)) ? 2 : 0) + (bizRe.test(txt(p)) ? 1 : 0) + (/(marketing)/i.test(txt(p)) ? 1 : 0)
const GROUPS = [
  {
    gkey: 'pm', brand: 'motive', jobKey: 'MO1', camp: 'motive-recommend1-pm',
    label: { vi: 'Project Manager', ko: 'PM(코어)' },
    pick: (p) => (hasAny(p, ['PM']) && inLoc(p) && enOk(p) ? score(p) : null),
  },
  {
    // 확장: 마케팅·사업개발 직군(JD 요건이 '기업 마케팅 경험'이라 실질 적격) + 비개발×영화·스폰서십 시그널
    gkey: 'pm2', brand: 'motive', jobKey: 'MO1', camp: 'motive-recommend1-pm2',
    label: { vi: 'Project Manager', ko: 'PM(확장)' },
    // 풀봇과 동일하게 인접 직군도 스킬 시그널 1개+ 요구 — 직군만으로 열면 Marketing 전체(400+)가 쓸려 들어옴(9/9 dry-run 실측)
    pick: (p) => (!hasAny(p, ['PM']) && inLoc(p) && enOk(p)
      && ((hasAny(p, ['Marketing', 'Business Development']) && (filmRe.test(txt(p)) || bizRe.test(txt(p))))
        || (!hasAny(p, DEVISH) && filmRe.test(txt(p))))
      ? score(p) : null),
  },
]

// ── 카피(vi 실발송) — 정직 프레임(공개/비공개) ──
const BRANDS = {
  motive: {
    company: 'Motive Pictures', initial: 'M', meta: 'TP.HCM hoặc Hà Nội · Junior · 15–17 triệu',
    intro: '<b>Motive Pictures</b> đang triển khai dự án <b>hợp tác sản xuất phim điện ảnh giữa Hàn Quốc và Việt Nam</b>, và tuyển <b>Project Manager</b> qua FYI (làm việc tại TP.HCM hoặc Hà Nội). Công việc: điều phối tiến độ dự án phim Hàn–Việt, làm đầu mối giữa đoàn làm phim/đối tác/nhà tài trợ hai nước, triển khai marketing quảng bá phim và phát triển tài trợ/hợp tác B2B. Yêu cầu: <b>tiếng Anh thành thạo</b> (biết tiếng Hàn là lợi thế) và có kinh nghiệm marketing doanh nghiệp. Cấp độ Junior, lương 15–17 triệu.',
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
    const brand = BRANDS[g.brand]
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
      event: 'recommend_sent', page: '/scripts/motive-recommend-coldmail',
      meta: { campaign: camp, job_ids: [job.id], frame, group: `${g.brand}-${g.gkey}` }, user_id: p.id,
    }])
    ok++
    if (ok % 25 === 0) console.log(`  …${ok}/${targets.length}`)
    await sleep(400)
  }
  console.log(`\n✅ 발송 완료: ${ok}/${targets.length} (실패 ${fail})`)
}

main().catch((e) => { console.error(e); process.exit(1) })
