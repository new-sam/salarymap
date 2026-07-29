// MPNX(MPNX2801 Senior Technical IP Analyst) 단일 공고 추천 콜드메일 — nalda-recommend-coldmail.mjs 와
// 동일 패턴. 공개 인재풀의 시니어 엔지니어(2.5y+, 개발직군·공학전공)를 JD 도메인(아키텍처/클라우드/
// 네트워크·보안/임베디드) + 영어 신호로 매칭해 "MPNX 담당자가 이력서를 보고 보냈다 · 우선 검토 ·
// 특허 경험 불요(교육 제공)" 톤으로 발송. 버튼 → /api/resume/recommend 원클릭 랜딩(원탭 지원).
// 측정: 캠페인 mpnx-recommend1 (recommend_sent/recommend_click/coldmail_job_apply 자동 집계).
//
//   node scripts/outreach/mpnx-recommend-coldmail.mjs --test wsj@likelion.net  # 테스트 1통(스탬프 안 함)
//   node scripts/outreach/mpnx-recommend-coldmail.mjs                          # dry-run: 대상 목록
//   node scripts/outreach/mpnx-recommend-coldmail.mjs --send [--max N]         # 실발송 + 로깅
import { Resend } from 'resend'
import { sb, env } from './lib.mjs'
import { makeToken } from '../../lib/campaignToken.js'

const JOB_SOURCE_ID = 'MPNX2801'

