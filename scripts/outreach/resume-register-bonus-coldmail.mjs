// 이력서 등록 유도 — 축하금 손실 프레임 (8/18). 가입했지만 이력서가 없는 회원 대상.
// 훅: "아직 1,000,000₫ 취업 축하금 이벤트 대상이 아니다"(coldmail1에서 검증된 손실 프레임).
// 이전 resume-register v1·v2(혜택 프레임)와 달리 수치는 축하금 금액·실제 지급 조건만 쓴다.
// 버튼 → /api/resume/upload 토큰 랜딩(캠페인명이 bonus면 축하금 배리언트로 렌더).
// 축하금 조건은 /cv 랜딩(cv.how.notice)과 동일 문구 — 베트남 현지 기업 공고 · 입사 60일 근속 후 지급.
//
//   node scripts/outreach/resume-register-bonus-coldmail.mjs --test wsj@likelion.net  # 한국어 테스트 1통
//   node scripts/outreach/resume-register-bonus-coldmail.mjs                          # dry-run: 대상 목록
//   node scripts/outreach/resume-register-bonus-coldmail.mjs --send [--max N]         # 실발송(베트남어)
//   옵션: --segment apply|rest|all · --campaign resume-register-bonus1-apply · --site http://localhost:3000
import { Resend } from 'resend'
import { sb, env } from './lib.mjs'
import { makeToken } from '../../lib/campaignToken.js'

