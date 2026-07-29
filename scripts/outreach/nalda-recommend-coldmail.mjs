// NALDA(NA3401 Full-Stack Developer) 단일 공고 추천 콜드메일 — 공개 인재풀에서 JD 필수스택
// (React+TypeScript, Firebase는 가점)과 연차로 매칭된 후보에게 "NALDA 담당자가 당신 이력서를
// 보고 이 공고를 보냈다 · 지원하면 우선 검토" 톤으로 발송. 버튼 → /api/resume/recommend
// 원클릭 랜딩(원탭 지원). 기발송(job_recommendations)·기지원자·likelion 메일 제외. 발신: Resend.
// 측정: 캠페인 nalda-recommend1 — recommend_sent/recommend_click/coldmail_job_apply 로
// 목표지표(콜드메일 공개 탭) 캠페인 표에 자동 집계.
//
//   node scripts/outreach/nalda-recommend-coldmail.mjs --test wsj@likelion.net  # 테스트 1통(스탬프 안 함)
//   node scripts/outreach/nalda-recommend-coldmail.mjs                          # dry-run: 대상 목록
//   node scripts/outreach/nalda-recommend-coldmail.mjs --send [--max N]         # 실발송 + 로깅
//   옵션: --site http://localhost:3000 · --campaign nalda-recommend1
import { Resend } from 'resend'
import { sb, env } from './lib.mjs'
import { makeToken } from '../../lib/campaignToken.js'

const JOB_SOURCE_ID = 'NA3401'

