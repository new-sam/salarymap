// 현/직전연봉 수집 콜드메일 — 경력직 이력서 보유 회원에게 /salary-update?t=(개인 토큰) 발송.
// 랜딩은 로그인 없이 숫자 한 칸(백만 VND/월)만 받아 user_profiles.current_salary 에 저장.
// 퍼널: 발송(coldmail_salary_sent) → 클릭(coldmail_salary_click) → 입력(coldmail_salary_fill, meta.amount).
//
// 대상: 이력서 보유 + 경력 1개월 이상(yoe_months>=1 — 1년 미만도 월급을 받아봤으니 수집 가능,
//       유저 정정 8/13. 제외되는 건 경력 0 확인자와 yoe 미상뿐)
//       − likelion − 수신거부(coldmail_unsub) − 기발송(coldmail_salary_sent 전체, 1인 1회)
//       − current_salary 이미 기입 − 연봉위저드 제출 연결자(폴백 데이터 있음, --include-submitted 로 포함)
//
// ⚠️ 발송 전 선행: 20260813 DDL(current_salary) 적용 + /salary-update 랜딩 배포.
//
//   node scripts/outreach/salary-coldmail.mjs --test wsj@likelion.net  # 검수용 한국어 1통, 이벤트 기록 없음
//   node scripts/outreach/salary-coldmail.mjs                          # dry-run: 대상 집계
//   node scripts/outreach/salary-coldmail.mjs --send [--max N]         # 실발송 + coldmail_salary_sent 기록
//   재발송/리마인드는 --campaign salary-a-MMDD 로 캠페인명 분리(-MMDD 표준).
//   --resend      2차: 기발송자 중 미기입자에게 다른 프레임 재발송(1인1회 원칙의 의식적 예외 8/19,
//                 이번 캠페인명 발송済는 제외라 재실행 안전. 프레임 겹침 방지로 salary-c* 캠페인명과 함께 쓸 것)
//   --skip-today  오늘(로컬 자정 이후) 다른 캠페인 메일을 받은 사람 제외 — KTC 재발송 등 대량 발송일 중복 접촉 방지
//
// 프레임 A/B/C: 캠페인명이 salary-b* 면 B, salary-c* 면 C, 그 외는 A.
//   A(salary-a, 구 salary1) = "추천 잘하려면 연봉 알려달라" 정중한 ask
//   B(salary-b) = "추천 후보에 올랐는데 연봉 확인이 안 돼 보류 중 — 숫자 하나면 재개" 손실 프레임(photo1 구조)
//   C(salary-c) = "1차 대기 리스트에 올랐지만 연봉 미확인으로 최종 명단 탈락" — B보다 강한 손실(이미 잃음)+복구 프레임.
//                 62% 수치는 기업 VOC 실측(유저 확정 8/19).
import { Resend } from 'resend'
import { sb, env, fetchAll } from './lib.mjs'
import { makeToken } from '../../lib/campaignToken.js'
import { leadId } from '../../lib/ktcMailToken.js'