const args = process.argv.slice(2)
const flag = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d }
const testTo = flag('test', null)
const doSend = args.includes('--send')
const segment = String(flag('segment', 'apply'))
const campaign = String(flag('campaign', `resume-register-bonus1-${segment}`))
const SITE = String(flag('site', env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com')).replace(/\/$/, '')
const RESEND_FROM = env.RESEND_FROM || 'FYI <hello@salary-fyi.com>'
const maxN = flag('max', null) ? parseInt(flag('max'), 10) : null
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

async function fetchAll(build) {
  let all = []
  let from = 0
  for (;;) {
    const { data, error } = await build().range(from, from + 999)
    if (error) throw error
    if (!data || !data.length) break
    all = all.concat(data)
    if (data.length < 1000) break
    from += 1000
  }
  return all
}

// ── 메일 본문 ──
// 실발송은 베트남어. 테스트(--test)는 검수용 한국어로 같은 구조를 보낸다.
const firstName = (n) => String(n || '').trim().split(/\s+/).slice(-1)[0]

const COPY = {
  vi: {
    subject: (n) => n
      ? `${n} ơi, bạn chưa đủ điều kiện nhận thưởng 1.000.000₫`
      : 'Bạn chưa đủ điều kiện nhận thưởng 1.000.000₫',
    hi: (n) => `Chào ${n || 'bạn'},`,
    lead: 'Bạn chưa đủ điều kiện nhận thưởng 1.000.000₫.',
    body: 'Bạn đã có tài khoản FYI nhưng chưa đăng ký CV — vì vậy bạn chưa thể tham gia sự kiện thưởng 1.000.000₫ khi được tuyển qua FYI.',
    stepsIntro: 'Chỉ cần một bước để tham gia:',
    li1: 'Tải lên file CV — khoảng 30 giây, không cần nhập thêm thông tin',
    li2: 'Nhà tuyển dụng phù hợp xem hồ sơ và chủ động liên hệ bạn',
    li3: 'Được tuyển qua FYI → nhận thưởng 1.000.000₫',
    cta: 'Đăng ký CV & tham gia sự kiện →',
    note: 'Không cần đăng nhập · PDF / DOCX · khoảng 30 giây',
    cond: 'Thưởng chỉ áp dụng cho vị trí tại doanh nghiệp Việt Nam, chi trả sau 2 tháng (60 ngày) làm việc.',
    foot: 'Bạn nhận email này vì đã đăng ký tài khoản FYI.',
    unsub: 'Hủy đăng ký',
  },
  ko: {
    subject: (n) => `[테스트] ${n || '회원'}님, 아직 1,000,000₫ 이벤트 대상이 아니에요`,
    hi: (n) => `${n || '회원'}님, 안녕하세요.`,
    lead: '아직 1,000,000₫ 축하금 이벤트 대상이 아닙니다.',
    body: 'FYI 계정은 있으신데 아직 CV가 등록되어 있지 않네요 — 그래서 지금은 FYI를 통해 채용될 때 지급되는 1,000,000₫ 취업 축하금 이벤트에 참여하실 수 없습니다.',
    stepsIntro: '참여 방법은 하나뿐입니다:',
    li1: 'CV 파일 업로드 — 약 30초, 추가 입력 없음',
    li2: '맞는 기업이 프로필을 보고 먼저 연락합니다',
    li3: 'FYI를 통해 채용되면 1,000,000₫ 축하금 지급 대상이 됩니다',
    cta: 'CV 올리고 이벤트 참여 →',
    note: '로그인 불필요 · PDF / DOCX · 약 30초',
    cond: '축하금은 베트남 현지 기업 공고에 한해 적용되며, 입사 후 2개월(60일) 근속이 확인된 뒤 지급됩니다.',
    foot: 'FYI에 가입하셔서 이 메일을 받으셨습니다.',
    unsub: '수신 거부',
  },
}

function emailHtml(name, url, unsubUrl, c) {
  const li = (t) => `<li style="margin:0 0 8px">${esc(t)}</li>`
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f2ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1612">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ee"><tr><td align="center" style="padding:32px 16px 40px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">
  <tr><td style="font-size:17px;font-weight:800;color:#ff6000;letter-spacing:-0.01em;padding-bottom:14px">FYI</td></tr>
  <tr><td style="background:#ffffff;border-radius:18px;padding:32px 28px 28px">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="font-size:13.5px;color:#8a8177;padding-bottom:12px">${esc(c.hi(firstName(name)))}</td></tr>
      <tr><td style="font-size:20px;font-weight:800;line-height:1.45;letter-spacing:-0.01em;padding-bottom:16px;word-break:keep-all">${esc(c.lead)}</td></tr>
      <tr><td style="font-size:14px;line-height:1.7;color:#57504a;padding-bottom:18px;word-break:keep-all">${esc(c.body)}</td></tr>
      <tr><td style="border-top:1px solid #eeeae4;padding-top:18px;font-size:14px;font-weight:700;color:#1a1612;padding-bottom:10px">${esc(c.stepsIntro)}</td></tr>
      <tr><td><ul style="font-size:14px;line-height:1.6;color:#57504a;margin:0 0 20px;padding-left:20px;word-break:keep-all">${li(c.li1)}${li(c.li2)}${li(c.li3)}</ul></td></tr>
      <tr><td>
        <a href="${url}" style="display:block;background:#ff6000;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:16px;border-radius:12px;text-align:center">${esc(c.cta)}</a>
      </td></tr>
      <tr><td style="font-size:12.5px;color:#9a9186;text-align:center;padding-top:12px">${esc(c.note)}</td></tr>
      <tr><td style="font-size:12px;color:#9a9186;line-height:1.6;padding-top:18px;word-break:keep-all">${esc(c.cond)}</td></tr>
    </table>
  </td></tr>
  <tr><td style="font-size:11.5px;color:#a8a096;text-align:center;line-height:1.6;padding-top:20px">
    ${esc(c.foot)}<br><a href="https://salary-fyi.com/jobs" style="color:#a8a096">salary-fyi.com</a>
    &nbsp;·&nbsp;<a href="${unsubUrl}" style="color:#a8a096;text-decoration:underline">${esc(c.unsub)}</a>
  </td></tr>
</table></td></tr></table></body></html>`
}

const emailText = (name, url, unsubUrl, c) => `${c.hi(firstName(name))}

${c.lead}

${c.body}

${c.stepsIntro}
- ${c.li1}
- ${c.li2}
- ${c.li3}

${c.cta}
${url}

${c.cond}

— FYI · salary-fyi.com
${c.unsub}: ${unsubUrl}`

// ── 대상 선정 ── (v2와 동일: 이력서 없음 + 미지원 + 미수신거부. 이 캠페인 기수신자만 제외 —
// v1·v2 수신자도 오퍼가 다르므로 재접촉 대상에 포함한다.)
async function pickTargets() {
  const [profiles, apps] = await Promise.all([
    fetchAll(() => sb.from('user_profiles').select('id, email, full_name, resume_url, created_at')),
    fetchAll(() => sb.from('job_applications').select('user_id').not('user_id', 'is', null)),
  ])
  const applied = new Set(apps.map((a) => a.user_id))
  const pool = profiles.filter((p) => (
    !String(p.resume_url || '').trim() &&
    /@/.test(p.email || '') &&
    !/@likelion\.net$/i.test(p.email) &&
    !applied.has(p.id)
  ))

  const sent = new Set((await fetchAll(() => sb.from('events')
    .select('user_id, meta').eq('event', 'coldmail_resume_sent').not('user_id', 'is', null)))
    .filter((e) => e.meta?.campaign === campaign).map((e) => e.user_id))

  const unsubbed = new Set((await fetchAll(() => sb.from('events')
    .select('user_id').eq('event', 'coldmail_unsub').not('user_id', 'is', null)))
    .map((e) => e.user_id))

  const ev = await fetchAll(() => sb.from('events')
    .select('event, user_id').eq('event', 'click_apply_button').not('user_id', 'is', null))
  const applyClickers = new Set(ev.map((e) => e.user_id))

  const inSegment = (p) => (
    segment === 'all' ? true
      : segment === 'apply' ? applyClickers.has(p.id)
        : !applyClickers.has(p.id)
  )
  return pool.filter((p) => inSegment(p) && !sent.has(p.id) && !unsubbed.has(p.id))
}

async function main() {
  const resend = new Resend(env.RESEND_API_KEY)
  const linkFor = (userId) => `${SITE}/api/resume/upload?t=${makeToken(userId, campaign)}`
  const unsubFor = (userId) => `${SITE}/api/coldmail/unsub?t=${makeToken(userId, campaign)}`

  if (testTo) {
    const { data: rows } = await sb.from('user_profiles').select('id, email, full_name').ilike('email', testTo).limit(1)
    const p = rows?.[0]
    if (!p) { console.error(`계정 없음: ${testTo}`); process.exit(1) }
    const c = COPY.ko // 검수용 한국어
    const url = linkFor(p.id)
    const unsub = unsubFor(p.id)
    const { error } = await resend.emails.send({
      from: RESEND_FROM, to: p.email, subject: c.subject(firstName(p.full_name)),
      html: emailHtml(p.full_name, url, unsub, c), text: emailText(p.full_name, url, unsub, c),
      headers: { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    })
    if (error) { console.error('발송 실패:', error.message || error); process.exit(1) }
    console.log(`✓ 한국어 테스트 발송: ${p.email}`)
    console.log(`  링크: ${url}`)
    console.log('  ※ 실발송(--send)은 베트남어로 나갑니다. 이 테스트는 events에 기록하지 않습니다.')
    return
  }

  const targets = await pickTargets()
  console.log(`세그먼트 '${segment}' 대상: ${targets.length}명 · 캠페인 ${campaign}`)
  if (!doSend) {
    console.log('dry-run — 실발송하려면 --send')
    targets.slice(0, 20).forEach((p) => console.log(`  ${p.email}  ${p.full_name || ''}`))
    if (targets.length > 20) console.log(`  ... 외 ${targets.length - 20}명`)
    return
  }

  const list = maxN ? targets.slice(0, maxN) : targets
  const c = COPY.vi
  let ok = 0
  let fail = 0
  for (const p of list) {
    const url = linkFor(p.id)
    const unsub = unsubFor(p.id)
    const { error } = await resend.emails.send({
      from: RESEND_FROM, to: p.email, subject: c.subject(firstName(p.full_name)),
      html: emailHtml(p.full_name, url, unsub, c), text: emailText(p.full_name, url, unsub, c),
      headers: { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    })
    if (error) { fail++; console.log(`  ✗ ${p.email}: ${error.message || error}`); continue }
    await sb.from('events').insert([{
      event: 'coldmail_resume_sent', page: '/outreach', meta: { campaign, segment }, user_id: p.id,
    }])
    ok++
    if (ok % 25 === 0) console.log(`  ...${ok}건 발송`)
    await sleep(120)
  }
  console.log(`\n완료: 발송 ${ok} / 실패 ${fail}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
