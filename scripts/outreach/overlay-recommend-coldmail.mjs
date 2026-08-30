// Overlay(VTYLE — VRChat 아바타 패션) 2개 공고(R143 3D Clothing Artist / R144 3D Rigger) 추천 콜드메일 — bada 패턴.
// 배경: 8/29 KTC 라인 등록, 지원 0·미발송 상태에서 8/30 발송. 원격·경력 무관(인턴 4-5M/신입 10-12M ₫) → 지역 컷 없음(해외 거주만 제외).
// 선정은 룰 기반: cloth=하드 3D툴(Blender/ZBrush/Substance/Maya/3ds Max/C4D) or Design·Game×3D 신호,
// rig=cloth 미배정 중 Game 직군 or Unity/Unreal 신호(리깅 명시자는 풀에 0명 — "ScrollTrigger" 오탐 교훈, \b 경계 필수).
// 시니어 개발자(개발직군 5y+)의 툴 나열 노이즈는 제외. ⚠️ 발송 후 Overlay(KTC 라인)에 추천 명단 실제 공유할 것.
//
//   node scripts/outreach/overlay-recommend-coldmail.mjs                          # dry-run
//   node scripts/outreach/overlay-recommend-coldmail.mjs --send [--group cloth] [--max N]
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
const txt = (p) => {
  const sk = Array.isArray(p.skills) ? p.skills.join(' ') : String(p.skills || '')
  return (sk + ' ' + JSON.stringify(p.experiences || '')).toLowerCase()
}
const ABROAD = /india|gurugram|delhi|philippin|manila|singapore|malaysia|indonesia|jakarta|myanmar|yangon|korea|japan|china/i
const DEV = new Set(['Fullstack', 'Backend', 'Frontend', 'Mobile', 'Embedded', 'DevOps', 'AI Engineer', 'QA'])
const CREATIVE = new Set(['Design', 'Game'])
const roles = (p) => [p.position, ...(p.desired_roles || [])].filter(Boolean)
const hard3d = (p) => /blender|zbrush|substance|\bmaya\b|3ds max|cinema 4d/.test(txt(p))
// ⚠️ \b 필수: /unity/는 "community", /rigger/는 "ScrollTrigger"에 걸린다.
// \b로도 부족: "Unity Ads"(광고), "UNITY Fitness"(사명), ASP.NET Unity(DI) — 게임 문맥(c#/game/3d) 동반 필수.
const engine = (p) => /\bunity\b|\bunreal\b/.test(txt(p)) && /\bgame|\bc#\b|\b3d\b|blender|vrchat/.test(txt(p)) && !/unity (ads|fitness)/.test(txt(p))
const soft3d = (p) => /\b3d model|3d art|3d design|game art|character (model|design)/.test(txt(p)) || engine(p)
const gameish = (p) => roles(p).includes('Game') || engine(p)
const eligible = (p) => {
  if (ABROAD.test(String(p.location || ''))) return false
  // 개발직군 5y+의 툴 단순 나열은 노이즈(신입 밴드 급여와도 불일치)
  if (roles(p).some((x) => DEV.has(x)) && (p.yoe_months ?? 0) > 60) return false
  return true
}

// 그룹별 (필터, 점수) — cloth(핵심 스킬) 우선 배정, 1인 1그룹
const GROUPS = [
  {
    key: 'cloth', jobId: 'aec7a68f-b3d3-48ff-af86-36d4571c985e', // R143 3D Clothing Artist
    label: { vi: '3D Clothing Artist (VTYLE · VRChat)', ko: '3D 의상 아티스트' },
    pick: (p) => {
      if (!eligible(p)) return null
      const isCreative = roles(p).some((x) => CREATIVE.has(x))
      if (!hard3d(p) && !(isCreative && soft3d(p))) return null
      let s = hard3d(p) ? 3 : 1
      if (isCreative) s += 2
      if (/substance|zbrush|texture|pbr/.test(txt(p))) s += 1
      return s
    },
  },
  {
    key: 'rig', jobId: 'd9270090-abb8-4653-861d-8d08d4e3c161', // R144 3D Rigger/Rigging Artist
    label: { vi: '3D Rigger/Rigging Artist (VTYLE · VRChat)', ko: '3D 리거' },
    pick: (p) => {
      if (!eligible(p) || !gameish(p)) return null
      let s = roles(p).includes('Game') ? 3 : 1
      if (/unity/.test(txt(p))) s += 2
      return s
    },
  },
]
const campaignOf = (g, frame) => `overlay-recommend1-${g}-${frame}`

