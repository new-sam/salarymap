// KTC 지원자(FYI 미가입) → 가입 + CV 자동 등록(클레임) 콜드메일(베트남어). 발신: Resend, hello@salary-fyi.com.
// 3차까지의 "지원현황" 앵글과 달리, 이번 훅은 "네 프로필이 이미 만들어져 있다"(소유 프레임)다.
// 대상은 같은 리스트(data/ktc-leads-not-in-fyi.csv)에서 아직 안 보낸 사람 중
// KTC 스토리지에 직링크 CV(ktc-cvs 공개 버킷)가 있는 리드만 — "준비돼 있다"는 약속을
// 가입 직후 콜백이 실제로 이행(다운로드→우리 스토리지→resume_url)할 수 있어야 하므로.
//
//   node scripts/outreach/ktc-claim-coldmail.mjs                          # dry-run: 대상 수/샘플/링크
//   node scripts/outreach/ktc-claim-coldmail.mjs --test a@x.com,b@y.com   # 테스트(스탬프 안 함)
//   node scripts/outreach/ktc-claim-coldmail.mjs --test a@x.com --lang ko # 한국어판 문구 검토
//   node scripts/outreach/ktc-claim-coldmail.mjs --max 200 --send
//   옵션: --max N(이번에 보낼 인원) · --campaign coldmail-ktc-cv · --lang ko|vi(기본 vi)
//
// ⚠️ /ktc/claim 랜딩 + 콜백 임포트가 prod 에 배포된 뒤에만 실발송할 것 — CTA가 404거나
//    가입해도 CV가 안 옮겨지면 "준비돼 있다"가 거짓말이 된다(3차의 사망 원인과 동일 구조).
//
// 수신자는 FYI 계정이 없다 → events 는 user_id 없이 meta.lead(이메일 해시)로 사람을 구분한다.
// 발송 이벤트 meta 에 cv_url 을 실어 두면, 가입 콜백이 그걸 읽어 CV 를 임포트한다
// (콜백이 KTC DB에 직접 붙지 않아도 되고 — Vercel 에 KTC env 미설정 — 발송·임포트가 원자적으로 짝지어진다).
import { readFileSync, writeFileSync } from 'node:fs'
import { resolveMx } from 'node:dns/promises'
import { createClient } from '@supabase/supabase-js'
import { sb, env } from './lib.mjs' // .env.local → process.env 주입 포함
import { makeToken, leadId } from '../../lib/ktcMailToken.js'

const SITE = (env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com').replace(/\/$/, '')
const RESEND_FROM = env.RESEND_FROM || 'FYI <hello@salary-fyi.com>'
const LEADS = new URL('../../data/ktc-leads-not-in-fyi.csv', import.meta.url)

const args = process.argv.slice(2)
const flag = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d }
const doSend = args.includes('--send')
const lang = flag('lang', 'vi') === 'ko' ? 'ko' : 'vi'
const TEMPLATE = new URL(`../ktc-claim-coldmail-${lang}.html`, import.meta.url)
const testTo = flag('test', null)
const campaign = flag('campaign', 'coldmail-ktc-cv')
const max = parseInt(flag('max', doSend ? '200' : '0')) || 0

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const esc = (s) => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const csvCell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }

// 콜백 임포트가 fetch 해도 되는 CV — KTC 공개 스토리지 직링크만(대상의 93%). Drive/잡보드 대시보드
// 링크는 로그인벽 뒤라 "준비돼 있다"를 이행 못 하므로 이 캠페인에선 아예 안 보낸다.
const IMPORTABLE = /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\//

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
const template = readFileSync(TEMPLATE, 'utf8')
const subject = (lead) => lang === 'ko'
  ? `${lead.ten}님, 회원님의 ${lead.position} 프로필이 FYI에 준비되어 있습니다`
  : `${lead.ten} ơi, hồ sơ ${lead.position} của bạn đã sẵn sàng trên FYI`

// "얼마 전" 금지 — 대상 84%가 6월(2개월 전) 지원. 월 명시가 정직하고, 구체적 사실이 증거 효과도 낸다.
// applied_at 이 없거나 미래(시트 오입력)면 시점 언급 없이 시작.
const monthFrag = (lead) => {
  const m = lead.appliedMonth
  if (!m) return lang === 'ko' ? '이전에 ' : 'Trước đây, '
  return lang === 'ko' ? `지난 ${m}월, ` : `Hồi tháng ${m}, `
}
const atCompanyHtml = (lead) => lead.company
  ? (lang === 'ko' ? ` <b>${esc(lead.company)}</b>` : ` tại <b>${esc(lead.company)}</b>`)
  : ''
