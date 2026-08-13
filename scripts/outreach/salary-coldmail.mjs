// 현/직전연봉 수집 콜드메일 — 경력직 이력서 보유 회원에게 /salary-update?t=(개인 토큰) 발송.
// 랜딩은 로그인 없이 숫자 한 칸(백만 VND/월)만 받아 user_profiles.current_salary 에 저장.
// 퍼널: 발송(coldmail_salary_sent) → 클릭(coldmail_salary_click) → 입력(coldmail_salary_fill, meta.amount).
//
// 대상: 이력서 보유 + 경력 1년 이상(yoe_months>=12, 신입 제외 — 현/직전연봉이 없어 애매)
//       − likelion − 수신거부(coldmail_unsub) − 기발송(coldmail_salary_sent 전체, 1인 1회)
//       − current_salary 이미 기입 − 연봉위저드 제출 연결자(폴백 데이터 있음, --include-submitted 로 포함)
//
// ⚠️ 발송 전 선행: 20260813 DDL(current_salary) 적용 + /salary-update 랜딩 배포.
//
//   node scripts/outreach/salary-coldmail.mjs --test wsj@likelion.net  # 검수용 한국어 1통, 이벤트 기록 없음
//   node scripts/outreach/salary-coldmail.mjs                          # dry-run: 대상 집계
//   node scripts/outreach/salary-coldmail.mjs --send [--max N]         # 실발송 + coldmail_salary_sent 기록
//   재발송/리마인드는 --campaign salary1-MMDD 로 캠페인명 분리(-MMDD 표준).
import { Resend } from 'resend'
import { sb, env, fetchAll } from './lib.mjs'
import { makeToken } from '../../lib/campaignToken.js'

