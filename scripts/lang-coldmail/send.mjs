#!/usr/bin/env node
/**
 * 어학 정보 수집 콜드메일 발송. 발신: Resend, RESEND_FROM.
 *
 *   node scripts/lang-coldmail/send.mjs --test you@x.com --arm a --lang ko
 *   node scripts/lang-coldmail/send.mjs                       # 드라이런(대상·제목만)
 *   node scripts/lang-coldmail/send.mjs --send                # 실발송 + coldmail_lang_sent 기록
 *
 * 테스트 발송은 제목에 [TEST] 를 붙이고 events 에 아무것도 남기지 않는다 —
 * 테스트가 A/B 분모에 섞이면 전환율이 조용히 틀어진다.
 *
 * 대상 명단은 build-audience.mjs 가 만든 data/lang-coldmail-audience.csv 를 읽는다.
 * 여기서 다시 뽑지 않는 이유: 두 스크립트가 각자 뽑으면 arm 배정이 어긋날 수 있고,
 * "누가 A였는지"의 기록이 두 곳으로 갈린다.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { config } from 'dotenv'
import { makeToken, leadId } from '../../lib/ktcMailToken.js'

config({ path: '.env.local', quiet: true })

const argv = process.argv.slice(2)
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d }
const has = (k) => argv.includes(k)

const testTo = arg('--test')
const arm = (arg('--arm', 'a') || 'a').toLowerCase()
const lang = (arg('--lang', 'vi') || 'vi').toLowerCase()   // 실발송 기본은 베트남어
const doSend = has('--send')

// 다른 콜드메일 스크립트(outreach/*.mjs)와 같은 규칙을 쓴다. 여기만 SITE_URL 이라는
// 안 쓰는 변수명에 fyivietnam.com 이라는 없는 도메인을 폴백으로 두고 있어서, 메일의
// 모든 링크(CTA 4개·수신거부·픽셀)가 DNS_PROBE_FINISHED_NXDOMAIN 으로 죽었다.
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com').replace(/\/$/, '')
const RESEND_FROM = process.env.RESEND_FROM || 'FYI <hello@salary-fyi.com>'
const CSV = 'data/lang-coldmail-audience.csv'

const CAMPAIGN = { a: 'coldmail-language-1', b: 'coldmail-language-2' }
if (!CAMPAIGN[arm]) { console.error(`--arm 은 a 또는 b (받은 값: ${arm})`); process.exit(1) }

// 제목은 템플릿 주석의 확정본과 한 글자도 다르면 안 된다. 여기서만 바꾸면 주석과
// 어긋나 다음 사람이 어느 쪽이 진짜인지 알 수 없게 된다 — 바꿀 땐 양쪽 같이.
const SUBJECT = {
  a: {
    ko: (n) => `${n}님, 한 칸이 비어서 공고 26개를 놓치고 있어요`,
    vi: (n) => `${n} ơi, thiếu 1 mục nên bạn đang bỏ lỡ 26 vị trí`,
  },
  b: {
    ko: (n) => `${n}님, 영어 또는 한국어 가능하신가요?`,
    vi: (n) => `${n} ơi, bạn biết tiếng Anh hoặc tiếng Hàn không?`,
  },
}

const TEMPLATE = { ko: 'scripts/lang-coldmail/email-ko.html', vi: 'scripts/lang-coldmail/email-vi.html' }

// 네 버튼 모두 같은 착지 페이지로 간다. cta 는 어느 버튼이 눌렸는지 남기고 화면을
// 미리 맞추는 용도 — 값 자체는 랜딩에서 받는다.
const ctaUrl = (email, campaign, kind) =>
  `${SITE}/lang?t=${encodeURIComponent(makeToken(email, campaign))}&cta=${kind}`

function render(tpl, p) {
  return tpl
    .replace(/\{\{name\}\}/g, p.name)
    .replace(/\{\{company\}\}/g, p.company)
    .replace(/\{\{position\}\}/g, p.position)
    .replace(/\{\{ctaScore\}\}/g, p.ctaScore)
    .replace(/\{\{ctaDaily\}\}/g, p.ctaDaily)
    .replace(/\{\{ctaBasic\}\}/g, p.ctaBasic)
    .replace(/\{\{ctaNone\}\}/g, p.ctaNone)
    .replace(/\{\{unsubscribeUrl\}\}/g, p.unsub)
    .replace(/\{\{pixelUrl\}\}/g, p.pixel)
}

function fill(row, campaign) {
  return {
    name: row.name || (lang === 'vi' ? 'bạn' : '회원'),
    company: row.company,
    position: row.position,
    ctaScore: ctaUrl(row.email, campaign, 'score'),
    ctaDaily: ctaUrl(row.email, campaign, 'daily'),
    ctaBasic: ctaUrl(row.email, campaign, 'basic'),
    ctaNone: ctaUrl(row.email, campaign, 'none'),
    unsub: `${SITE}/api/ktc/unsub?t=${encodeURIComponent(makeToken(row.email, campaign))}`,
    pixel: `${SITE}/api/o?t=${encodeURIComponent(makeToken(row.email, campaign))}`,
  }
}

function parseCsv(text) {
  const [head, ...lines] = text.trim().split('\n')
  const cols = head.split(',')
  return lines.map((l) => {
    const vals = l.match(/("(?:[^"]|"")*"|[^,]*)/g).filter((_, i) => i % 2 === 0)
    const o = {}
    cols.forEach((c, i) => { o[c] = String(vals[i] || '').replace(/^"|"$/g, '').replace(/""/g, '"') })
    return o
  })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const resendClient = async () => new (await import('resend')).Resend(process.env.RESEND_API_KEY)

;(async () => {
  const tpl = readFileSync(TEMPLATE[lang], 'utf8')

  // ── 테스트 발송 ── events 에 아무것도 남기지 않는다.
  if (testTo) {
    const resend = await resendClient()
    const campaign = CAMPAIGN[arm]
    for (const to of testTo.split(',').map((s) => s.trim()).filter(Boolean)) {
      const row = { email: to, name: lang === 'vi' ? 'Tây' : '유진', company: 'Jinosys', position: 'Mobile App & Web Service Developer (IoT Platform)' }
      const p = fill(row, campaign)
      const subject = SUBJECT[arm][lang](row.name)
      const r = await resend.emails.send({
        from: RESEND_FROM, to, subject: `[TEST/${arm.toUpperCase()}/${lang}] ` + subject, html: render(tpl, p),
      })
      if (r.error) throw new Error(`${to}: ${r.error.message || 'resend_error'}`)
      console.log(`✅ 테스트 발송 → ${to}  id=${r.data?.id}`)
      console.log(`   arm      ${arm.toUpperCase()} (${campaign})`)
      console.log(`   제목     ${subject}`)
      console.log(`   ctaScore ${p.ctaScore.slice(0, 96)}…`)
      await sleep(600) // Resend rate limit 2req/s
    }
    return
  }

  // ── 실발송 ──
  let rows
  try { rows = parseCsv(readFileSync(CSV, 'utf8')) } catch {
    console.error(`${CSV} 가 없습니다. 먼저: node scripts/lang-coldmail/build-audience.mjs --write`)
    process.exit(1)
  }
  const byArm = Object.fromEntries(Object.values(CAMPAIGN).map((c) => [c, rows.filter((r) => r.campaign === c).length]))
  console.log(`대상 ${rows.length}명 ·`, Object.entries(byArm).map(([k, v]) => `${k} ${v}`).join(' / '))
  console.log(`템플릿 ${TEMPLATE[lang]}`)
  for (const [k, c] of Object.entries(CAMPAIGN)) {
    console.log(`  ${k.toUpperCase()} 제목: ${SUBJECT[k][lang]('◯◯')}`)
  }

  if (!doSend) { console.log('\n[드라이런] 발송하지 않았습니다. --send 로 실발송 + coldmail_lang_sent 기록.'); return }

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const resend = await resendClient()
  let ok = 0, fail = 0
  for (const row of rows) {
    const k = Object.entries(CAMPAIGN).find(([, c]) => c === row.campaign)?.[0]
    if (!k) { console.error(`  ! 알 수 없는 campaign: ${row.campaign} (${row.email})`); fail++; continue }
    try {
      const p = fill(row, row.campaign)
      const resp = await resend.emails.send({
        from: RESEND_FROM, to: row.email, subject: SUBJECT[k][lang](p.name), html: render(tpl, p),
      })
      if (resp.error) throw new Error(resp.error.message || 'resend_error')
      await sb.from('events').insert({
        event: 'coldmail_lang_sent',
        user_id: row.user_id || null,
        meta: { campaign: row.campaign, lang, lead: leadId(row.email), resend_id: resp.data?.id || null },
      })
      ok++
    } catch (e) {
      fail++
      console.error(`  ! ${row.email}: ${e.message}`)
    }
    await sleep(600)
  }
  console.log(`\n발송 ${ok}건 · 실패 ${fail}건`)
})().catch((e) => { console.error(e); process.exit(1) })