// 카드 상세행 — 대학(93%)·연차(1년 이상만: 0년 표기는 역효과)는 있을 때만 붙는다.
const cardRowStyle = 'font-size:14px;color:#4E5968;line-height:1.7;'
const cardRowsHtml = (lead) => {
  const rows = []
  if (lead.university) rows.push(`<div style="${cardRowStyle}">🎓 ${esc(lead.university)}</div>`)
  const yoe = parseFloat(lead.yoe)
  const yoeTail = Number.isFinite(yoe) && yoe >= 1
    ? (lang === 'ko' ? ` · 경력 ${yoe}년` : ` · ${yoe} năm kinh nghiệm`)
    : ''
  rows.push(`<div style="${cardRowStyle}">💼 ${esc(lead.position)}${yoeTail}</div>`)
  return rows.join('\n          ')
}
const render = (lead, ctaUrl, unsubUrl) => template
  .replace(/\{\{name\}\}/g, esc(lead.ten))
  .replace(/\{\{fullName\}\}/g, esc(lead.name))
  .replace(/\{\{month\}\}/g, monthFrag(lead))
  .replace(/\{\{jobTitle\}\}/g, esc(lead.job))
  .replace(/\{\{atCompany\}\}/g, atCompanyHtml(lead))
  .replace(/\{\{position\}\}/g, esc(lead.position))
  .replace(/\{\{cardRows\}\}/g, cardRowsHtml(lead))
  .replace(/\{\{ctaUrl\}\}/g, ctaUrl)
  .replace(/\{\{unsubscribeUrl\}\}/g, unsubUrl)

const emailTextVi = (lead, ctaUrl, unsubUrl) => `Chào ${lead.ten},

${monthFrag(lead)}bạn đã ứng tuyển vị trí ${lead.job}${lead.company ? ` tại ${lead.company}` : ''} qua K-Tech College.

Với CV bạn đã nộp khi đó, chúng tôi đã chuẩn bị sẵn hồ sơ của bạn trên FYI — nền tảng tuyển dụng do K-Tech College xây dựng.

Bạn không cần viết lại CV. Chỉ cần đăng nhập Google một lần, hồ sơ sẽ được đăng ký ngay và bạn có thể ứng tuyển các vị trí mới chỉ với một chạm.

Khi có vị trí phù hợp, chúng tôi sẽ gửi hồ sơ của bạn trực tiếp đến nhà tuyển dụng — và bạn sẽ nhận được liên hệ qua email.

Nhận hồ sơ của tôi:
${ctaUrl}

— Đội ngũ FYI · salary-fyi.com
Hủy đăng ký: ${unsubUrl}`

const emailTextKo = (lead, ctaUrl, unsubUrl) => `안녕하세요 ${lead.ten}님,

${monthFrag(lead)}K-Tech College를 통해 ${lead.company ? `${lead.company}의 ` : ''}${lead.job} 포지션에 지원해 주셨죠.

그때 제출하신 이력서로, K-Tech College가 만든 채용 플랫폼 FYI에 회원님의 프로필을 미리 만들어 두었습니다.

이력서를 다시 작성하실 필요 없습니다. 구글 로그인 한 번이면 프로필이 바로 등록되고, 새로운 공고에 원클릭으로 지원할 수 있습니다.

맞는 포지션이 열리면 저희가 기업 채용 담당자에게 프로필을 바로 전달해 드립니다.

내 프로필 확인하기:
${ctaUrl}

— FYI 팀 · salary-fyi.com
수신 거부: ${unsubUrl}`

const emailText = lang === 'ko' ? emailTextKo : emailTextVi

const ctaFor = (lead) => `${SITE}/api/ktc/r?t=${encodeURIComponent(makeToken(lead.email, campaign))}&to=%2Fktc%2Fclaim`
const unsubFor = (lead) => `${SITE}/api/ktc/unsub?t=${encodeURIComponent(makeToken(lead.email, campaign))}`