const args = process.argv.slice(2)
const flag = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d }
const testTo = flag('test', null)
const doSend = args.includes('--send')
const campaign = flag('campaign', 'mpnx-recommend1')
const SITE = String(flag('site', env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com')).replace(/\/$/, '')
const RESEND_FROM = env.RESEND_FROM || 'FYI <hello@salary-fyi.com>'
const maxN = flag('max', null) ? parseInt(flag('max'), 10) : null
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

// ── JD 매칭 ──
const hayOf = (p) => [
  ...(Array.isArray(p.skills) ? p.skills : []),
  p.headline, p.position,
  JSON.stringify(p.experiences || []),
  JSON.stringify(p.resume_summary || {}),
].map((s) => String(s || '').toLowerCase()).join(' | ')

const DEV_POS = ['backend', 'fullstack', 'devops', 'ai/data', 'mobile', 'frontend']
const DEEP = ['architecture', 'architect', 'system design', 'microservice', 'distributed', 'aws', 'azure', 'gcp', 'google cloud', 'kubernetes', 'k8s', 'terraform', 'serverless', 'network', 'cybersecurity', 'security', 'embedded', 'firmware', 'rtos', 'iot', 'semiconductor']
const NONENG_MAJOR = ['finance', 'business', 'hospitality', 'account', 'economic', 'marketing', 'law']

// 시니어 엔지니어 필터 후: 도메인심화 2+ (A/B) OR 심화 1+영어증빙 (임베디드 등 하드웨어 케이스)
// OR 5y+ 백엔드/데이터/DevOps 시니어 + 영어신호 (JD가 Software Engineering 자체를 심화로 인정)
function scoreProfile(p) {
  const y = p.yoe_months
  if (y == null || y < 30) return null
  const pos = String(p.position || '').toLowerCase()
  const isDev = DEV_POS.includes(pos)
  if (!isDev && !/engineer|developer|devops|software/i.test(p.headline || '')) return null
  if (pos === 'frontend' || pos === 'mobile' || pos === 'qa') {
    // 프론트/모바일 단독·QA는 시스템 분석 적합도가 낮아 제외 (심화 도메인 보유 시엔 통과)
    if (DEEP.filter((w) => hayOf(p).includes(w)).length < 2) return null
  }
  const majorL = String(p.major || '').toLowerCase()
  if (NONENG_MAJOR.some((w) => majorL.includes(w))) return null

  const hay = hayOf(p)
  const deep = DEEP.filter((w) => hay.includes(w))
  const eng = (p.english_cert || '').trim()
  const engStrong = /ielts|toeic|toefl|fluent|advanced|business|professional|native|upper|proficient/i.test(eng) || hay.includes('ielts') || hay.includes('toeic')
  const engAny = engStrong || /intermediate|b2|b1/i.test(eng)
  const backendCore = ['backend', 'ai/data', 'devops'].includes(pos)

  const tierAB = deep.length >= 2
  const cHardware = deep.length >= 1 && engStrong
  const cSenior = y >= 60 && backendCore && engAny
  if (!tierAB && !cHardware && !cSenior) return null

  return deep.length * 2 + (engStrong ? 4 : engAny ? 2 : 0) + (y >= 36 && y <= 96 ? 2 : 0)
}

const firstName = (n) => String(n || '').trim().split(/\s+/).slice(-1)[0] || 'bạn'

function emailHtml(name, url, job) {
  const logo = job.logo_url
    ? `<img src="${esc(job.logo_url)}" width="44" height="44" alt="" style="width:44px;height:44px;border-radius:10px;object-fit:cover;background:#f0ebe3;display:block">`
    : `<div style="width:44px;height:44px;border-radius:10px;background:#fff0e6;color:#ff6000;font-weight:800;font-size:16px;text-align:center;line-height:44px">M</div>`
  const meta = [job.role, job.location].filter(Boolean).map(esc).join(' · ')
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1612">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f7"><tr><td align="center" style="padding:28px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
  <tr><td style="font-size:20px;font-weight:800;color:#ff6000;padding-bottom:18px">FYI</td></tr>
  <tr><td style="font-size:15px;line-height:1.6;color:#1a1612;padding-bottom:6px">Chào ${esc(firstName(name))},</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:18px">
    Nhà tuyển dụng của <b>MPNX</b> — công ty chuyên về thương mại hóa tài sản trí tuệ và cấp phép công nghệ (patent licensing) trên thị trường quốc tế — đã xem hồ sơ của bạn trên FYI và <b>gửi cho bạn vị trí này</b> vì nền tảng kỹ thuật của bạn phù hợp với yêu cầu.
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
    Vị trí dành cho kỹ sư phần mềm/hệ thống cấp Senior — <b>không yêu cầu kinh nghiệm về bằng sáng chế</b>, công ty sẽ đào tạo về patent analysis, claim mapping và IP licensing. Có cơ hội công tác Hàn Quốc 1–2 lần/năm.
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

Nhà tuyển dụng của MPNX — công ty chuyên về thương mại hóa tài sản trí tuệ và cấp phép công nghệ (patent licensing) quốc tế — đã xem hồ sơ của bạn trên FYI và gửi cho bạn vị trí này vì nền tảng kỹ thuật của bạn phù hợp:

${job.title} — ${job.company}${job.location ? ` (${job.location})` : ''}

Vị trí dành cho kỹ sư phần mềm/hệ thống cấp Senior — không yêu cầu kinh nghiệm về bằng sáng chế, công ty sẽ đào tạo về patent analysis và IP licensing. Có cơ hội công tác Hàn Quốc 1–2 lần/năm.

Vì đây là lời mời trực tiếp từ nhà tuyển dụng, hồ sơ của bạn sẽ được ưu tiên xem xét khi ứng tuyển. Ứng tuyển chỉ với 1 chạm — CV của bạn được gửi tự động:

${url}

— Đội ngũ FYI · salary-fyi.com/jobs`
}

const SUBJECT = '[FYI] MPNX đã xem hồ sơ của bạn và mời bạn ứng tuyển'

async function main() {
  const { data: jobRows } = await sb.from('jobs')
    .select('id,title,company,role,location,logo_url,is_active')
    .eq('source_id', JOB_SOURCE_ID).limit(1)
  const job = jobRows?.[0]
  if (!job || !job.is_active) { console.error(`공고 없음/비활성: ${JOB_SOURCE_ID}`); process.exit(1) }
  console.log(`공고: ${job.company} — ${job.title} (${job.id})`)

  const resend = new Resend(env.RESEND_API_KEY)
  const url = (userId) => `${SITE}/api/resume/recommend?t=${makeToken(userId, campaign)}&j=${job.id}`

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

  const [{ data: recs }, { data: apps }] = await Promise.all([
    sb.from('job_recommendations').select('user_id,to_email').eq('job_id', job.id),
    sb.from('job_applications').select('user_id').eq('job_id', job.id),
  ])
  const sentUser = new Set((recs || []).map((r) => r.user_id).filter(Boolean))
  const sentEmail = new Set((recs || []).map((r) => (r.to_email || '').toLowerCase()).filter(Boolean))
  const appliedUser = new Set((apps || []).map((a) => a.user_id).filter(Boolean))

  const { data: pool } = await sb.from('user_profiles')
    .select('id,email,full_name,position,headline,skills,yoe_months,major,experiences,resume_summary,english_cert,resume_url')
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
    console.log(`  [${score}] ${p.full_name} <${p.email}> — ${p.position || '?'} · ${Math.round(y / 12 * 10) / 10}y · 영어:${p.english_cert || '?'}`)
  }

  if (!doSend) { console.log('\n(dry-run — 실발송하려면 --send)'); return }

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
      event: 'recommend_sent', page: '/scripts/mpnx-recommend-coldmail',
      meta: { campaign, job_ids: [job.id] }, user_id: p.id,
    }])
    ok++
    await sleep(400)
  }
  console.log(`✅ 발송 완료: ${ok}/${list.length}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