const args = process.argv.slice(2)
const flag = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d }
const testTo = flag('test', null)
const doSend = args.includes('--send')
const campaign = flag('campaign', 'nalda-recommend1')
const SITE = String(flag('site', env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com')).replace(/\/$/, '')
const RESEND_FROM = env.RESEND_FROM || 'FYI <hello@salary-fyi.com>'
const maxN = flag('max', null) ? parseInt(flag('max'), 10) : null
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

// ── JD 매칭: 스킬/헤드라인/경력사항 전체 텍스트에서 키워드 탐지 ──
const hayOf = (p) => [
  ...(Array.isArray(p.skills) ? p.skills : []),
  p.position, p.headline,
  JSON.stringify(p.experiences || []),
  JSON.stringify(p.resume_summary || {}),
].map((s) => String(s || '').toLowerCase()).join(' | ')

// react+ts 필수, firebase·모바일(우대: Swift/Kotlin/WebView)·연차적합(1~5년)은 가점
function scoreProfile(p) {
  const hay = hayOf(p)
  const has = (...keys) => keys.some((k) => hay.includes(k))
  if (!has('react') || !has('typescript')) return null
  const y = p.yoe_months
  if (y != null && (y < 6 || y > 96)) return null // 6개월 미만·8년 초과 제외
  let score = 0
  if (has('firebase')) score += 3
  if (y != null && y >= 12 && y <= 60) score += 2 // JD 명시 경력대
  if (has('swift', 'kotlin', 'webview')) score += 1
  if (has('react native', 'react-native')) score += 1
  return score
}

const firstName = (n) => String(n || '').trim().split(/\s+/).slice(-1)[0] || 'bạn'

function emailHtml(name, url, job) {
  const logo = job.logo_url
    ? `<img src="${esc(job.logo_url)}" width="44" height="44" alt="" style="width:44px;height:44px;border-radius:10px;object-fit:cover;background:#f0ebe3;display:block">`
    : `<div style="width:44px;height:44px;border-radius:10px;background:#fff0e6;color:#ff6000;font-weight:800;font-size:16px;text-align:center;line-height:44px">N</div>`
  const meta = [job.role, job.location].filter(Boolean).map(esc).join(' · ')
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1612">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f7"><tr><td align="center" style="padding:28px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
  <tr><td style="font-size:20px;font-weight:800;color:#ff6000;padding-bottom:18px">FYI</td></tr>
  <tr><td style="font-size:15px;line-height:1.6;color:#1a1612;padding-bottom:6px">Chào ${esc(firstName(name))},</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:18px">
    Nhà tuyển dụng của <b>NALDA</b> — công ty công nghệ đang vận hành ứng dụng quản lý thời gian <b>Timing</b> — đã xem hồ sơ của bạn trên FYI và <b>gửi cho bạn vị trí này</b> vì kinh nghiệm của bạn phù hợp với yêu cầu (React · TypeScript · Firebase).
  </td></tr>
  <tr><td style="padding-bottom:14px">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #eee5da;border-radius:14px"><tr>
      <td width="44" style="padding:14px 0 14px 14px;vertical-align:middle">${logo}</td>
      <td style="padding:14px 14px 14px 12px;vertical-align:middle">
        <div style="font-size:12px;color:#8a8073;margin-bottom:3px">${esc(job.company)}</div>
        <div style="font-size:14.5px;font-weight:700;color:#1a1612;line-height:1.35">${esc(job.title)}</div>
        <div style="font-size:12px;color:#b0691a;margin-top:3px">${meta}</div>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:6px">
    Vì đây là lời mời trực tiếp từ nhà tuyển dụng, hồ sơ của bạn sẽ được <b>ưu tiên xem xét</b> khi ứng tuyển. Chỉ cần <b>1 chạm</b> — CV đã đăng ký của bạn sẽ được gửi tự động.
  </td></tr>
  <tr><td align="center" style="padding:16px 0 6px">
    <a href="${url}" style="display:inline-block;background:#ff6000;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 30px;border-radius:12px">Ứng tuyển 1 chạm →</a>
  </td></tr>
  <tr><td style="font-size:11.5px;color:#a89f92;text-align:center;line-height:1.5;padding-top:20px">
    Bạn nhận được email này vì đã đăng ký hồ sơ công khai trên FYI.<br>— Đội ngũ FYI · <a href="https://salary-fyi.com/jobs" style="color:#a89f92">salary-fyi.com/jobs</a>
  </td></tr>
</table></td></tr></table></body></html>`
}

function emailText(name, url, job) {
  return `Chào ${firstName(name)},

Nhà tuyển dụng của NALDA — công ty công nghệ đang vận hành ứng dụng quản lý thời gian Timing — đã xem hồ sơ của bạn trên FYI và gửi cho bạn vị trí này vì kinh nghiệm của bạn phù hợp với yêu cầu (React · TypeScript · Firebase):

${job.title} — ${job.company}${job.location ? ` (${job.location})` : ''}

Vì đây là lời mời trực tiếp từ nhà tuyển dụng, hồ sơ của bạn sẽ được ưu tiên xem xét khi ứng tuyển. Ứng tuyển chỉ với 1 chạm — CV của bạn được gửi tự động:

${url}

— Đội ngũ FYI · salary-fyi.com/jobs`
}

const SUBJECT = '[FYI] NALDA đã xem hồ sơ của bạn và mời bạn ứng tuyển'

async function main() {
  const { data: jobRows } = await sb.from('jobs')
    .select('id,title,company,role,location,logo_url,is_active')
    .eq('source_id', JOB_SOURCE_ID).limit(1)
  const job = jobRows?.[0]
  if (!job || !job.is_active) { console.error(`공고 없음/비활성: ${JOB_SOURCE_ID}`); process.exit(1) }
  console.log(`공고: ${job.company} — ${job.title} (${job.id})`)

  const resend = new Resend(env.RESEND_API_KEY)
  const url = (userId) => `${SITE}/api/resume/recommend?t=${makeToken(userId, campaign)}&j=${job.id}`

  // ── 테스트 모드 ──
  if (testTo) {
    const { data: rows } = await sb.from('user_profiles').select('id,email,full_name').ilike('email', testTo).limit(1)
    const p = rows?.[0]
    if (!p) { console.error(`프로필 없음: ${testTo}`); process.exit(1) }
    const u = url(p.id)
    console.log('수신:', p.email, '\n랜딩 URL:', u)
    const { data, error } = await resend.emails.send({
      from: RESEND_FROM, to: p.email, subject: SUBJECT,
      text: emailText(p.full_name, u, job), html: emailHtml(p.full_name, u, job),
    })
    if (error) { console.error('발송 실패:', error); process.exit(1) }
    console.log('✅ 테스트 발송 완료:', data?.id)
    return
  }

  // ── 제외 셋: 이 공고 기발송(추천/유사 불문)·기지원자 ──
  const [{ data: recs }, { data: apps }] = await Promise.all([
    sb.from('job_recommendations').select('user_id,to_email').eq('job_id', job.id),
    sb.from('job_applications').select('user_id').eq('job_id', job.id),
  ])
  const sentUser = new Set((recs || []).map((r) => r.user_id).filter(Boolean))
  const sentEmail = new Set((recs || []).map((r) => (r.to_email || '').toLowerCase()).filter(Boolean))
  const appliedUser = new Set((apps || []).map((a) => a.user_id).filter(Boolean))

  // ── 공개풀 매칭 ──
  const { data: pool } = await sb.from('user_profiles')
    .select('id,email,full_name,position,headline,skills,yoe_months,experiences,resume_summary,resume_url')
    .eq('is_resume_public', true)
  const cohort = []
  for (const p of (pool || [])) {
    if (!p.resume_url || !p.email || /likelion/i.test(p.email)) continue
    if (sentUser.has(p.id) || sentEmail.has(p.email.toLowerCase()) || appliedUser.has(p.id)) continue
    const score = scoreProfile(p)
    if (score == null) continue
    cohort.push({ p, score })
  }
  cohort.sort((a, b) => b.score - a.score)

  console.log(`대상: ${cohort.length}명 (공개풀 ${pool?.length || 0}명 중)`)
  for (const { p, score } of cohort) {
    const y = p.yoe_months
    console.log(`  [${score}] ${p.full_name} <${p.email}> — ${p.position || '?'} · ${y == null ? '경력?' : Math.round(y / 12 * 10) / 10 + 'y'}`)
  }

  if (!doSend) { console.log('\n(dry-run — 실발송하려면 --send. ⚠️ Resend 하루 100통 한도 잔량 확인 후 --max 권장)'); return }

  const list = maxN ? cohort.slice(0, maxN) : cohort
  let ok = 0
  for (const { p } of list) {
    const { error } = await resend.emails.send({
      from: RESEND_FROM, to: p.email, subject: SUBJECT,
      text: emailText(p.full_name, url(p.id), job), html: emailHtml(p.full_name, url(p.id), job),
    })
    if (error) { console.error(`실패 ${p.email}:`, error.message || error); continue }
    await sb.from('job_recommendations').upsert([{
      user_id: p.id, to_email: p.email, job_id: job.id,
      job_title: job.title, job_company: job.company, sent_by: 'coldmail', kind: 'recommend', status: 'sent',
    }], { onConflict: 'user_id,job_id', ignoreDuplicates: true })
    await sb.from('events').insert([{
      event: 'recommend_sent', page: '/scripts/nalda-recommend-coldmail',
      meta: { campaign, job_ids: [job.id] }, user_id: p.id,
    }])
    ok++
    await sleep(400)
  }
  console.log(`✅ 발송 완료: ${ok}/${list.length}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
