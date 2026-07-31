// 이력서 등록 유도 콜드메일 — 이미 가입했지만 이력서가 없는 회원 대상.
// 훅은 "등록하면 취업이 쉬워진다"(등록자 월 평균 오퍼 7건 · FYI 추천 자리 서류합격 85%).
// 버튼 → /api/resume/upload 토큰 랜딩: 로그인 없이 파일만 고르면 등록 완료.
//
// 대상 우선순위(동기 순): 지원 버튼까지 눌렀다 이탈 > 공고 카드 클릭 > 그 외.
// --segment 로 고른다. 기본은 apply(가장 동기 강한 층)이며 성과를 섞지 않게 캠페인을 분리한다.
//
//   node scripts/outreach/resume-register-coldmail.mjs --test wsj@likelion.net   # 한국어 테스트 1통
//   node scripts/outreach/resume-register-coldmail.mjs                           # dry-run: 대상 목록
//   node scripts/outreach/resume-register-coldmail.mjs --send [--max N]          # 실발송(베트남어)
//   옵션: --segment apply|jobcard|rest · --campaign resume-register1 · --site http://localhost:3000
import { Resend } from 'resend'
import { sb, env } from './lib.mjs'
import { makeToken } from '../../lib/campaignToken.js'

const args = process.argv.slice(2)
const flag = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d }
const testTo = flag('test', null)
const doSend = args.includes('--send')
const segment = String(flag('segment', 'apply'))
const campaign = String(flag('campaign', `resume-register-${segment}1`))
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

// 모바일(≈320px)에서 한 줄이 어색하게 접히지 않도록 라벨은 짧게 유지한다.
// 수치의 단서("등록자 평균")는 스탯마다 붙이지 않고 아래 한 줄로 모은다.
const COPY = {
  vi: {
    subject: '[FYI] Đăng ký CV — trung bình 7 lời mời mỗi tháng',
    hi: (n) => `Chào ${n || 'bạn'},`,
    lead: 'Đăng ký CV, nhà tuyển dụng sẽ tìm đến bạn.',
    stat1n: '7', stat1: 'lời mời mỗi tháng',
    stat2n: '85%', stat2: 'đậu vòng hồ sơ qua FYI',
    statNote: 'Số liệu trung bình của người đã đăng ký CV.',
    body: 'Bạn không cần tìm việc nữa. Chúng tôi chọn những vị trí bạn có khả năng đậu cao và liên hệ trước.',
    note: 'Không cần đăng nhập · khoảng 30 giây',
    cta: 'Đăng ký CV',
    foot: 'Bạn nhận email này vì đã đăng ký tài khoản FYI.',
  },
  ko: {
    subject: '[FYI 테스트] 이력서 등록하면 월 평균 7건의 제안',
    hi: (n) => `${n || '회원'}님, 안녕하세요.`,
    lead: '이력서를 등록해두면 담당자가 먼저 찾아옵니다.',
    stat1n: '7', stat1: '한 달 평균 받는 제안',
    stat2n: '85%', stat2: 'FYI 추천 자리 서류 합격률',
    statNote: '이력서를 등록한 분들의 평균입니다.',
    body: '공고를 찾아다니지 않으셔도 됩니다. 합격 가능성이 높은 자리를 골라 저희가 먼저 연락드립니다.',
    note: '로그인 없이 파일만 · 30초',
    cta: '이력서 등록하기',
    foot: 'FYI에 가입하셔서 이 메일을 받으셨습니다.',
  },
}

