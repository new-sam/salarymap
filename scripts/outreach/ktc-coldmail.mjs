// KTC 지원자(FYI 미가입) → FYI 유입 콜드메일(베트남어). 발신: Resend, hello@salary-fyi.com.
// 대상은 정제된 리스트(data/ktc-leads-not-in-fyi.csv, 2,032명 · 발송배치 1~6)를 그대로 쓴다.
//
//   node scripts/outreach/ktc-coldmail.mjs                          # dry-run: 대상 수/샘플/링크
//   node scripts/outreach/ktc-coldmail.mjs --test a@x.com,b@y.com   # 테스트(쉼표로 여러 명, 스탬프 안 함)
//   node scripts/outreach/ktc-coldmail.mjs --test a@x.com --lang ko # 한국어판으로 테스트
//   node scripts/outreach/ktc-coldmail.mjs --batch 1 --max 80 --send
//   node scripts/outreach/ktc-coldmail.mjs --with-company --max 100 --send   # 기업명 있는 리드만
//   옵션: --batch N(발송배치) · --max N(이번에 보낼 인원) · --utm(배포 전 모드) · --campaign coldmail-ktc
//        --with-company(기업명 확보된 리드만 — 제목 "{기업} - {직무}" 개인화가 항상 적용됨)
//        --lang ko|vi (기본 vi) — 템플릿·제목·텍스트본문을 함께 전환. ko 는 문구 검토용.
//
// 수신자는 FYI 계정이 없다 → events 는 user_id 없이 meta.lead(이메일 해시)로 사람을 구분한다.
// 어드민 goals 탭 캠페인별 표가 meta.lead 를 읽도록 campaign-resume-public-metrics.js 가 수정돼 있어야 한다.
// ⚠️ /api/ktc/r 배포 전이면 --utm 으로 보낼 것(안 그러면 수신자가 CTA에서 404를 본다).
import { readFileSync, writeFileSync } from 'node:fs'
import { resolveMx } from 'node:dns/promises'
import { sb, env } from './lib.mjs' // .env.local → process.env 주입 포함
import { makeToken, leadId } from '../../lib/ktcMailToken.js'

const SITE = (env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com').replace(/\/$/, '')
const RESEND_FROM = env.RESEND_FROM || 'FYI <hello@salary-fyi.com>'
const LEADS = new URL('../../data/ktc-leads-not-in-fyi.csv', import.meta.url)

const args = process.argv.slice(2)
const flag = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d }
const doSend = args.includes('--send')
const utmMode = args.includes('--utm')
// 소량 발송이면 폴백(직무만) 없이 기업명이 확실한 리드만 골라 보낸다 — 제목 개인화가 이번 실험의 변수라서.
const withCompanyOnly = args.includes('--with-company')
// 실발송은 vi. ko 는 문구 검토용(팀 내부 테스트 수신)이라 같은 스크립트로 보낼 수 있게 해 둔다.
const lang = flag('lang', 'vi') === 'ko' ? 'ko' : 'vi'
const TEMPLATE = new URL(`../ktc-coldmail-${lang}.html`, import.meta.url)
const testTo = flag('test', null)
const campaign = flag('campaign', 'coldmail-ktc')
const batch = flag('batch', null)
const max = parseInt(flag('max', doSend ? '80' : '0')) || 0

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const esc = (s) => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const csvCell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }

// ── CSV(따옴표 포함) 파싱 ──
function parseCsv(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1) // BOM — 안 떼면 첫 컬럼('이메일') 키가 어긋난다
  const rows = []; let row = [], cur = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++ } else q = false } else cur += c }
    else if (c === '"') q = true
    else if (c === ',') { row.push(cur); cur = '' }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = '' }
    else if (c !== '\r') cur += c
  }
  if (cur || row.length) { row.push(cur); rows.push(row) }
  const head = rows.shift()
  return rows.filter(r => r.length > 1).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])))
}

