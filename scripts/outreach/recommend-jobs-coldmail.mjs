// 담당자 추천 콜드메일 — 이력서 공개풀(is_resume_public) 유저를 KTC+기업등록 활성 공고와
// 스킬·연차·직군·JD로 매칭해, "기업 담당자가 FYI 추천을 받아 당신에게 맞는 공고를 보냈다"
// 톤으로 상위 3개 공고를 담은 메일을 보낸다. 버튼 → /api/resume/recommend 원클릭 랜딩(원탭 지원).
// 이미 보낸 (email,job) 쌍(job_recommendations)은 제외. 발신: Resend.
//
//   node scripts/outreach/recommend-jobs-coldmail.mjs --test wsj@likelion.net   # 테스트 1통(스탬프 안 함)
//   node scripts/outreach/recommend-jobs-coldmail.mjs                           # dry-run: 대상 수/샘플
//   node scripts/outreach/recommend-jobs-coldmail.mjs --send                    # 실발송 + job_recommendations 로깅
//   옵션: --site http://localhost:3000 (테스트 링크를 로컬로) · --max N · --campaign recommend1
//
// ⚠️ 원클릭 랜딩(/api/resume/recommend)이 prod에 배포된 후에만 메일 버튼이 동작한다.
import { Resend } from 'resend'
import { sb, env } from './lib.mjs'
import { makeToken } from '../../lib/campaignToken.js'
import { guessRole } from '../../lib/roleGuess.js'
import { roleGroupKey } from '../../constants/jobs.js'