// 숫자만 브랜드 컬러, 나머지는 무채색. 스탯은 2열이 아니라 가로 한 줄씩 쌓는다 —
// 320px 폭에서 2열이면 칸이 120px 밖에 안 돼 라벨이 서너 줄로 접힌다.
// word-break:keep-all 은 한국어가 단어 중간에서 잘리는 걸 막는다(베트남어엔 영향 없음).
function emailHtml(name, url, c) {
  const stat = (n, label) => `<tr>
    <td width="72" style="font-size:30px;font-weight:800;color:#ff6000;line-height:1.15;letter-spacing:-0.02em;vertical-align:middle;padding:9px 0">${n}</td>
    <td style="font-size:14px;font-weight:600;color:#1a1612;line-height:1.4;vertical-align:middle;padding:9px 0;word-break:keep-all">${esc(label)}</td>
  </tr>`
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f2ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1612">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ee"><tr><td align="center" style="padding:32px 16px 40px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">
  <tr><td style="font-size:17px;font-weight:800;color:#ff6000;letter-spacing:-0.01em;padding-bottom:14px">FYI</td></tr>
  <tr><td style="background:#ffffff;border-radius:18px;padding:32px 28px 28px">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="font-size:13.5px;color:#8a8177;padding-bottom:12px">${esc(c.hi(firstName(name)))}</td></tr>
      <tr><td style="font-size:20px;font-weight:800;line-height:1.45;letter-spacing:-0.01em;padding-bottom:22px;word-break:keep-all">${esc(c.lead)}</td></tr>
      <tr><td style="padding-bottom:8px">
        <table width="100%" cellpadding="0" cellspacing="0">${stat(c.stat1n, c.stat1)}${stat(c.stat2n, c.stat2)}</table>
      </td></tr>
      <tr><td style="font-size:12px;color:#9a9186;line-height:1.5;padding-bottom:20px;word-break:keep-all">${esc(c.statNote)}</td></tr>
      <tr><td style="border-top:1px solid #eeeae4;padding-top:20px;font-size:14px;line-height:1.7;color:#57504a;word-break:keep-all">${esc(c.body)}</td></tr>
      <tr><td style="padding-top:22px">
        <a href="${url}" style="display:block;background:#ff6000;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:16px;border-radius:12px;text-align:center">${esc(c.cta)}</a>
      </td></tr>
      <tr><td style="font-size:12.5px;color:#9a9186;text-align:center;padding-top:12px">${esc(c.note)}</td></tr>
    </table>
  </td></tr>
  <tr><td style="font-size:11.5px;color:#a8a096;text-align:center;line-height:1.6;padding-top:20px">
    ${esc(c.foot)}<br><a href="https://salary-fyi.com/jobs" style="color:#a8a096">salary-fyi.com</a>
  </td></tr>
</table></td></tr></table></body></html>`
}

const emailText = (name, url, c) => `${c.hi(firstName(name))}

${c.lead}

${c.stat1n} — ${c.stat1}
${c.stat2n} — ${c.stat2}
${c.statNote}

${c.body}

${c.note}
${url}

— FYI · salary-fyi.com`

// ── 대상 선정 ──
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

  // 이미 이 캠페인을 받은 사람은 제외(재실행 안전).
  const sent = new Set((await fetchAll(() => sb.from('events')
    .select('user_id, meta').eq('event', 'coldmail_resume_sent').not('user_id', 'is', null)))
    .filter((e) => e.meta?.campaign === campaign).map((e) => e.user_id))

  const ev = await fetchAll(() => sb.from('events')
    .select('event, user_id').in('event', ['click_apply_button', 'click_job_card']).not('user_id', 'is', null))
  const applyClickers = new Set(ev.filter((e) => e.event === 'click_apply_button').map((e) => e.user_id))
  const cardClickers = new Set(ev.filter((e) => e.event === 'click_job_card').map((e) => e.user_id))

  const inSegment = (p) => (
    segment === 'apply' ? applyClickers.has(p.id)
      : segment === 'jobcard' ? cardClickers.has(p.id) && !applyClickers.has(p.id)
        : !cardClickers.has(p.id) && !applyClickers.has(p.id)
  )
  return pool.filter((p) => inSegment(p) && !sent.has(p.id))
}

async function main() {
  const resend = new Resend(env.RESEND_API_KEY)
  const linkFor = (userId) => `${SITE}/api/resume/upload?t=${makeToken(userId, campaign)}`

  if (testTo) {
    const { data: rows } = await sb.from('user_profiles').select('id, email, full_name').ilike('email', testTo).limit(1)
    const p = rows?.[0]
    if (!p) { console.error(`계정 없음: ${testTo}`); process.exit(1) }
    const c = COPY.ko // 검수용 한국어
    const url = linkFor(p.id)
    const { error } = await resend.emails.send({
      from: RESEND_FROM, to: p.email, subject: c.subject,
      html: emailHtml(p.full_name, url, c), text: emailText(p.full_name, url, c),
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
    const { error } = await resend.emails.send({
      from: RESEND_FROM, to: p.email, subject: c.subject,
      html: emailHtml(p.full_name, url, c), text: emailText(p.full_name, url, c),
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
