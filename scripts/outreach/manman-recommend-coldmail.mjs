// Man Man Market(MA3201 E-commerce Content Designer) 단일 공고 추천 콜드메일 — nalda/mpnx 패턴.
// 디자이너 풀이 얇아 공개+비공개 이력서 모두 대상, 프레임만 분리:
//   공개  → "Man Man 담당자가 이력서를 보고 보냈다 · 우선 검토" (nalda/mpnx와 동일)
//   비공개 → "FYI가 프로필 기반으로 담당자에게 추천했다" (담당자가 봤다는 주장 없음 — 비공개라 거짓이 됨)
// 둘 다 /api/resume/recommend 랜딩 → 원탭 지원. KTC 리드는 유저 결정으로 제외(2026-07-29).
// 측정: 캠페인 manman-recommend1.
//
//   node scripts/outreach/manman-recommend-coldmail.mjs --test wsj@likelion.net  # 테스트 1통(공개 프레임)
//   node scripts/outreach/manman-recommend-coldmail.mjs                          # dry-run
//   node scripts/outreach/manman-recommend-coldmail.mjs --send [--max N]
import { Resend } from 'resend'
import { sb, env } from './lib.mjs'
import { makeToken } from '../../lib/campaignToken.js'

const JOB_SOURCE_ID = 'MA3201'
const JOB_LOCATION_DISPLAY = 'Đà Nẵng · Hà Nội · TP.HCM' // jobs.location 이 'Korean' 으로 잘못 들어있어 표기 고정

