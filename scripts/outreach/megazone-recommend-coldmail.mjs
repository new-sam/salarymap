// MEGAZONE Vietnam 3개 공고(V25 AM / V26 CSA / V27 Pre-sales) 추천 콜드메일 — bada 패턴(그룹 배정·공개/비공개·1일 1통).
// 배경: 8/28 KTC 라인 등록. 한국계 클라우드 MSP(AWS), 30-39M ₫ 온사이트 — V25·V26 하노이, V27 하노이+호치민 각 1.
// 선정은 룰 기반(LLM 채점 없음): am=영업/BA × 3-6y × 하노이(미기재 포함), csa=테크 × AWS 명시 × 1-5y × 하노이,
// pse=테크 × 클라우드(aws/azure/gcp/k8s/devops 등) × 2y+ × 하노이·호치민. 배정 우선순위=모수 얇은 순(am→csa→pse).
// ⚠️ 카피가 "이번 주 담당자에게 명단 전달" 약속 — 발송 후 MEGAZONE(KTC 라인)에 추천 명단 실제 공유할 것.
//
//   node scripts/outreach/megazone-recommend-coldmail.mjs                          # dry-run
//   node scripts/outreach/megazone-recommend-coldmail.mjs --send [--group pse] [--max N]
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
const locBucket = (loc) => {
  const s = String(loc || '').toLowerCase()
  if (!s.trim()) return 'B'
  if (/(hà nội|ha noi|hanoi|cầu giấy|cau giay|bắc ninh|bac ninh|hưng yên|hung yen)/.test(s)) return 'HN'
  if (/(h[ồo]\s*ch[íi]\s*minh|hcm|sài gòn|sai gon|thủ đức|thu duc|bình dương|binh duong|biên hòa|bien hoa|đồng nai|dong nai)/.test(s)) return 'HCM'
  return 'X'
}
const y = (p) => (p.yoe_months ?? 0) / 12
const roles = (p) => new Set([p.position, ...(p.desired_roles || [])].filter(Boolean))
const TECH = new Set(['DevOps', 'Backend', 'Fullstack', 'Frontend', 'Mobile', 'AI Engineer', 'AI/Data', 'Embedded', 'QA', 'IT Support', 'Data', 'Security'])
const isTech = (p) => [...roles(p)].some((x) => TECH.has(x))
const isSales = (p) => { const R = roles(p); return R.has('Sales') || R.has('Business Analyst') || R.has('BD') }
const skillsText = (p) => {
  const sk = Array.isArray(p.skills) ? p.skills.join(' ') : String(p.skills || '')
  return (sk + ' ' + JSON.stringify(p.experiences || '')).toLowerCase()
}
const hasAws = (p) => /\baws\b|amazon web/.test(skillsText(p))
const hasCloud = (p) => hasAws(p) || /\b(azure|gcp|google cloud|kubernetes|k8s|terraform|docker|devops|cloud)\b/.test(skillsText(p))

// 그룹별 (필터, 점수) — 배정 우선순위 = 모수 얇은 순(am→csa→pse), 1인 1그룹
const GROUPS = [
  {
    key: 'am', jobId: '2a01b40f-ab12-45c5-9ed7-868db52507d6', // V25 ACCOUNT MANAGER (하노이)
    label: { vi: 'Account Manager (Cloud Sales)', ko: '어카운트 매니저' }, locs: ['HN', 'B'],
    pick: (p) => {
      if (!isSales(p) || y(p) < 3 || y(p) > 6) return null
      let s = locBucket(p.location) === 'HN' ? 3 : 0
      if (p.english_cert) s += 2
      if (hasCloud(p)) s += 2
      return s
    },
  },
  {
    key: 'csa', jobId: '38c0dcb1-ec71-4979-9b15-b42375a051fd', // V26 Cloud Solution Architect (하노이)
    label: { vi: 'Cloud Solution Architect (AWS)', ko: '클라우드 솔루션 아키텍트' }, locs: ['HN', 'B'],
    pick: (p) => {
      if (!isTech(p) || !hasAws(p) || y(p) < 1 || y(p) > 5) return null
      let s = locBucket(p.location) === 'HN' ? 3 : 0
      if (p.english_cert) s += 1
      if (String(p.position) === 'DevOps') s += 2
      return s
    },
  },
  {
    key: 'pse', jobId: '3d192b25-42c1-4d36-a657-4bbba5eb3ab3', // V27 PRE-SALES ENGINEER (하노이+호치민)
    label: { vi: 'Pre-sales Engineer (AWS Cloud)', ko: '프리세일즈 엔지니어' }, locs: ['HN', 'HCM', 'B'],
    pick: (p) => {
      if (!isTech(p) || !hasCloud(p) || y(p) < 2) return null
      let s = ['HN', 'HCM'].includes(locBucket(p.location)) ? 3 : 0
      if (hasAws(p)) s += 2
      if (p.english_cert) s += 1
      if (String(p.position) === 'DevOps') s += 1
      return s
    },
  },
]
const campaignOf = (g, frame) => `megazone-recommend1-${g}-${frame}`