const args = process.argv.slice(2)
const flag = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d }
const testTo = flag('test', null)
const doSend = args.includes('--send')
const includeSubmitted = args.includes('--include-submitted')
const resendMode = args.includes('--resend')
const skipToday = args.includes('--skip-today')
const maxN = flag('max', null) ? parseInt(flag('max'), 10) : null
const CAMPAIGN = String(flag('campaign', 'salary-a'))
const SITE = String(flag('site', env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com')).replace(/\/$/, '')
const FROM = env.RESEND_FROM || 'FYI <hello@salary-fyi.com>'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const firstName = (n) => String(n || '').trim().split(/\s+/).slice(-1)[0] || 'bạn'

const COPY_A = {
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

// B 프레임 — photo1 검증 구조: 이미 후보에 올랐다(기회) + 연봉 미확인으로 보류(손실) + 숫자 하나면 재개(복구).
const COPY_B = {
  ...COPY_A,
  subject: {
    vi: 'Đề cử của bạn đang bị tạm dừng — vì chưa xác nhận được mức lương',
    ko: '회원님 추천이 보류 중입니다 — 연봉 확인이 안 돼서요',
  },
  p1: {
    vi: 'Người phụ trách đã đưa hồ sơ của bạn vào <b>danh sách đề cử cho các công ty</b>. Nhưng vì chưa biết mức lương hiện tại của bạn, chúng tôi không thể xác nhận vị trí có phù hợp mức lương hay không — <b>quá trình xem xét đang bị tạm dừng</b>.',
    ko: '담당자가 회원님 프로필을 <b>기업 추천 후보</b>에 올렸습니다. 그런데 현재 연봉을 몰라 연봉이 맞는 포지션인지 확인을 못 해 <b>검토가 멈춰 있어요</b>.',
  },
  p2: {
    vi: 'Chỉ cần cho chúng tôi biết <b>lương tháng hiện tại (hoặc ở công việc gần nhất)</b> — một con số, không cần đăng nhập, 30 giây — <b>việc xem xét sẽ được tiếp tục ngay</b>. Thông tin này <b>không hiển thị với công ty</b>.',
    ko: '<b>현재(또는 직전 직장) 월급</b> 숫자 하나만 알려주시면 <b>검토가 바로 재개됩니다</b> — 로그인 없이 30초. 이 정보는 <b>기업에 공개되지 않아요</b>.',
  },
  cta: { vi: 'Nhập mức lương để tiếp tục xem xét →', ko: '연봉 입력하고 검토 재개하기 →' },
}

// C 프레임 — photo 손실 프레임 이식(유저 초안 8/19): 1차 대기 리스트 등재(기회) + 연봉 미확인으로
// 최종 명단 탈락(이미 잃음) + 숫자 하나면 다음 명단(복구). "연봉을 몰라 판단이 애매하다"는 실제 운영 사실.
const COPY_C = {
  ...COPY_A,
  subject: {
    vi: 'Bạn chưa được chọn vào danh sách đề cử lần này — lý do: chưa xác nhận mức lương',
    ko: '회원님이 이번 추천 명단에서 제외되었습니다 — 사유: 연봉 미확인',
  },
  p1: {
    vi: 'Gần đây, khi chọn ứng viên để gửi offer cho doanh nghiệp, người phụ trách đã đưa hồ sơ của bạn vào <b>danh sách chờ vòng 1</b>. Nhưng rất tiếc, hồ sơ của bạn <b>không được chọn vào danh sách cuối cùng</b>.<br><br>Lý do: <b>chưa xác nhận được mức lương hiện tại của bạn</b>.',
    ko: '최근 기업에 보낼 오퍼 후보를 추리면서 담당자가 회원님 프로필을 <b>1차 대기 리스트</b>에 올렸습니다. 그런데 아쉽게도 <b>최종 명단에는 선정되지 못했습니다</b>.<br><br>사유: <b>현재 연봉이 확인되지 않아서</b>입니다.',
  },
  p2: {
    vi: 'Khi chưa biết mức lương, chúng tôi không thể xác định vị trí nào có điều kiện khiến bạn hài lòng, nên hồ sơ chưa xác nhận lương thường bị loại khỏi danh sách đề cử. Để không bỏ lỡ cơ hội tiếp theo, chỉ cần cho chúng tôi biết <b>lương tháng hiện tại (hoặc ở công việc gần nhất)</b> — một con số, không cần đăng nhập, 30 giây. <b>Hồ sơ đã xác nhận mức lương có tỷ lệ nhận offer cao hơn 62%.</b> Thông tin này <b>không hiển thị với công ty</b>.',
    ko: '연봉을 모르면 어떤 포지션이 회원님께 만족스러운 조건인지 판단할 수 없어, 연봉 미확인 프로필은 추천 명단에서 제외되는 경우가 많습니다. 다음 기회를 놓치지 않도록 <b>현재(또는 직전 직장) 월급</b> 숫자 하나만 알려주세요 — 로그인 없이 30초면 됩니다. <b>연봉이 확인된 프로필은 오퍼 확률이 62% 더 높습니다.</b> 이 정보는 <b>기업에 공개되지 않아요</b>.',
  },
  cta: { vi: 'Nhập mức lương để vào danh sách tiếp theo →', ko: '연봉 입력하고 다음 명단에 오르기 →' },
}

const COPY = /^salary-c/.test(CAMPAIGN) ? COPY_C : /^salary-b/.test(CAMPAIGN) ? COPY_B : COPY_A

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

  const [subs, unsubs, sents, fills] = await Promise.all([
    fetchAll(() => sb.from('submissions').select('user_id').not('user_id', 'is', null).order('created_at', { ascending: false })),
    fetchAll(() => sb.from('events').select('user_id').eq('event', 'coldmail_unsub').not('user_id', 'is', null).order('id')),
    fetchAll(() => sb.from('events').select('user_id, meta').eq('event', 'coldmail_salary_sent').not('user_id', 'is', null).order('id')),
    fetchAll(() => sb.from('events').select('user_id').eq('event', 'coldmail_salary_fill').not('user_id', 'is', null).order('id')),
  ])
  const subSet = new Set(subs.map((r) => r.user_id))
  const unsubSet = new Set(unsubs.map((r) => r.user_id))
  const sentSet = new Set(sents.map((r) => r.user_id)) // 연봉 계열 전체 — 1인 1회
  const sentThis = new Set(sents.filter((r) => r.meta?.campaign === CAMPAIGN).map((r) => r.user_id)) // 재실행 dedup
  const fillSet = new Set(fills.map((r) => r.user_id))

  // 오늘 접촉자(모든 캠페인) — 회원 발송은 user_id, KTC 계열 비회원 발송은 lead 해시로 대조
  const todayUserIds = new Set(), todayLeads = new Set()
  if (skipToday) {
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0)
    const todayEvts = await fetchAll(() => sb.from('events').select('user_id, meta')
      .gte('created_at', dayStart.toISOString()).like('event', '%sent%').order('id'))
    for (const e of todayEvts) {
      if (e.user_id) todayUserIds.add(e.user_id)
      if (e.meta?.lead) todayLeads.add(e.meta.lead)
    }
  }

  const seen = new Set()
  const cohort = pool.filter((p) => {
    if (!p.email || /likelion/i.test(p.email)) return false
    if ((p.yoe_months ?? 0) < 1) return false
    if (p.current_salary) return false
    if (unsubSet.has(p.id)) return false
    if (resendMode) {
      // 2차 = 기발송 ∧ 미기입(랜딩 fill 없음 — current_salary 기입자는 위에서 이미 제외) ∧ 이번 캠페인 미발송
      if (!sentSet.has(p.id) || fillSet.has(p.id) || sentThis.has(p.id)) return false
    } else if (sentSet.has(p.id)) return false
    if (!includeSubmitted && subSet.has(p.id)) return false
    if (skipToday && (todayUserIds.has(p.id) || todayLeads.has(leadId(p.email.toLowerCase())))) return false
    const e = p.email.toLowerCase()
    if (seen.has(e)) return false
    seen.add(e)
    return true
  })

  console.log(resendMode
    ? `대상 ${cohort.length}명 (기발송 ${sentSet.size} 중 미기입·미수신거부${skipToday ? '·오늘 미접촉' : ''}, 이번 캠페인済 ${sentThis.size} 제외) · 캠페인 ${CAMPAIGN}`
    : `대상 ${cohort.length}명 (이력서 보유 ${pool.length} 중 경력 1개월+ · likelion/수신거부 ${unsubSet.size}/기발송 ${sentSet.size}/기입자/제출연결${includeSubmitted ? '(포함)' : ''}${skipToday ? '/오늘 접촉' : ''} 제외) · 캠페인 ${CAMPAIGN}`)
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