const args = process.argv.slice(2)
const flag = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d }
const testTo = flag('test', null)
const doSend = args.includes('--send')
const campaign = flag('campaign', 'manman-recommend1')
const SITE = String(flag('site', env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com')).replace(/\/$/, '')
const RESEND_FROM = env.RESEND_FROM || 'FYI <hello@salary-fyi.com>'
const maxN = flag('max', null) ? parseInt(flag('max'), 10) : null
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

// ── JD 매칭: 디자인 핵심 툴 + 콘텐츠/커머스 신호 + 경력 1.5y+ ──
const hayOf = (p) => [
  ...(Array.isArray(p.skills) ? p.skills : []),
  p.headline, p.position, p.major,
  JSON.stringify(p.experiences || []),
  JSON.stringify(p.resume_summary || {}),
].map((s) => String(s || '').toLowerCase()).join(' | ')

const CORE_TOOL = ['photoshop', 'illustrator', 'canva', 'indesign', 'after effects', 'graphic design', 'graphic designer', 'thiết kế đồ họa', 'thiết kế đồ hoạ']
const CONTENT_SIG = ['social media', 'content', 'sns', 'instagram', 'tiktok', 'e-commerce', 'ecommerce', 'thương mại điện tử', 'banner', 'poster', 'branding', 'marketing', 'card news', 'shopee', 'lazada']

function scoreProfile(p) {
  const y = p.yoe_months
  if (y == null || y < 18) return null
  const hay = hayOf(p)
  const tools = CORE_TOOL.filter((k) => hay.includes(k))
  if (!tools.length) return null
  const sig = CONTENT_SIG.filter((k) => hay.includes(k))
  if (!sig.length) return null
  const isDesigner = String(p.position || '').toLowerCase() === 'design' || /design/i.test(p.headline || '')
  const eng = (p.english_cert || '').trim()
  const engOk = /ielts|toeic|toefl|fluent|advanced|business|b1|b2|professional|vstep/i.test(eng)
  return (isDesigner ? 3 : 0) + tools.length + Math.min(sig.length, 4) + (engOk ? 2 : 0) + (y >= 24 ? 1 : 0)
}

const firstName = (n) => String(n || '').trim().split(/\s+/).slice(-1)[0] || 'bạn'

// 공개/비공개 프레임 분리 — intro 문장만 다르고 나머지 동일
const INTRO = {
  public: 'Nhà tuyển dụng của <b>Man Man Market</b> — doanh nghiệp bán lẻ & thương mại điện tử Hàn Quốc, bán hàng qua kênh KakaoTalk — đã xem hồ sơ của bạn trên FYI và <b>gửi cho bạn vị trí này</b> vì kinh nghiệm thiết kế của bạn phù hợp với yêu cầu.',
  private: 'Dựa trên hồ sơ bạn đã đăng ký trên FYI, chúng tôi đã <b>giới thiệu bạn với nhà tuyển dụng Man Man Market</b> — doanh nghiệp bán lẻ & thương mại điện tử Hàn Quốc, bán hàng qua kênh KakaoTalk. Vị trí dưới đây phù hợp với kinh nghiệm thiết kế của bạn.',
}
const INTRO_TEXT = {
  public: 'Nhà tuyển dụng của Man Man Market — doanh nghiệp bán lẻ & thương mại điện tử Hàn Quốc, bán hàng qua kênh KakaoTalk — đã xem hồ sơ của bạn trên FYI và gửi cho bạn vị trí này vì kinh nghiệm thiết kế của bạn phù hợp.',
  private: 'Dựa trên hồ sơ bạn đã đăng ký trên FYI, chúng tôi đã giới thiệu bạn với nhà tuyển dụng Man Man Market — doanh nghiệp bán lẻ & thương mại điện tử Hàn Quốc, bán hàng qua kênh KakaoTalk. Vị trí dưới đây phù hợp với kinh nghiệm thiết kế của bạn.',
}
const SUBJECT = {
  public: '[FYI] Man Man Market đã xem hồ sơ của bạn và mời bạn ứng tuyển',
  private: '[FYI] Man Man Market đang tuyển vị trí phù hợp với hồ sơ thiết kế của bạn',
}

function emailHtml(name, url, job, frame) {
  const logo = job.logo_url
    ? `<img src="${esc(job.logo_url)}" width="44" height="44" alt="" style="width:44px;height:44px;border-radius:10px;object-fit:cover;background:#f0ebe3;display:block">`
    : `<div style="width:44px;height:44px;border-radius:10px;background:#fff0e6;color:#ff6000;font-weight:800;font-size:16px;text-align:center;line-height:44px">M</div>`
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1612">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f7"><tr><td align="center" style="padding:28px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
  <tr><td style="font-size:20px;font-weight:800;color:#ff6000;padding-bottom:18px">FYI</td></tr>
  <tr><td style="font-size:15px;line-height:1.6;color:#1a1612;padding-bottom:6px">Chào ${esc(firstName(name))},</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:18px">${INTRO[frame]}</td></tr>
  <tr><td style="padding-bottom:14px">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #eee5da;border-radius:14px"><tr>
      <td width="44" style="padding:14px 0 14px 14px;vertical-align:middle">${logo}</td>
      <td style="padding:14px 14px 14px 12px;vertical-align:middle">
        <div style="font-size:12px;color:#8a8073;margin-bottom:3px">${esc(job.company)}</div>
        <div style="font-size:14.5px;font-weight:700;color:#1a1612;line-height:1.35">${esc(job.title)}</div>
        <div style="font-size:12px;color:#b0691a;margin-top:3px">${esc(JOB_LOCATION_DISPLAY)}</div>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:6px">
    Vị trí thiết kế nội dung bán hàng cho kênh KakaoTalk (card news, social content, ấn phẩm quảng bá) — làm việc trực tiếp với trụ sở Hàn Quốc bằng <b>tiếng Anh hoặc tiếng Hàn</b>.${frame === 'public' ? ' Vì đây là lời mời trực tiếp từ nhà tuyển dụng, hồ sơ của bạn sẽ được <b>ưu tiên xem xét</b> khi ứng tuyển.' : ''} Chỉ cần <b>1 chạm</b> — CV đã đăng ký của bạn sẽ được gửi tự động.
  </td></tr>
  <tr><td align="center" style="padding:16px 0 6px">
    <a href="${url}" style="display:inline-block;background:#ff6000;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 30px;border-radius:12px">Ứng tuyển 1 chạm →</a>
  </td></tr>
  <tr><td style="font-size:11.5px;color:#a89f92;text-align:center;line-height:1.5;padding-top:20px">
    Bạn nhận được email này vì đã đăng ký hồ sơ trên FYI.<br>— Đội ngũ FYI · <a href="https://salary-fyi.com/jobs" style="color:#a89f92">salary-fyi.com/jobs</a>
  </td></tr>
</table></td></tr></table></body></html>`
}

function emailText(name, url, job, frame) {
  return `Chào ${firstName(name)},

${INTRO_TEXT[frame]}

${job.title} — ${job.company} (${JOB_LOCATION_DISPLAY})

Vị trí thiết kế nội dung bán hàng cho kênh KakaoTalk (card news, social content, ấn phẩm quảng bá) — làm việc trực tiếp với trụ sở Hàn Quốc bằng tiếng Anh hoặc tiếng Hàn.${frame === 'public' ? ' Vì đây là lời mời trực tiếp từ nhà tuyển dụng, hồ sơ của bạn sẽ được ưu tiên xem xét khi ứng tuyển.' : ''} Ứng tuyển chỉ với 1 chạm — CV của bạn được gửi tự động:

${url}

— Đội ngũ FYI · salary-fyi.com/jobs`
}

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
      from: RESEND_FROM, to: p.email, subject: SUBJECT.public,
      text: emailText(p.full_name, u, job, 'public'), html: emailHtml(p.full_name, u, job, 'public'),
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

  // 디자이너 풀이 얇아 비공개 이력서도 포함(프레임 분리) — nalda/mpnx와 다른 점
  const { data: pool } = await sb.from('user_profiles')
    .select('id,email,full_name,position,headline,skills,yoe_months,major,experiences,resume_summary,english_cert,resume_url,is_resume_public')
    .not('resume_url', 'is', null)
  const cohort = []
  for (const p of (pool || [])) {
    if (!p.resume_url || !p.email || /likelion/i.test(p.email)) continue
    if (sentUser.has(p.id) || sentEmail.has(p.email.toLowerCase()) || appliedUser.has(p.id)) continue
    const score = scoreProfile(p)
    if (score == null) continue
    cohort.push({ p, score, frame: p.is_resume_public ? 'public' : 'private' })
  }
  cohort.sort((a, b) => b.score - a.score)

  console.log(`대상: ${cohort.length}명 (공개 ${cohort.filter((c) => c.frame === 'public').length} / 비공개 ${cohort.filter((c) => c.frame === 'private').length})`)
  for (const { p, score, frame } of cohort) {
    const y = p.yoe_months
    console.log(`  [${score}·${frame === 'public' ? '공개' : '비공개'}] ${p.full_name} <${p.email}> — ${p.position || '?'} · ${Math.round(y / 12 * 10) / 10}y · 영어:${p.english_cert || '?'}`)
  }

  if (!doSend) { console.log('\n(dry-run — 실발송하려면 --send)'); return }

  const list = maxN ? cohort.slice(0, maxN) : cohort
  let ok = 0
  for (const { p, frame } of list) {
    const { error } = await resend.emails.send({
      from: RESEND_FROM, to: p.email, subject: SUBJECT[frame],
      text: emailText(p.full_name, url(p.id), job, frame), html: emailHtml(p.full_name, url(p.id), job, frame),
    })
    if (error) { console.error(`실패 ${p.email}:`, error.message || error); continue }
    await sb.from('job_recommendations').upsert([{
      user_id: p.id, to_email: p.email, job_id: job.id,
      job_title: job.title, job_company: job.company, sent_by: 'coldmail', kind: 'recommend', status: 'sent',
    }], { onConflict: 'user_id,job_id', ignoreDuplicates: true })
    await sb.from('events').insert([{
      event: 'recommend_sent', page: '/scripts/manman-recommend-coldmail',
      meta: { campaign, job_ids: [job.id], frame }, user_id: p.id,
    }])
    ok++
    await sleep(400)
  }
  console.log(`✅ 발송 완료: ${ok}/${list.length}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