// ── 카피(vi 실발송) — kyndof 표준 정직 프레임(공개/비공개) ──
const COPY = {
  subject: {
    public: (role) => `[FYI] Bạn được chọn vào danh sách đề cử gửi MEGAZONE Vietnam — ${role}`,
    private: (role) => `[FYI] Bạn được chọn vào danh sách đề cử — ${role} tại MEGAZONE Vietnam`,
  },
  intro: '<b>MEGAZONE Vietnam</b> — thành viên của MEGAZONE CLOUD, nhà cung cấp dịch vụ quản lý đám mây (MSP) hàng đầu Hàn Quốc và là đối tác cấp cao của AWS — đang tuyển dụng các vị trí chủ chốt cho đội ngũ tại Việt Nam qua FYI (lương 30–39 triệu ₫/tháng, thương lượng theo năng lực).',
  hook: 'Đội ngũ FYI đã xem xét toàn bộ hồ sơ đã đăng ký và <b>chọn bạn vào danh sách đề cử</b> cho vị trí dưới đây — kinh nghiệm của bạn phù hợp với yêu cầu của vị trí này.',
  benefit: {
    public: '<b>Trong tuần này</b>, FYI sẽ gửi danh sách đề cử trực tiếp cho người phụ trách tuyển dụng của MEGAZONE Vietnam. Hồ sơ của bạn đang ở chế độ công khai nên sẽ được gửi kèm danh sách. Nếu bạn ứng tuyển ngay, CV của bạn sẽ được <b>ưu tiên xem xét</b> cùng lời giới thiệu từ FYI.',
    private: '<b>Trong tuần này</b>, FYI sẽ gửi danh sách đề cử trực tiếp cho người phụ trách tuyển dụng của MEGAZONE Vietnam. Hồ sơ của bạn đang ở chế độ riêng tư — nếu bạn ứng tuyển ngay, CV của bạn sẽ được gửi kèm lời giới thiệu từ FYI và được <b>ưu tiên xem xét</b>.',
  },
  onetap: 'Chỉ cần <b>1 chạm</b> — CV đã đăng ký của bạn sẽ được gửi tự động.',
}

const metaOf = (g) => ({
  am: '30–39 triệu ₫/tháng · Hà Nội (Cầu Giấy) · Onsite',
  csa: '30–39 triệu ₫/tháng · Hà Nội (Cầu Giấy) · Onsite',
  pse: '30–39 triệu ₫/tháng · Hà Nội hoặc TP.HCM · Onsite',
}[g.key])

