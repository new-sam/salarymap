// 유저 페인포인트 서베이 콜드메일 — 창업자 개인 명의로 전 회원에게 /survey?t=(개인 토큰) 링크 발송.
// 목적: 채용 외 수익화·기능 탐색(과거 행동·실지출 중심 5문항). 결과는 어드민 ?tab=survey.
// 대상: 이메일 있는 전 회원 − likelion − 수신거부(coldmail_unsub) − 서베이 계열 기발송(survey_sent 전체).
//
//   node scripts/outreach/user-survey-coldmail.mjs --test wsj@likelion.net  # 검수용 한국어 1통, 이벤트 기록 없음
//   node scripts/outreach/user-survey-coldmail.mjs                          # dry-run: 대상 집계
//   node scripts/outreach/user-survey-coldmail.mjs --send [--max N]         # 실발송 + survey_sent 기록
//   재발송/리마인드는 --campaign survey1-MMDD 로 캠페인명 분리(-MMDD 표준).
import { Resend } from 'resend'
import { sb, env, fetchAll } from './lib.mjs'
import { makeToken } from '../../lib/campaignToken.js'

const args = process.argv.slice(2)
const flag = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d }
const testTo = flag('test', null)
const doSend = args.includes('--send')
const maxN = flag('max', null) ? parseInt(flag('max'), 10) : null
const CAMPAIGN = String(flag('campaign', 'survey1'))
const SITE = String(flag('site', env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com')).replace(/\/$/, '')
const RESEND_FROM = env.RESEND_FROM || 'FYI <hello@salary-fyi.com>'
const FROM = RESEND_FROM.replace(/^[^<]*</, 'Seungju (FYI) <') // 창업자 개인 명의 표시명
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const firstName = (n) => String(n || '').trim().split(/\s+/).slice(-1)[0] || 'bạn'

const COPY = {
  subject: {
    vi: 'Mình là Seungju, người sáng lập FYI — xin bạn 3 phút được không?',
    ko: '안녕하세요, FYI 창업자 승주입니다 — 3분만 내주실 수 있나요?',
  },
  hi: { vi: (n) => `Chào ${n},`, ko: (n) => `안녕하세요 ${n}님,` },
  p1: {
    vi: 'Mình là <b>Seungju</b>, người sáng lập FYI (salary-fyi.com). Mình là người Hàn Quốc, đang cùng đội ngũ xây dựng FYI để giúp các bạn Việt Nam phát triển sự nghiệp.',
    ko: '저는 FYI(salary-fyi.com) 창업자 <b>승주</b>입니다. 한국인으로서 베트남 분들의 커리어 성장을 돕기 위해 FYI를 만들고 있습니다.',
  },
  p2: {
    vi: 'Hơn 3.000 bạn đã tham gia FYI, nhưng mình vẫn muốn hiểu rõ hơn: <b>điều gì thực sự khó khăn với bạn</b> khi tìm việc và phát triển sự nghiệp?',
    ko: '3,000명 넘는 분들이 FYI에 함께해 주셨지만, <b>구직과 커리어에서 정말 어려운 게 뭔지</b> 더 깊이 이해하고 싶습니다.',
  },
  p3: {
    vi: 'Khảo sát chỉ có <b>5 câu hỏi (~3 phút)</b>. Câu trả lời của bạn sẽ trực tiếp quyết định những tính năng FYI xây dựng tiếp theo.',
    ko: '<b>5문항(~3분)</b>짜리 짧은 설문입니다. 답변은 FYI가 다음에 만들 기능을 결정하는 데 그대로 반영됩니다.',
  },
  cta: { vi: 'Trả lời khảo sát (3 phút) →', ko: '설문 참여하기 (3분) →' },
  thanks: { vi: 'Cảm ơn bạn rất nhiều!<br>— Seungju, Founder của FYI', ko: '정말 감사합니다!<br>— FYI 창업자 승주 드림' },
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
  <tr><td style="font-size:20px;font-weight:800;color:#ff6000;padding-bottom:18px">FYI</td></tr>
  <tr><td style="font-size:15px;line-height:1.6;color:#1a1612;padding-bottom:6px">${L(COPY.hi)(esc(firstName(name)))}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:14px">${L(COPY.p1)}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:14px">${L(COPY.p2)}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:6px">${L(COPY.p3)}</td></tr>
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

const strip = (s) => String(s).replace(/<[^>]+>/g, '').replace(/<br>/g, '\n')
function emailText(name, url, unsubUrl, lang) {
  const L = (o) => o[lang] || o.vi
  return `${L(COPY.hi)(firstName(name))}

${strip(L(COPY.p1))}

${strip(L(COPY.p2))}

${strip(L(COPY.p3))}

${url}

${strip(L(COPY.thanks))}

${strip(L(COPY.footer))}
${strip(L(COPY.unsub))}: ${unsubUrl}`
}

async function main() {
  const resend = new Resend(env.RESEND_API_KEY)
  const surveyUrl = (userId) => `${SITE}/survey?t=${makeToken(userId, CAMPAIGN)}`
  const unsubFor = (userId) => `${SITE}/api/coldmail/unsub?t=${makeToken(userId, CAMPAIGN)}`

  // ── 검수용 테스트: 한국어 1통, 이벤트 기록 없음 ──
  if (testTo) {
    const { data: rows } = await sb.from('user_profiles').select('id,email,full_name').ilike('email', testTo).limit(1)
    const p = rows?.[0]
    if (!p) { console.error(`계정 없음: ${testTo}`); process.exit(1) }
    const u = surveyUrl(p.id), un = unsubFor(p.id)
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
  const [pool, unsubs, sents] = await Promise.all([
    fetchAll(() => sb.from('user_profiles').select('id,email,full_name,created_at').not('email', 'is', null).order('created_at', { ascending: false })),
    fetchAll(() => sb.from('events').select('user_id').eq('event', 'coldmail_unsub').not('user_id', 'is', null).order('id')),
    fetchAll(() => sb.from('events').select('user_id').eq('event', 'survey_sent').not('user_id', 'is', null).order('id')),
  ])
  const unsubSet = new Set(unsubs.map((r) => r.user_id))
  const sentSet = new Set(sents.map((r) => r.user_id)) // 서베이 계열 전체 — 1인 1회
  const seen = new Set()
  const cohort = pool.filter((p) => {
    if (!p.email || /likelion/i.test(p.email) || unsubSet.has(p.id) || sentSet.has(p.id)) return false
    const e = p.email.toLowerCase()
    if (seen.has(e)) return false
    seen.add(e)
    return true
  })

  console.log(`대상 ${cohort.length}명 (전체 ${pool.length} − likelion/수신거부 ${unsubSet.size}/기발송 ${sentSet.size}/중복이메일) · 캠페인 ${CAMPAIGN}`)
  if (!doSend) {
    for (const p of cohort.slice(0, 20)) console.log(`  ${p.full_name || '(이름없음)'} <${p.email}> · ${String(p.created_at).slice(0, 10)}`)
    if (cohort.length > 20) console.log(`  … 외 ${cohort.length - 20}명`)
    console.log('\n(dry-run — 실발송하려면 --send, 개수 제한은 --max N)')
    return
  }

  const list = maxN ? cohort.slice(0, maxN) : cohort
  let ok = 0
  const fails = []
  for (const p of list) {
    const u = surveyUrl(p.id), un = unsubFor(p.id)
    const { error } = await resend.emails.send({
      from: FROM, to: p.email, subject: COPY.subject.vi,
      html: emailHtml(p.full_name, u, un, 'vi'), text: emailText(p.full_name, u, un, 'vi'),
      headers: { 'List-Unsubscribe': `<${un}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    })
    if (error) { fails.push(p.email); console.error(`실패 ${p.email}:`, error.message || error); continue }
    await sb.from('events').insert([{
      event: 'survey_sent', page: '/scripts/user-survey-coldmail',
      meta: { campaign: CAMPAIGN }, user_id: p.id,
    }])
    ok++
    if (ok % 25 === 0) console.log(`  …${ok}/${list.length}`)
    await sleep(400)
  }
  console.log(`\n✅ 발송 완료: ${ok}/${list.length}${fails.length ? ` · 실패 ${fails.length}: ${fails.join(', ')}` : ''}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