// ── 카피(vi 실발송) — kyndof 표준 정직 프레임(공개/비공개) ──
const COPY = {
  subject: {
    public: (role) => `[FYI] Bạn được chọn vào danh sách đề cử gửi Overlay — ${role}`,
    private: (role) => `[FYI] Bạn được chọn vào danh sách đề cử — ${role} tại Overlay`,
  },
  intro: '<b>Overlay</b> — công ty Hàn Quốc vận hành <b>VTYLE</b>, nền tảng thời trang &amp; lifestyle cho avatar 3D trên VRChat, phân phối sản phẩm đến người dùng toàn cầu — đang tuyển 3D Artist qua FYI. <b>Không yêu cầu kinh nghiệm</b> (chấp nhận thực tập sinh &amp; mới tốt nghiệp), <b>làm việc từ xa 100%</b>, lương thực tập 4–5 triệu ₫ / Fresher-Junior 10–12 triệu ₫.',
  hook: 'Đội ngũ FYI đã xem xét toàn bộ hồ sơ đã đăng ký và <b>chọn bạn vào danh sách đề cử</b> cho vị trí dưới đây — kỹ năng 3D/công cụ sáng tạo trong hồ sơ của bạn phù hợp với vị trí này.',
  benefit: {
    public: '<b>Trong tuần này</b>, FYI sẽ gửi danh sách đề cử trực tiếp cho người phụ trách tuyển dụng của Overlay. Hồ sơ của bạn đang ở chế độ công khai nên sẽ được gửi kèm danh sách. Nếu bạn ứng tuyển ngay, CV của bạn sẽ được <b>ưu tiên xem xét</b> cùng lời giới thiệu từ FYI.',
    private: '<b>Trong tuần này</b>, FYI sẽ gửi danh sách đề cử trực tiếp cho người phụ trách tuyển dụng của Overlay. Hồ sơ của bạn đang ở chế độ riêng tư — nếu bạn ứng tuyển ngay, CV của bạn sẽ được gửi kèm lời giới thiệu từ FYI và được <b>ưu tiên xem xét</b>.',
  },
  onetap: 'Chỉ cần <b>1 chạm</b> — CV đã đăng ký của bạn sẽ được gửi tự động.',
}

const META_VI = 'Remote 100% · Không yêu cầu kinh nghiệm · TT 4–5tr / Junior 10–12tr ₫'

function jobCard(job) {
  const logo = job.logo_url
    ? `<img src="${esc(job.logo_url)}" width="44" height="44" alt="" style="width:44px;height:44px;border-radius:10px;object-fit:cover;background:#f0ebe3;display:block">`
    : `<div style="width:44px;height:44px;border-radius:10px;background:#fff0e6;color:#ff6000;font-weight:800;font-size:16px;text-align:center;line-height:44px">O</div>`
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #eee5da;border-radius:14px;margin-bottom:8px"><tr>
    <td width="44" style="padding:14px 0 14px 14px;vertical-align:middle">${logo}</td>
    <td style="padding:14px 14px 14px 12px;vertical-align:middle">
      <div style="font-size:12px;color:#8a8073;margin-bottom:3px">Overlay (VTYLE)</div>
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

- ${job.title.trim()} (Overlay · VTYLE) — ${META_VI} — ${SITE}/ktc/jobs/${job.id}

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
      .select('id,email,full_name,position,desired_roles,yoe_months,location,skills,experiences,is_resume_public')
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

  // 배정: cloth(핵심 스킬) 우선, 1인 1그룹
  const seen = new Set()
  const byGroup = { cloth: [], rig: [] }
  for (const p of pool) {
    if (!p.email || /likelion/i.test(p.email)) continue
    const e = p.email.toLowerCase()
    if (seen.has(e) || unsubSet.has(p.id)) continue
    if (todayUsers.has(p.id) || todayEmails.has(e)) continue
    for (const g of GROUPS) {
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
      console.log(`\n── ${g.key} 전체 ──`)
      for (const { p, s, frame } of byGroup[g.key])
        console.log(`  [${s}·${frame}] ${p.full_name} <${p.email}> · ${p.position || '?'} · ${Math.round((p.yoe_months || 0) / 12 * 10) / 10}y · ${p.location || '위치?'}`)
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
      html: emailHtml(p.full_name, u, un, job, frame), text: emailText(p.full_name, u, un, job, frame),
      headers: { 'List-Unsubscribe': `<${un}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    })
    if (error) { console.error(`실패 ${p.email}:`, error.message || error); fail++; continue }
    await sb.from('job_recommendations').upsert([{
      user_id: p.id, to_email: p.email, job_id: job.id,
      job_title: job.title, job_company: job.company, sent_by: 'coldmail', kind: 'recommend', status: 'sent',
    }], { onConflict: 'user_id,job_id', ignoreDuplicates: true })
    await sb.from('events').insert([{
      event: 'recommend_sent', page: '/scripts/overlay-recommend-coldmail',
      meta: { campaign: camp, job_ids: [job.id], frame, group: g.key }, user_id: p.id,
    }])
    ok++
    if (ok % 10 === 0) console.log(`  …${ok}/${targets.length}`)
    await sleep(400)
  }
  console.log(`\n✅ 발송 완료: ${ok}/${targets.length} (실패 ${fail})`)
}

main().catch((e) => { console.error(e); process.exit(1) })