function jobCard(job, g) {
  const logo = job.logo_url
    ? `<img src="${esc(job.logo_url)}" width="44" height="44" alt="" style="width:44px;height:44px;border-radius:10px;object-fit:cover;background:#f0ebe3;display:block">`
    : `<div style="width:44px;height:44px;border-radius:10px;background:#fff0e6;color:#ff6000;font-weight:800;font-size:16px;text-align:center;line-height:44px">M</div>`
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #eee5da;border-radius:14px;margin-bottom:8px"><tr>
    <td width="44" style="padding:14px 0 14px 14px;vertical-align:middle">${logo}</td>
    <td style="padding:14px 14px 14px 12px;vertical-align:middle">
      <div style="font-size:12px;color:#8a8073;margin-bottom:3px">MEGAZONE Vietnam</div>
      <div style="font-size:14.5px;font-weight:700;color:#1a1612;line-height:1.35">${esc(job.title.trim())}</div>
      <div style="font-size:12px;color:#b0691a;margin-top:3px">${esc(metaOf(g))}</div>
    </td>
  </tr></table>`
}

function emailHtml(name, url, unsubUrl, job, frame, g) {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1612">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f7"><tr><td align="center" style="padding:28px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
  <tr><td style="padding-bottom:18px"><img src="https://salary-fyi.com/fyi-logo.png" height="24" alt="FYI" style="height:24px;width:auto;display:block"></td></tr>
  <tr><td style="font-size:15px;line-height:1.6;color:#1a1612;padding-bottom:6px">Chào ${esc(firstName(name))},</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:14px">${COPY.intro}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:14px">${COPY.hook}</td></tr>
  <tr><td style="padding-bottom:10px">${jobCard(job, g)}</td></tr>
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

function emailText(name, url, unsubUrl, job, frame, g) {
  return `Chào ${firstName(name)},

${strip(COPY.intro)}

${strip(COPY.hook)}

- ${job.title.trim()} (MEGAZONE Vietnam) — ${metaOf(g)} — ${SITE}/ktc/jobs/${job.id}

${strip(COPY.benefit[frame])} ${strip(COPY.onetap)}

${url}

Bạn nhận được email này vì đã đăng ký hồ sơ trên FYI.
— Đội ngũ FYI · salary-fyi.com/jobs
Hủy đăng ký: ${unsubUrl}`
}

async function main() {
  const jobIds = GROUPS.map((g) => g.jobId)
  const { data: jobRows, error: jobErr } = await sb.from('jobs')
    .select('id,title,company,location,logo_url,is_active').in('id', jobIds)
  if (jobErr) { console.error(jobErr.message); process.exit(1) }
  const jobById = Object.fromEntries((jobRows || []).map((j) => [j.id, j]))
  for (const g of GROUPS) {
    if (!jobById[g.jobId] || !jobById[g.jobId].is_active) { console.error(`공고 없음/비활성: ${g.key} ${g.jobId}`); process.exit(1) }
  }
  const resend = new Resend(env.RESEND_API_KEY)
  const url = (userId, camp, jobId) => `${SITE}/api/resume/recommend?t=${makeToken(userId, camp)}&j=${jobId}`
  const unsubFor = (userId, camp) => `${SITE}/api/coldmail/unsub?t=${makeToken(userId, camp)}`

  const [pool, unsubs, recs, apps, todays] = await Promise.all([
    fetchAll(() => sb.from('user_profiles')
      .select('id,email,full_name,position,desired_roles,yoe_months,location,skills,experiences,english_cert,is_resume_public')
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

  // 배정: GROUPS 순서 = 우선순위(am→csa→pse), 1인 1그룹, 근무지 불일치 제외
  const seen = new Set()
  const byGroup = { am: [], csa: [], pse: [] }
  for (const p of pool) {
    if (!p.email || /likelion/i.test(p.email)) continue
    const e = p.email.toLowerCase()
    if (seen.has(e) || unsubSet.has(p.id)) continue
    if (todayUsers.has(p.id) || todayEmails.has(e)) continue
    for (const g of GROUPS) {
      if (!g.locs.includes(locBucket(p.location))) continue
      if ((appliedByJob[g.jobId] || new Set()).has(p.id)) continue
      if ((recUserByJob[g.jobId] || new Set()).has(p.id)) continue
      const s = g.pick(p)
      if (s == null) continue
      byGroup[g.key].push({ p, s, frame: p.is_resume_public ? 'public' : 'private' })
      seen.add(e)
      break
    }
  }
  for (const g of GROUPS) byGroup[g.key].sort((a, b) => b.s - a.s)

  console.log('발송 대상(1인 1통 배정):')
  for (const g of GROUPS) {
    const rows = byGroup[g.key]
    const pub = rows.filter((x) => x.frame === 'public').length
    console.log(`  ${g.key} (${g.label.ko}): ${rows.length}명 (공개 ${pub} / 비공개 ${rows.length - pub})`)
  }
  if (!doSend) {
    for (const g of GROUPS) {
      console.log(`\n── ${g.key} 상위 10 ──`)
      for (const { p, s, frame } of byGroup[g.key].slice(0, 10))
        console.log(`  [${s}·${frame}] ${p.full_name} <${p.email}> · ${p.position || '?'} · ${Math.round((p.yoe_months || 0) / 12 * 10) / 10}y · ${p.location || '위치?'} · en:${p.english_cert || '-'}`)
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
    const job = jobById[g.jobId]
    const camp = campaignOf(g.key, frame)
    const u = url(p.id, camp, job.id), un = unsubFor(p.id, camp)
    const { error } = await resend.emails.send({
      from: RESEND_FROM, to: p.email, subject: COPY.subject[frame](g.label.vi),
      html: emailHtml(p.full_name, u, un, job, frame, g), text: emailText(p.full_name, u, un, job, frame, g),
      headers: { 'List-Unsubscribe': `<${un}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    })
    if (error) { console.error(`실패 ${p.email}:`, error.message || error); fail++; continue }
    await sb.from('job_recommendations').upsert([{
      user_id: p.id, to_email: p.email, job_id: job.id,
      job_title: job.title, job_company: job.company, sent_by: 'coldmail', kind: 'recommend', status: 'sent',
    }], { onConflict: 'user_id,job_id', ignoreDuplicates: true })
    await sb.from('events').insert([{
      event: 'recommend_sent', page: '/scripts/megazone-recommend-coldmail',
      meta: { campaign: camp, job_ids: [job.id], frame, group: g.key }, user_id: p.id,
    }])
    ok++
    if (ok % 25 === 0) console.log(`  …${ok}/${targets.length}`)
    await sleep(400)
  }
  console.log(`\n✅ 발송 완료: ${ok}/${targets.length} (실패 ${fail})`)
}

main().catch((e) => { console.error(e); process.exit(1) })
