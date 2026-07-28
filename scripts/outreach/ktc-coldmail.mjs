// KTC 지원자(FYI 미가입) → FYI 유입 콜드메일(베트남어). 발신: Resend, hello@salary-fyi.com.
// 대상은 정제된 리스트(data/ktc-leads-not-in-fyi.csv, 2,032명 · 발송배치 1~6)를 그대로 쓴다.
//
//   node scripts/outreach/ktc-coldmail.mjs                          # dry-run: 대상 수/샘플/링크
//   node scripts/outreach/ktc-coldmail.mjs --test wsj@likelion.net  # 테스트 1통(스탬프 안 함)
//   node scripts/outreach/ktc-coldmail.mjs --batch 1 --max 80 --send
//   옵션: --batch N(발송배치) · --max N(이번에 보낼 인원) · --utm(배포 전 모드) · --campaign coldmail-ktc
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
const TEMPLATE = new URL('../ktc-coldmail-vi.html', import.meta.url)

const args = process.argv.slice(2)
const flag = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d }
const doSend = args.includes('--send')
const utmMode = args.includes('--utm')
const testTo = flag('test', null)
const campaign = flag('campaign', 'coldmail-ktc')
const batch = flag('batch', null)
const max = parseInt(flag('max', doSend ? '80' : '0')) || 0

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const esc = (s) => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const csvCell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }

// ── CSV(따옴표 포함) 파싱 ──
function parseCsv(text) {
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
const subject = (position) => `KTC - ${position} — bạn đã ứng tuyển vị trí này`
const render = (lead, ctaUrl, unsubUrl) => template
  .replace(/\{\{name\}\}/g, esc(lead.ten))
  .replace(/\{\{position\}\}/g, esc(lead.position))
  .replace(/\{\{ctaUrl\}\}/g, ctaUrl)
  .replace(/\{\{unsubscribeUrl\}\}/g, unsubUrl)
const emailText = (lead, ctaUrl, unsubUrl) => `Chào ${lead.ten},

Vừa qua bạn đã ứng tuyển vị trí ${lead.position} thông qua K-Tech College.
Mỗi lần ứng tuyển lại phải tải CV lên và điền lại thông tin — bạn có thấy bất tiện không?

FYI là nền tảng tuyển dụng do KTC xây dựng. Chỉ cần tạo hồ sơ một lần, bạn có thể
ứng tuyển nhiều vị trí chỉ với một cú nhấp, và nhà tuyển dụng cũng có thể xem hồ sơ
rồi gửi lời mời trực tiếp cho bạn.

Ứng tuyển 1-click trên FYI:
${ctaUrl}

— Đội ngũ FYI · salary-fyi.com
Hủy đăng ký: ${unsubUrl}`

// 배포 전(--utm)엔 추적 리다이렉트가 prod 에 없다 → CTA 를 prod /jobs 로 직결하고 utm 으로만 측정.
const ctaFor = (lead) => utmMode
  ? `${SITE}/jobs?utm_source=coldmail&utm_medium=email&utm_campaign=${campaign}&utm_content=${lead.lead}`
  : `${SITE}/api/ktc/r?t=${encodeURIComponent(makeToken(lead.email, campaign))}&to=%2Fjobs`
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
    const lead = { email: testTo, ten: 'Tây', position: 'Full-stack Developer', lead: leadId(testTo) }
    const cta = ctaFor(lead), unsub = unsubFor(lead)
    const resend = await resendClient()
    const r = await resend.emails.send({
      from: RESEND_FROM, to: testTo, subject: '[TEST] ' + subject(lead.position),
      text: emailText(lead, cta, unsub), html: render(lead, cta, unsub),
    })
    if (r.error) throw new Error(r.error.message || 'resend_error')
    console.log(`✅ 테스트 발송 → ${testTo} | id=${r.data?.id}`)
    console.log(`   CTA: ${cta}`)
    console.log(`   수신거부: ${unsub}`)
    return
  }

  // ── 대상 추출 ──
  let leads = parseCsv(readFileSync(LEADS, 'utf8')).map(r => ({
    email: r['이메일'].toLowerCase(),
    name: r['이름'],
    ten: r['호칭(tên)'] || r['이름'].split(/\s+/).pop() || 'bạn',
    position: r['최신 지원포지션'],
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
  const sentLeads = new Set(evts.filter(e => e.event === 'coldmail_public_sent' && e.meta?.campaign === campaign && e.meta?.lead).map(e => e.meta.lead))
  const unsubLeads = new Set(evts.filter(e => e.event === 'coldmail_unsub' && e.meta?.lead).map(e => e.meta.lead))

  const before = leads.length
  const isMember = leads.filter(l => members.has(l.email)).length
  leads = leads.filter(l => !members.has(l.email) && !sentLeads.has(l.lead) && !unsubLeads.has(l.lead))

  console.log(`캠페인: ${campaign} | 모드: ${utmMode ? 'utm(배포 전)' : 'redirect(추적)'}`)
  console.log(`리스트 ${total}명${batch && batch !== true ? ` → 배치 ${batch} ${before}명` : ''} | 제외: FYI가입 ${isMember} · 발송済 ${sentLeads.size} · 수신거부 ${unsubLeads.size} → 남은 대상 ${leads.length}명`)

  const capped = max ? leads.slice(0, max) : leads
  if (!capped.length) { console.log('보낼 대상 없음.'); return }

  // 보낼 배치만 MX 확인
  const mx = await mxOk(new Set(capped.map(l => l.email.split('@')[1])))
  const bad = capped.filter(l => !mx.get(l.email.split('@')[1]))
  const queue = capped.filter(l => mx.get(l.email.split('@')[1]))
  if (bad.length) console.log(`MX 없음 제외 ${bad.length}건: ${bad.slice(0, 5).map(l => l.email).join(', ')}`)

  const s = queue[0]
  console.log(`\n이번 발송 ${queue.length}명 (샘플: ${s.email} / ${s.ten} / ${s.position})`)
  console.log(`제목: ${subject(s.position)}`)
  console.log(`CTA: ${ctaFor(s)}`)

  if (!doSend) {
    console.log(`\n[dry-run] 발송 안 함. --send 로 Resend 실발송 + coldmail_public_sent 기록.`)
    return
  }

  // ── 실발송 + 발송 기록 ──
  const resend = await resendClient()
  const log = [['email', 'ten', 'position', 'batch', 'lead', 'resend_id', 'error'].join(',')]
  let ok = 0, fail = 0
  for (const l of queue) {
    const cta = ctaFor(l), unsub = unsubFor(l)
    try {
      const resp = await resend.emails.send({
        from: RESEND_FROM, to: l.email, subject: subject(l.position),
        text: emailText(l, cta, unsub), html: render(l, cta, unsub),
        headers: utmMode ? undefined : { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      })
      if (resp.error) throw new Error(resp.error.message || 'resend_error')
      // PII 는 events 에 남기지 않는다 — 사람 식별은 lead 해시, 이메일은 아래 로컬 CSV 로그에만.
      await sb.from('events').insert([{
        event: 'coldmail_public_sent', page: '/campaign/ktc',
        meta: { campaign, lead: l.lead, lang: 'vi', mode: utmMode ? 'utm' : 'redirect', resend_id: resp.data?.id || null },
      }])
      log.push([l.email, l.ten, l.position, l.batch, l.lead, resp.data?.id || '', ''].map(csvCell).join(','))
      ok++
    } catch (e) {
      fail++
      log.push([l.email, l.ten, l.position, l.batch, l.lead, '', e.message].map(csvCell).join(','))
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