const args = process.argv.slice(2)
const flag = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d }
const testTo = flag('test', null)
const doSend = args.includes('--send')
const campaign = flag('campaign', 'recommend1')
const SITE = String(flag('site', env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com')).replace(/\/$/, '')
const RESEND_FROM = env.RESEND_FROM || 'FYI <hello@salary-fyi.com>'
const maxN = flag('max', null) ? parseInt(flag('max'), 10) : null
const TOP = 3
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

function cityOf(loc) {
  const s = (loc || '').toLowerCase()
  if (/hcm|ho chi minh|hồ chí minh|tp\.? ?hcm|thu duc|thủ đức|district|quận/.test(s)) return 'hcmc'
  if (/ha noi|hà nội|hanoi/.test(s)) return 'hanoi'
  if (/da nang|đà nẵng/.test(s)) return 'danang'
  if (/hai phong|hải phòng/.test(s)) return 'haiphong'
  if (/remote/.test(s)) return 'remote'
  return s ? 'other' : null
}

async function loadJobs() {
  const { data } = await sb.from('jobs')
    .select('id,title,company,role,location,experience_min,experience_max,description,tech_stack,logo_url,created_at')
    .eq('is_active', true).in('source', ['ktc', 'company_self'])
  return (data || []).filter((j) => !/likelion/i.test(j.company || '')).map((j) => ({
    ...j,
    grp: j.role ? roleGroupKey(j.role) : null,
    jdText: `${j.title} ${j.description || ''} ${(j.tech_stack || []).join(' ')}`.toLowerCase(),
    city: cityOf(j.location),
  }))
}

// 후보 프로필 → 상위 매칭 공고(정렬). 기발송 job_id 는 exclude 로 제외.
function matchJobs(p, jobs, exclude) {
  const roles = new Set()
  for (const t of [p.position, p.headline, ...(p.desired_roles || [])]) { const r = guessRole(t || '', p.skills || []); if (r) roles.add(r) }
  for (const d of (p.desired_roles || [])) roles.add(d)
  const grps = new Set([...roles].map((r) => roleGroupKey(r)).filter(Boolean))
  const yoe = p.yoe_months ? p.yoe_months / 12 : null
  const skills = (p.skills || []).map((s) => String(s).toLowerCase()).filter((s) => s.length >= 3)
  const pcity = cityOf(p.location)
  const rank = { roleExact: 3, roleGroup: 2, skillOnly: 1 }
  const out = []
  for (const j of jobs) {
    if (exclude.has(j.id)) continue
    let yoeOk = true
    if (yoe != null && j.experience_min != null) {
      const lo = Math.max(0, (j.experience_min ?? 0) - 1), hi = (j.experience_max ?? j.experience_min + 5) + 3
      yoeOk = yoe >= lo && yoe <= hi
    }
    if (!yoeOk) continue
    const skillHits = skills.filter((s) => j.jdText.includes(s)).length
    let tier = null
    if (j.role && roles.has(j.role)) tier = 'roleExact'
    else if (j.grp && grps.has(j.grp)) tier = 'roleGroup'
    else if (skillHits >= 2) tier = 'skillOnly'
    if (!tier) continue
    const sameCity = pcity && j.city && pcity === j.city
    out.push({ job: j, tier, skillHits, sameCity, score: rank[tier] * 100 + skillHits * 5 + (sameCity ? 3 : 0) })
  }
  return out.sort((a, b) => b.score - a.score || new Date(b.job.created_at) - new Date(a.job.created_at))
}

const firstName = (n) => String(n || '').trim().split(/\s+/).slice(-1)[0] || 'bạn'

function subject(jobs) {
  const c = jobs[0].job.company
  return jobs.length > 1
    ? `[FYI] ${c} và ${jobs.length - 1} công ty khác muốn xem hồ sơ của bạn`
    : `[FYI] ${c} muốn xem hồ sơ của bạn`
}

function emailHtml(name, url, matches) {
  const cards = matches.map(({ job: j }) => {
    const logo = j.logo_url
      ? `<img src="${esc(j.logo_url)}" width="44" height="44" alt="" style="width:44px;height:44px;border-radius:10px;object-fit:cover;background:#f0ebe3;display:block">`
      : `<div style="width:44px;height:44px;border-radius:10px;background:#fff0e6;color:#ff6000;font-weight:800;font-size:16px;text-align:center;line-height:44px">${esc((j.company || '?').trim().charAt(0).toUpperCase())}</div>`
    const meta = [j.role, j.location].filter(Boolean).map(esc).join(' · ')
    return `<tr><td style="padding:0 0 10px">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #eee5da;border-radius:14px"><tr>
        <td width="44" style="padding:14px 0 14px 14px;vertical-align:middle">${logo}</td>
        <td style="padding:14px 14px 14px 12px;vertical-align:middle">
          <div style="font-size:12px;color:#8a8073;margin-bottom:3px">${esc(j.company)}</div>
          <div style="font-size:14.5px;font-weight:700;color:#1a1612;line-height:1.35">${esc(j.title)}</div>
          <div style="font-size:12px;color:#b0691a;margin-top:3px">${meta}</div>
        </td>
      </tr></table></td></tr>`
  }).join('\n')

  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1612">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f7"><tr><td align="center" style="padding:28px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
  <tr><td style="font-size:20px;font-weight:800;color:#ff6000;padding-bottom:18px">FYI</td></tr>
  <tr><td style="font-size:15px;line-height:1.6;color:#1a1612;padding-bottom:6px">Chào ${esc(firstName(name))},</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:18px">
    Dựa trên hồ sơ của bạn trên FYI, chúng tôi đã <b>giới thiệu bạn tới một số nhà tuyển dụng đang tuyển</b>. Dưới đây là ${matches.length} vị trí phù hợp nhất với kinh nghiệm của bạn — bạn có thể ứng tuyển <b>chỉ với 1 chạm</b>, CV đã đăng ký của bạn sẽ được gửi tự động.
  </td></tr>
  <tr><td><table width="100%" cellpadding="0" cellspacing="0">${cards}</table></td></tr>
  <tr><td align="center" style="padding:16px 0 6px">
    <a href="${url}" style="display:inline-block;background:#ff6000;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 30px;border-radius:12px">Xem & ứng tuyển 1 chạm →</a>
  </td></tr>
  <tr><td style="font-size:11.5px;color:#a89f92;text-align:center;line-height:1.5;padding-top:20px">
    Bạn nhận được email này vì đã đăng ký hồ sơ công khai trên FYI.<br>— Đội ngũ FYI · <a href="https://salary-fyi.com/jobs" style="color:#a89f92">salary-fyi.com/jobs</a>
  </td></tr>
</table></td></tr></table></body></html>`
}

function emailText(name, url, matches) {
  const lines = matches.map((m, i) => `${i + 1}. ${m.job.title} — ${m.job.company}${m.job.location ? ` (${m.job.location})` : ''}`).join('\n')
  return `Chào ${firstName(name)},

Dựa trên hồ sơ của bạn trên FYI, chúng tôi đã giới thiệu bạn tới một số nhà tuyển dụng đang tuyển. Dưới đây là ${matches.length} vị trí phù hợp nhất — ứng tuyển chỉ với 1 chạm, CV của bạn được gửi tự động:

${lines}

Xem & ứng tuyển: ${url}

— Đội ngũ FYI · salary-fyi.com/jobs`
}

async function main() {
  const jobs = await loadJobs()

  // 기발송 (email,job_id) 쌍
  const { data: recs } = await sb.from('job_recommendations').select('to_email,job_id')
  const sentPair = new Set((recs || []).map((r) => `${(r.to_email || '').toLowerCase()}|${r.job_id}`))

  const resend = new Resend(env.RESEND_API_KEY)

  // ── 테스트 모드: 지정 이메일 프로필로 만들어 그 주소로 1통 ──
  if (testTo) {
    const { data: rows } = await sb.from('user_profiles')
      .select('id,email,full_name,position,headline,skills,yoe_months,location,desired_roles,resume_url')
      .ilike('email', testTo).limit(1)
    const p = rows?.[0]
    if (!p) { console.error(`프로필 없음: ${testTo}`); process.exit(1) }
    const exclude = new Set(jobs.filter((j) => sentPair.has(`${p.email.toLowerCase()}|${j.id}`)).map((j) => j.id))
    let matches = matchJobs(p, jobs, exclude).slice(0, TOP)
    if (!matches.length) { // 매칭 0이면 테스트 렌더 위해 최근 활성 공고 3개로 폴백
      matches = jobs.slice(0, TOP).map((j) => ({ job: j, tier: 'fallback', skillHits: 0 }))
      console.log('⚠️ 매칭 0 — 테스트 렌더용으로 임의 공고 3개 사용')
    }
    const jparam = matches.map((m) => m.job.id).join(',')
    const url = `${SITE}/api/resume/recommend?t=${makeToken(p.id, campaign)}&j=${jparam}`
    console.log('수신:', p.email, '| 공고:', matches.map((m) => `${m.job.company}/${m.job.role}(${m.tier})`).join(', '))
    console.log('랜딩 URL:', url)
    const { data, error } = await resend.emails.send({
      from: RESEND_FROM, to: p.email, subject: subject(matches),
      text: emailText(p.full_name, url, matches), html: emailHtml(p.full_name, url, matches),
    })
    if (error) { console.error('발송 실패:', error); process.exit(1) }
    console.log('✅ 테스트 발송 완료:', data?.id)
    return
  }

  // ── dry-run / 실발송: 공개풀 전체 매칭 ──
  const { data: pool } = await sb.from('user_profiles')
    .select('id,email,full_name,position,headline,skills,yoe_months,location,desired_roles,resume_url')
    .eq('is_resume_public', true)
  const cohort = []
  for (const p of (pool || [])) {
    if (!p.resume_url || /likelion/i.test(p.email || '')) continue
    const exclude = new Set(jobs.filter((j) => sentPair.has(`${p.email.toLowerCase()}|${j.id}`)).map((j) => j.id))
    const matches = matchJobs(p, jobs, exclude).slice(0, TOP)
    if (matches.length) cohort.push({ p, matches })
  }
  console.log(`대상: ${cohort.length}명 (공고 ${jobs.length}개, TOP ${TOP}개/명)`)
  console.log('샘플 5명:')
  for (const { p, matches } of cohort.slice(0, 5))
    console.log(`  ${p.full_name} <${p.email}> → ${matches.map((m) => `${m.job.company}/${m.job.role}`).join(', ')}`)

  if (!doSend) { console.log('\n(dry-run — 실발송하려면 --send. 먼저 --test 로 검수 권장. ⚠️ LLM 정밀판정은 아직 미적용)'); return }

  // 실발송 (LLM 정밀판정 붙이기 전까지는 확인 프롬프트 없이 돌리지 말 것)
  const list = maxN ? cohort.slice(0, maxN) : cohort
  let ok = 0
  for (const { p, matches } of list) {
    const url = `${SITE}/api/resume/recommend?t=${makeToken(p.id, campaign)}&j=${matches.map((m) => m.job.id).join(',')}`
    const { error } = await resend.emails.send({
      from: RESEND_FROM, to: p.email, subject: subject(matches),
      text: emailText(p.full_name, url, matches), html: emailHtml(p.full_name, url, matches),
    })
    if (error) { console.error(`실패 ${p.email}:`, error.message || error); continue }
    // 발송 로깅(dedup 소스) — job_recommendations 에 kind=recommend 로 각 공고 기록
    await sb.from('job_recommendations').upsert(
      matches.map((m) => ({
        user_id: p.id, to_email: p.email, job_id: m.job.id,
        job_title: m.job.title, job_company: m.job.company, sent_by: 'coldmail', kind: 'recommend', status: 'sent',
      })), { onConflict: 'user_id,job_id', ignoreDuplicates: true }
    )
    ok++
    await sleep(400)
  }
  console.log(`✅ 발송 완료: ${ok}/${list.length}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