async function fetchAll(client, build) {
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
  // ── 테스트 발송 ──
  if (testTo) {
    const resend = await resendClient()
    for (const to of String(testTo).split(',').map(s => s.trim()).filter(Boolean)) {
      const lead = {
        email: to, ten: 'Tây', name: 'TRƯƠNG ĐỨC NHẬT TÂY', job: 'Full-stack Developer',
        company: 'NALDA', position: 'Full-stack Developer', university: 'Đại học Bách Khoa Hà Nội',
        yoe: '2', appliedMonth: 6, lead: leadId(to),
      }
      const cta = ctaFor(lead), unsub = unsubFor(lead)
      const r = await resend.emails.send({
        from: RESEND_FROM, to, subject: `[TEST/${lang}] ` + subject(lead),
        text: emailText(lead, cta, unsub), html: render(lead, cta, unsub),
      })
      if (r.error) throw new Error(`${to}: ${r.error.message || 'resend_error'}`)
      console.log(`✅ 테스트 발송(${lang}) → ${to} | id=${r.data?.id}`)
      console.log(`   제목: ${subject(lead)}`)
      console.log(`   CTA: ${cta}`)
      await sleep(600) // Resend rate limit 2req/s
    }
    return
  }

  // ── 대상 추출 ──
  let leads = parseCsv(readFileSync(LEADS, 'utf8')).map(r => ({
    email: r['이메일'].toLowerCase(),
    name: r['이름'],
    ten: r['호칭(tên)'] || r['이름'].split(/\s+/).pop() || 'bạn',
    company: r['지원기업'] || '',
    job: r['지원공고'] || r['최신 지원포지션'],
  })).filter(r => /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(r.email))
  for (const l of leads) l.lead = leadId(l.email)
  const total = leads.length

  // CSV 생성 이후에 가입했을 수 있으니 FYI 회원은 다시 뺀다(중복 유입 메일 방지).
  const profs = await fetchAll(sb, () => sb.from('user_profiles').select('email').not('email', 'is', null))
  const members = new Set(profs.map(p => p.email.trim().toLowerCase()))
  // 이미 보낸 사람(coldmail-ktc* 계열 전체) / 수신거부 제외 — events 가 발송 원장(재실행 idempotent).
  const evts = await fetchAll(sb, () => sb.from('events').select('event, meta').in('event', ['coldmail_public_sent', 'coldmail_unsub']))
  const sentLeads = new Set(evts.filter(e => e.event === 'coldmail_public_sent' && /^coldmail-ktc/.test(e.meta?.campaign || '') && e.meta?.lead).map(e => e.meta.lead))
  const unsubLeads = new Set(evts.filter(e => e.event === 'coldmail_unsub' && e.meta?.lead).map(e => e.meta.lead))

  const isMember = leads.filter(l => members.has(l.email)).length
  leads = leads.filter(l => !members.has(l.email) && !sentLeads.has(l.lead) && !unsubLeads.has(l.lead))
  const afterDedup = leads.length

  // ── 개인화 소스 조인 ──
  // 카드(실명·대학·직무·연차)와 지원 월은 우리 미러(ktc_candidates), CV 링크는 원본(ktc-support DB).
  // 한 사람이 여러 건 지원했을 수 있어 최신 applied_at 행을 쓴다.
  const cands = await fetchAll(sb, () => sb.from('ktc_candidates')
    .select('email, full_name, university, position, yoe, applied_at, applied_company, applied_job'))
  const candBy = new Map()
  for (const c of cands) {
    const e = (c.email || '').trim().toLowerCase()
    if (!e) continue
    const prev = candBy.get(e)
    if (!prev || (c.applied_at || '') > (prev.applied_at || '')) candBy.set(e, c)
  }

  if (!env.KTC_SUPABASE_URL || !env.KTC_SUPABASE_SERVICE_ROLE_KEY) throw new Error('KTC_SUPABASE_URL / KTC_SUPABASE_SERVICE_ROLE_KEY 필요(.env.local)')
  const ktc = createClient(env.KTC_SUPABASE_URL, env.KTC_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const kc = await fetchAll(ktc, () => ktc.from('candidates').select('email, cv_url'))
  const cvBy = new Map()
  for (const c of kc) {
    const e = (c.email || '').trim().toLowerCase(); const u = (c.cv_url || '').trim()
    if (e && u && !cvBy.has(e)) cvBy.set(e, u)
  }

  const now = new Date().toISOString().slice(0, 7)
  for (const l of leads) {
    const c = candBy.get(l.email)
    l.university = (c?.university || '').trim()
    l.position = (c?.position || '').trim() || l.job
    l.yoe = (c?.yoe || '').trim()
    l.company = l.company || (c?.applied_company || '').trim()
    l.job = l.job || (c?.applied_job || '').trim() || l.position
    // 미래 날짜(시트 오입력)는 시점 언급을 아예 뺀다
    const ap = (c?.applied_at || '').slice(0, 10)
    l.appliedMonth = ap && ap.slice(0, 7) <= now ? parseInt(ap.slice(5, 7), 10) : null
    l.cvUrl = cvBy.get(l.email) || ''
  }
  const noCv = leads.filter(l => !IMPORTABLE.test(l.cvUrl)).length
  leads = leads.filter(l => IMPORTABLE.test(l.cvUrl))

  console.log(`캠페인: ${campaign} | 랜딩: /ktc/claim (배포 필수)`)
  console.log(`리스트 ${total}명 | 제외: FYI가입 ${isMember} · 발송済 ${sentLeads.size} · 수신거부 ${unsubLeads.size} → ${afterDedup}명 | CV직링크 없음 ${noCv} 제외 → 대상 ${leads.length}명`)

  const capped = max ? leads.slice(0, max) : leads
  if (!capped.length) { console.log('보낼 대상 없음.'); return }

  // 보낼 배치만 MX 확인
  const mx = await mxOk(new Set(capped.map(l => l.email.split('@')[1])))
  const bad = capped.filter(l => !mx.get(l.email.split('@')[1]))
  const queue = capped.filter(l => mx.get(l.email.split('@')[1]))
  if (bad.length) console.log(`MX 없음 제외 ${bad.length}건: ${bad.slice(0, 5).map(l => l.email).join(', ')}`)

  const s = queue[0]
  const withUni = queue.filter(l => l.university).length
  console.log(`\n이번 발송 ${queue.length}명 (샘플: ${s.email} / ${s.ten} / ${s.position} / ${s.university || '(대학 없음)'} / ${s.appliedMonth ? s.appliedMonth + '월' : '(월 없음)'})`)
  console.log(`카드 대학 표기 ${withUni}명 / 미표기 ${queue.length - withUni}명`)
  console.log(`제목: ${subject(s)}`)
  console.log(`CTA: ${ctaFor(s)}`)

  if (!doSend) {
    console.log(`\n[dry-run] 발송 안 함. --send 로 Resend 실발송 + coldmail_public_sent 기록.`)
    return
  }

  // ── 실발송 + 발송 기록 ──
  const resend = await resendClient()
  const log = [['email', 'ten', 'position', 'university', 'lead', 'resend_id', 'error'].join(',')]
  let ok = 0, fail = 0
  for (const l of queue) {
    const cta = ctaFor(l), unsub = unsubFor(l)
    try {
      const resp = await resend.emails.send({
        from: RESEND_FROM, to: l.email, subject: subject(l),
        text: emailText(l, cta, unsub), html: render(l, cta, unsub),
        headers: { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      })
      if (resp.error) throw new Error(resp.error.message || 'resend_error')
      // PII 는 events 에 남기지 않는다 — 사람 식별은 lead 해시. cv_url 은 가입 콜백의 임포트
      // 소스(해시 파일명 공개 링크, 이메일 아님)라 여기 실어 발송·임포트를 짝짓는다.
      await sb.from('events').insert([{
        event: 'coldmail_public_sent', page: '/campaign/ktc',
        meta: { campaign, lead: l.lead, lang, cv_url: l.cvUrl, resend_id: resp.data?.id || null },
      }])
      log.push([l.email, l.ten, l.position, l.university, l.lead, resp.data?.id || '', ''].map(csvCell).join(','))
      ok++
    } catch (e) {
      fail++
      log.push([l.email, l.ten, l.position, l.university, l.lead, '', e.message].map(csvCell).join(','))
      console.error(`  ✗ ${l.email}: ${e.message}`)
    }
    await sleep(600) // Resend rate limit 2req/s
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const outPath = new URL(`../../data/ktc-claim-coldmail-sent-${stamp}.csv`, import.meta.url)
  writeFileSync(outPath, log.join('\n'))
  console.log(`\n✅ 발송 완료: 성공 ${ok} / 실패 ${fail} | 로그: data/ktc-claim-coldmail-sent-${stamp}.csv`)
  if (leads.length > queue.length) console.log(`   남은 ${leads.length - queue.length}명은 같은 명령을 다시 실행하면 이어서 발송됨.`)
})().catch(e => { console.error(e); process.exit(1) })