// ── 메일 ──
// 지원자가 기억하는 건 'KTC'가 아니라 자기가 지원한 그 회사·그 공고다 → 제목·첫 문장에 기업명을 앞세운다.
// 기업명이 없는 리드(약 23%)는 직무만 쓰는 폴백.
const template = readFileSync(TEMPLATE, 'utf8')
// 2차(제목을 지원기업명으로 바꾼 판)는 오픈 38.6% vs 클릭 1.0% 으로 무너졌다 — 열어보니 그 회사가
// 보낸 메일이 아니라서 생긴 미끼-전환이다. 발신자(KTC가 만든 FYI)와 제목을 다시 일치시키고,
// 본문이 실제로 주는 것(내 지원이 어느 단계인지)을 제목에서 그대로 약속한다.
const subjectTail = { vi: 'hồ sơ của bạn đang ở bước nào?', ko: '지원 결과 확인하세요' }[lang]
const subject = (lead) => `K-Tech College - ${lead.job} — ${subjectTail}`
// 베트남어는 "vị trí {직무} tại {기업}" 어순 → 기업명을 별도 조각({{atCompany}})으로 끼워 넣는다.
// 한국어는 "{기업} - {직무}" 어순 → 합쳐진 한 덩어리({{companyJob}})를 쓴다. 템플릿이 쓰는 것만 치환된다.
const atCompanyHtml = (lead) => lead.company ? ` tại <b>${esc(lead.company)}</b>` : ''
const companyJobHtml = (lead) => lead.company
  ? `<b>${esc(lead.company)} - ${esc(lead.job)}</b>`
  : `<b>${esc(lead.job)}</b>`
const render = (lead, ctaUrl, unsubUrl) => template
  .replace(/\{\{name\}\}/g, esc(lead.ten))
  .replace(/\{\{atCompany\}\}/g, atCompanyHtml(lead))
  .replace(/\{\{companyJob\}\}/g, companyJobHtml(lead))
  .replace(/\{\{position\}\}/g, esc(lead.job))
  .replace(/\{\{ctaUrl\}\}/g, ctaUrl)
  .replace(/\{\{unsubscribeUrl\}\}/g, unsubUrl)
const emailTextVi = (lead, ctaUrl, unsubUrl) => `Chào ${lead.ten},

Vừa qua bạn đã ứng tuyển vị trí ${lead.job}${lead.company ? ` tại ${lead.company}` : ''} thông qua K-Tech College.
Sau đó bạn có nhận được phản hồi nào không?

Thành thật mà nói: trước đây chúng tôi chỉ liên hệ với ứng viên trúng tuyển vòng cuối.
Nghĩa là phần lớn ứng viên không bao giờ biết hồ sơ của mình đã đi tới đâu.

Từ nay thì khác. Chúng tôi đã xây dựng FYI để bạn không còn phải chờ đợi trong im lặng nữa.

Xem cách theo dõi hồ sơ:
${ctaUrl}

— Đội ngũ FYI · salary-fyi.com
Hủy đăng ký: ${unsubUrl}`

const emailTextKo = (lead, ctaUrl, unsubUrl) => `안녕하세요 ${lead.ten}님,

얼마 전 K-Tech College를 통해 ${lead.company ? `${lead.company} - ${lead.job}` : lead.job}에 지원해 주셨죠.
그 뒤로 결과를 전달받으신 적 있으신가요?

솔직히 말씀드리면, 지금까지는 최종 합격하신 분께만 연락을 드렸습니다.
그래서 대부분의 지원자분들은 자기 서류가 어디까지 갔는지 알 수 없으셨습니다.

앞으로는 다릅니다. 더 이상 조용히 기다리지 않으셔도 되도록 KTC가 FYI를 만들었습니다.

어떻게 달라지는지 보기:
${ctaUrl}

— FYI 팀 · salary-fyi.com
수신 거부: ${unsubUrl}`

const emailText = lang === 'ko' ? emailTextKo : emailTextVi

// 배포 전(--utm)엔 추적 리다이렉트가 prod 에 없다 → CTA 를 prod /jobs 로 직결하고 utm 으로만 측정.
const ctaFor = (lead) => utmMode
  ? `${SITE}/jobs?utm_source=coldmail&utm_medium=email&utm_campaign=${campaign}&utm_content=${lead.lead}`
  : `${SITE}/api/ktc/r?t=${encodeURIComponent(makeToken(lead.email, campaign))}&to=%2Fktc%2Fstatus`