const args = process.argv.slice(2)
const flag = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d }
const testTo = flag('test', null)
const doSend = args.includes('--send')
const includeSubmitted = args.includes('--include-submitted')
const maxN = flag('max', null) ? parseInt(flag('max'), 10) : null
const CAMPAIGN = String(flag('campaign', 'salary1'))
const SITE = String(flag('site', env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com')).replace(/\/$/, '')
const FROM = env.RESEND_FROM || 'FYI <hello@salary-fyi.com>'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const firstName = (n) => String(n || '').trim().split(/\s+/).slice(-1)[0] || 'bạn'

const COPY = {
  subject: {
    vi: 'FYI đang tiến cử bạn với các công ty — chỉ cần cho chúng tôi 1 con số',
    ko: 'FYI가 회원님을 기업에 추천하고 있어요 — 숫자 하나만 알려주세요',
  },
  hi: { vi: (n) => `Chào ${n},`, ko: (n) => `안녕하세요 ${n}님,` },
  p1: {
    vi: 'FYI đang trực tiếp tiến cử hồ sơ của bạn với các công ty. Khi biết mức lương của bạn, chúng tôi có thể <b>chỉ chọn những công ty có mức lương khiến bạn thực sự hài lòng</b> để tiến cử — mục tiêu của chúng tôi là giúp bạn chuyển việc với mức lương cao hơn.',
    ko: 'FYI는 회원님 프로필을 기업에 직접 추천하고 있어요. 연봉을 알면 <b>정말 만족할 만한 연봉의 기업만 골라서</b> 추천할 수 있습니다 — 저희 목표는 회원님이 더 높은 연봉으로 이직하는 거예요.',
  },
  p2: {
    vi: 'Vì vậy, chỉ cần cho chúng tôi biết <b>lương tháng hiện tại (hoặc ở công việc gần nhất)</b> của bạn — một con số, không cần đăng nhập, 30 giây. Thông tin này <b>không hiển thị với công ty</b>, chỉ dùng để chọn công ty xứng đáng với bạn.',
    ko: '그래서 <b>현재(또는 직전 직장) 월급</b> 숫자 하나만 부탁드려요 — 로그인 없이 30초면 됩니다. 이 정보는 <b>기업에 공개되지 않고</b>, 회원님이 만족할 기업을 고르는 데만 사용돼요.',
  },
  cta: { vi: 'Nhập mức lương (30 giây) →', ko: '연봉 입력하기 (30초) →' },
  thanks: { vi: 'Cảm ơn bạn!<br>— Đội ngũ FYI', ko: '감사합니다!<br>— FYI 팀 드림' },
  footer: {
    vi: 'Bạn nhận được email này vì đã đăng ký tài khoản trên FYI.',
    ko: 'FYI에 가입하셔서 이 메일을 받으셨습니다.',
  },
  unsub: { vi: 'Hủy nhận email', ko: '수신 거부' },
}

function emailHtml(name, url, unsubUrl, lang) {
  const L = (o) => o[lang] || o.vi
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1612">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f7"><tr><td align="center" style="padding:28px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
  <tr><td style="padding-bottom:18px"><img src="https://salary-fyi.com/fyi-logo.png" height="24" alt="FYI" style="height:24px;width:auto;display:block"></td></tr>
  <tr><td style="font-size:15px;line-height:1.6;color:#1a1612;padding-bottom:6px">${L(COPY.hi)(esc(firstName(name)))}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:14px">${L(COPY.p1)}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:6px">${L(COPY.p2)}</td></tr>
  <tr><td align="center" style="padding:16px 0 6px">
    <a href="${url}" style="display:inline-block;background:#ff6000;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 30px;border-radius:12px">${L(COPY.cta)}</a>
  </td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-top:14px">${L(COPY.thanks)}</td></tr>
  <tr><td style="font-size:11.5px;color:#a89f92;text-align:center;line-height:1.5;padding-top:20px">
    ${L(COPY.footer)}<br>— FYI · <a href="https://salary-fyi.com" style="color:#a89f92">salary-fyi.com</a>
    &nbsp;·&nbsp;<a href="${unsubUrl}" style="color:#a89f92;text-decoration:underline">${L(COPY.unsub)}</a>
  </td></tr>
</table></td></tr></table></body></html>`
}

const strip = (s) => String(s).replace(/<br>/g, '\n').replace(/<[^>]+>/g, '')
function emailText(name, url, unsubUrl, lang) {
  const L = (o) => o[lang] || o.vi
  return `${L(COPY.hi)(firstName(name))}

${strip(L(COPY.p1))}

${strip(L(COPY.p2))}

${url}

${strip(L(COPY.thanks))}

${strip(L(COPY.footer))}
${strip(L(COPY.unsub))}: ${unsubUrl}`
}

async function main() {
  const resend = new Resend(env.RESEND_API_KEY)
  const landingUrl = (userId) => `${SITE}/salary-update?t=${makeToken(userId, CAMPAIGN)}`
  const unsubFor = (userId) => `${SITE}/api/coldmail/unsub?t=${makeToken(userId, CAMPAIGN)}`

  // ── 검수용 테스트: 한국어 1통, 이벤트 기록 없음 ──
  if (testTo) {
    const { data: rows } = await sb.from('user_profiles').select('id,email,full_name').ilike('email', testTo).limit(1)
    const p = rows?.[0]
    if (!p) { console.error(`계정 없음: ${testTo}`); process.exit(1) }
    const u = landingUrl(p.id), un = unsubFor(p.id)
    const { error } = await resend.emails.send({
      from: FROM, to: p.email, subject: COPY.subject.ko,
      html: emailHtml(p.full_name, u, un, 'ko'), text: emailText(p.full_name, u, un, 'ko'),
      headers: { 'List-Unsubscribe': `<${un}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    })
    if (error) { console.error('발송 실패:', error.message || error); process.exit(1) }
    console.log(`✓ 한국어 테스트: ${p.email}\n  링크: ${u}\n※ 실발송(--send)은 베트남어로 나갑니다. 이 테스트는 events에 기록하지 않습니다.`)
    return
  }

  // ── 대상 산정 ──
  // current_salary 는 DDL(20260813) 적용 전엔 컬럼이 없다 — 그땐 빼고 읽는다(기입자 0명이므로 동일).
  const selectPool = (cols) => fetchAll(() => sb.from('user_profiles').select(cols)
    .not('email', 'is', null).not('resume_url', 'is', null).order('created_at', { ascending: false }))
  let pool
  try { pool = await selectPool('id,email,full_name,yoe_months,current_salary') }
  catch { pool = (await selectPool('id,email,full_name,yoe_months')).map((p) => ({ ...p, current_salary: null })) }

  const [subs, unsubs, sents] = await Promise.all([
    fetchAll(() => sb.from('submissions').select('user_id').not('user_id', 'is', null).order('created_at', { ascending: false })),
    fetchAll(() => sb.from('events').select('user_id').eq('event', 'coldmail_unsub').not('user_id', 'is', null).order('id')),
    fetchAll(() => sb.from('events').select('user_id').eq('event', 'coldmail_salary_sent').not('user_id', 'is', null).order('id')),
  ])
  const subSet = new Set(subs.map((r) => r.user_id))
  const unsubSet = new Set(unsubs.map((r) => r.user_id))
  const sentSet = new Set(sents.map((r) => r.user_id)) // 연봉 계열 전체 — 1인 1회
  const seen = new Set()
  const cohort = pool.filter((p) => {
    if (!p.email || /likelion/i.test(p.email)) return false
    if ((p.yoe_months ?? 0) < 12) return false
    if (p.current_salary) return false
    if (unsubSet.has(p.id) || sentSet.has(p.id)) return false
    if (!includeSubmitted && subSet.has(p.id)) return false
    const e = p.email.toLowerCase()
    if (seen.has(e)) return false
    seen.add(e)
    return true
  })

  console.log(`대상 ${cohort.length}명 (이력서 보유 ${pool.length} 중 경력 1년+ · likelion/수신거부 ${unsubSet.size}/기발송 ${sentSet.size}/기입자/제출연결${includeSubmitted ? '(포함)' : ''} 제외) · 캠페인 ${CAMPAIGN}`)
  if (!doSend) {
    for (const p of cohort.slice(0, 20)) console.log(`  ${p.full_name || '(이름없음)'} <${p.email}> · yoe ${p.yoe_months}m`)
    if (cohort.length > 20) console.log(`  … 외 ${cohort.length - 20}명`)
    console.log('\n(dry-run — 실발송하려면 --send, 개수 제한은 --max N)')
    return
  }

  const list = maxN ? cohort.slice(0, maxN) : cohort
  let ok = 0
  const fails = []
  for (const p of list) {
    const u = landingUrl(p.id), un = unsubFor(p.id)
    const { error } = await resend.emails.send({
      from: FROM, to: p.email, subject: COPY.subject.vi,
      html: emailHtml(p.full_name, u, un, 'vi'), text: emailText(p.full_name, u, un, 'vi'),
      headers: { 'List-Unsubscribe': `<${un}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    })
    if (error) { fails.push(p.email); console.error(`실패 ${p.email}:`, error.message || error); continue }
    await sb.from('events').insert([{
      event: 'coldmail_salary_sent', page: '/scripts/salary-coldmail',
      meta: { campaign: CAMPAIGN }, user_id: p.id,
    }])
    ok++
    if (ok % 25 === 0) console.log(`  …${ok}/${list.length}`)
    await sleep(400)
  }
  console.log(`\n✅ 발송 완료: ${ok}/${list.length}${fails.length ? ` · 실패 ${fails.length}: ${fails.join(', ')}` : ''}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