const unsubFor = (lead) => utmMode
  ? `mailto:hello@salary-fyi.com?subject=${encodeURIComponent('Unsubscribe: ' + lead.email)}`
  : `${SITE}/api/ktc/unsub?t=${encodeURIComponent(makeToken(lead.email, campaign))}`

async function fetchAll(build) {
  const PAGE = 1000; let all = [], from = 0
  while (true) {
    const { data, error } = await build().range(from, from + PAGE - 1)
    if (error) throw error
    if (!data?.length) break
    all = all.concat(data); if (data.length < PAGE) break; from += PAGE
  }
  return all
}
async function resendClient() {
  const { Resend } = await import('resend')
  return new Resend(env.RESEND_API_KEY)
}

// 도메인 단위 MX 확인 — 바운스율이 발송 중단 기준이라 보내기 직전 배치만 검사한다.
async function mxOk(domains) {
  const ok = new Map()
  await Promise.all([...domains].map(async d => {
    try { ok.set(d, (await resolveMx(d)).length > 0) } catch { ok.set(d, false) }
  }))
  return ok
}

;(async () => {
  // ── 테스트 1통 ──
  if (testTo) {
    const resend = await resendClient()
    // 쉼표로 여러 주소 — 팀 검토용으로 한 번에 돌린다.
    for (const to of String(testTo).split(',').map(s => s.trim()).filter(Boolean)) {
      const lead = { email: to, ten: 'Tây', job: 'Full-stack Developer', company: 'NALDA', lead: leadId(to) }
      const cta = ctaFor(lead), unsub = unsubFor(lead)
      const r = await resend.emails.send({
        from: RESEND_FROM, to, subject: `[TEST/${lang}] ` + subject(lead),
        text: emailText(lead, cta, unsub), html: render(lead, cta, unsub),
      })
      if (r.error) throw new Error(`${to}: ${r.error.message || 'resend_error'}`)
      console.log(`✅ 테스트 발송(${lang}) → ${to} | id=${r.data?.id}`)
      console.log(`   제목: ${subject(lead)}`)
      await sleep(600) // Resend rate limit 2req/s
    }
    return
  }

  // ── 대상 추출 ──
  let leads = parseCsv(readFileSync(LEADS, 'utf8')).map(r => ({
    email: r['이메일'].toLowerCase(),
    name: r['이름'],
    ten: r['호칭(tên)'] || r['이름'].split(/\s+/).pop() || 'bạn',
    // 지원기업/지원공고는 ktc-enrich-company.mjs 가 KTC applications 에서 채운다(기업명 커버리지 77%).
    company: r['지원기업'] || '',
    job: r['지원공고'] || r['최신 지원포지션'],
    batch: r['발송배치'],
  })).filter(r => /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(r.email))
  for (const l of leads) l.lead = leadId(l.email)
  const total = leads.length
  if (batch && batch !== true) leads = leads.filter(l => l.batch === String(batch))

  // CSV 생성 이후에 가입했을 수 있으니 FYI 회원은 다시 뺀다(중복 유입 메일 방지).
  const profs = await fetchAll(() => sb.from('user_profiles').select('email').not('email', 'is', null))
  const members = new Set(profs.map(p => p.email.trim().toLowerCase()))
  // 이미 보낸 사람 / 수신거부한 사람 제외 — events 가 발송 원장(재실행 idempotent).
  const evts = await fetchAll(() => sb.from('events').select('event, meta').in('event', ['coldmail_public_sent', 'coldmail_unsub']))
  // 발송이력은 캠페인 키가 아니라 KTC 계열 전체(coldmail-ktc*)로 본다 —
  // 템플릿 변형마다 키를 나눠도(1탄 → 2탄) 같은 사람에게 두 번 가지 않아야 하므로.
  const sentLeads = new Set(evts.filter(e => e.event === 'coldmail_public_sent' && /^coldmail-ktc/.test(e.meta?.campaign || '') && e.meta?.lead).map(e => e.meta.lead))
  const unsubLeads = new Set(evts.filter(e => e.event === 'coldmail_unsub' && e.meta?.lead).map(e => e.meta.lead))

  const before = leads.length
  const isMember = leads.filter(l => members.has(l.email)).length
  leads = leads.filter(l => !members.has(l.email) && !sentLeads.has(l.lead) && !unsubLeads.has(l.lead))

  const noCompany = leads.filter(l => !l.company).length
  if (withCompanyOnly) leads = leads.filter(l => l.company)

  console.log(`캠페인: ${campaign} | 모드: ${utmMode ? 'utm(배포 전)' : 'redirect(추적)'}`)
  console.log(`리스트 ${total}명${batch && batch !== true ? ` → 배치 ${batch} ${before}명` : ''} | 제외: FYI가입 ${isMember} · 발송済 ${sentLeads.size} · 수신거부 ${unsubLeads.size}${withCompanyOnly ? ` · 기업명없음 ${noCompany}` : ''} → 남은 대상 ${leads.length}명`)

  const capped = max ? leads.slice(0, max) : leads
  if (!capped.length) { console.log('보낼 대상 없음.'); return }

  // 보낼 배치만 MX 확인
  const mx = await mxOk(new Set(capped.map(l => l.email.split('@')[1])))
  const bad = capped.filter(l => !mx.get(l.email.split('@')[1]))
  const queue = capped.filter(l => mx.get(l.email.split('@')[1]))
  if (bad.length) console.log(`MX 없음 제외 ${bad.length}건: ${bad.slice(0, 5).map(l => l.email).join(', ')}`)

  const s = queue[0]
  const withCo = queue.filter(l => l.company).length
  console.log(`\n이번 발송 ${queue.length}명 (샘플: ${s.email} / ${s.ten} / ${s.company || '(기업명 없음)'} - ${s.job})`)
  console.log(`기업명 개인화 ${withCo}명 / 폴백(직무만) ${queue.length - withCo}명`)
  console.log(`제목: ${subject(s)}`)
  console.log(`CTA: ${ctaFor(s)}`)

  if (!doSend) {
    console.log(`\n[dry-run] 발송 안 함. --send 로 Resend 실발송 + coldmail_public_sent 기록.`)
    return
  }

  // ── 실발송 + 발송 기록 ──
  const resend = await resendClient()
  const log = [['email', 'ten', 'company', 'job', 'batch', 'lead', 'resend_id', 'error'].join(',')]
  let ok = 0, fail = 0
  for (const l of queue) {
    const cta = ctaFor(l), unsub = unsubFor(l)
    try {
      const resp = await resend.emails.send({
        from: RESEND_FROM, to: l.email, subject: subject(l),
        text: emailText(l, cta, unsub), html: render(l, cta, unsub),
        headers: utmMode ? undefined : { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      })
      if (resp.error) throw new Error(resp.error.message || 'resend_error')
      // PII 는 events 에 남기지 않는다 — 사람 식별은 lead 해시, 이메일은 아래 로컬 CSV 로그에만.
      await sb.from('events').insert([{
        event: 'coldmail_public_sent', page: '/campaign/ktc',
        meta: { campaign, lead: l.lead, lang, mode: utmMode ? 'utm' : 'redirect', resend_id: resp.data?.id || null },
      }])
      log.push([l.email, l.ten, l.company, l.job, l.batch, l.lead, resp.data?.id || '', ''].map(csvCell).join(','))
      ok++
    } catch (e) {
      fail++
      log.push([l.email, l.ten, l.company, l.job, l.batch, l.lead, '', e.message].map(csvCell).join(','))
      console.error(`  ✗ ${l.email}: ${e.message}`)
    }
    await sleep(600) // Resend rate limit 2req/s
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const outPath = new URL(`../../data/ktc-coldmail-sent-${stamp}.csv`, import.meta.url)
  writeFileSync(outPath, log.join('\n'))
  console.log(`\n✅ 발송 완료: 성공 ${ok} / 실패 ${fail} | 로그: data/ktc-coldmail-sent-${stamp}.csv`)
  if (leads.length > queue.length) console.log(`   남은 ${leads.length - queue.length}명은 같은 명령을 다시 실행하면 이어서 발송됨.`)
})().catch(e => { console.error(e); process.exit(1) })
