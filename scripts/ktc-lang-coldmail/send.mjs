#!/usr/bin/env node
/**
 * KTC 유입자 어학 수집 콜드메일 — K-Tech College 로 들어와 FYI 계정까지 만들었지만
 * 어학이 비어 있는 회원 대상. 단일 버전(A/B 없음).
 *
 *   node scripts/ktc-lang-coldmail/send.mjs --test you@x.com    # 테스트(events 안 남김)
 *   node scripts/ktc-lang-coldmail/send.mjs                     # 드라이런
 *   node scripts/ktc-lang-coldmail/send.mjs --send [--max N]    # 실발송
 *
 * 대상 조건 (전부 AND)
 *   1. ktc_candidates 에 이메일이 있음        — "KTC 로 들어오셨죠"가 참이어야 한다
 *   2. FYI 계정 있음(user_profiles)           — /lang 은 프로필이 없으면 저장을 못 한다
 *   3. 어학 3칸 모두 빔                        — 물어볼 게 있어야 보낸다
 *   4. 오늘 어학 콜드메일 미수신               — 하루에 같은 요청을 두 번 하지 않는다
 *   5. 수신거부 아님
 *   6. 이 캠페인 미수신                        — 중복 발송 방지
 *
 * 이벤트는 어학 캠페인과 같은 이름을 쓴다(coldmail_lang_sent/_click/_fill).
 * 전환 정의가 '어학 입력'으로 동일해서다. 구분은 meta.campaign 으로만 한다.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { config } from 'dotenv'
import { makeToken, leadId } from '../../lib/ktcMailToken.js'

config({ path: '.env.local', quiet: true })

const argv = process.argv.slice(2)
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d }
const testTo = arg('--test')
const doSend = argv.includes('--send')
const maxN = arg('--max') ? Number(arg('--max')) : null

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com').replace(/\/$/, '')
const RESEND_FROM = process.env.RESEND_FROM || 'FYI <hello@salary-fyi.com>'
const CAMPAIGN = 'coldmail-ktc-lang-1'
const TEMPLATE = 'scripts/ktc-lang-coldmail/email-vi.html'
const SUBJECT = (n) => `${n} ơi, thiếu 1 ô nên bạn chưa ứng tuyển được`

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function all(table, cols) {
  let out = [], from = 0
  for (;;) {
    const { data, error } = await sb.from(table).select(cols).range(from, from + 999)
    if (error) throw error
    if (!data?.length) break
    out = out.concat(data)
    if (data.length < 1000) break
    from += 1000
  }
  return out
}

/* KTC 지원 이력 문장. 회사명이 있으면 그걸 쓰고, 없으면 회사명 없는 문장으로 바꾼다.
   빈칸이나 'undefined' 가 나가면 한 통으로 신뢰를 잃는다 — 123명 중 28명은 기록이 없다. */
const ktcLine = (company) => (company
  ? `Bạn từng ứng tuyển vào <b style="color:#191F28;">${company}</b> qua K-Tech College. Chúng tôi vẫn nhớ.`
  : 'Bạn từng tìm hiểu cơ hội tại công ty Hàn Quốc qua K-Tech College.')

/* 버튼은 어학 콜드메일(lang-coldmail)과 같은 넷을 쓴다 — 같은 날 13~16% 로 전환된
   형태다. cta 는 어느 버튼이 눌렸는지만 남기고 값은 랜딩에서 받는다.
   lang=vi 를 붙이는 이유: /lang 기본값이 vi 라 없어도 되지만, 명시해두면 한국어본을
   보낼 때 여기만 바꾸면 된다. */
const ctaUrl = (email, kind) =>
  `${SITE}/lang?t=${encodeURIComponent(makeToken(email, CAMPAIGN))}&cta=${kind}&lang=vi`

const fill = (row) => ({
  name: row.name || 'bạn',
  ktcLine: ktcLine(row.company),
  ctaScore: ctaUrl(row.email, 'score'),
  ctaDaily: ctaUrl(row.email, 'daily'),
  ctaBasic: ctaUrl(row.email, 'basic'),
  ctaNone: ctaUrl(row.email, 'none'),
  unsub: `${SITE}/api/ktc/unsub?t=${encodeURIComponent(makeToken(row.email, CAMPAIGN))}`,
  pixel: `${SITE}/api/o?t=${encodeURIComponent(makeToken(row.email, CAMPAIGN))}`,
})

const render = (tpl, p) => tpl
  .replace(/\{\{name\}\}/g, p.name)
  .replace(/\{\{ktcLine\}\}/g, p.ktcLine)
  .replace(/\{\{ctaScore\}\}/g, p.ctaScore)
  .replace(/\{\{ctaDaily\}\}/g, p.ctaDaily)
  .replace(/\{\{ctaBasic\}\}/g, p.ctaBasic)
  .replace(/\{\{ctaNone\}\}/g, p.ctaNone)
  .replace(/\{\{unsubscribeUrl\}\}/g, p.unsub)
  .replace(/\{\{pixelUrl\}\}/g, p.pixel)

;(async () => {
  const tpl = readFileSync(TEMPLATE, 'utf8')
  const resend = new (await import('resend')).Resend(process.env.RESEND_API_KEY)

  if (testTo) {
    for (const to of testTo.split(',').map((s) => s.trim()).filter(Boolean)) {
      // 회사명 있는 경우로 테스트한다 — 95/123 이 이 형태다.
      const row = { email: to, name: 'Tây', company: 'Samsung Electronics Vietnam' }
      const p = fill(row)
      const r = await resend.emails.send({
        from: RESEND_FROM, to, subject: `[TEST] ${SUBJECT(row.name)}`, html: render(tpl, p),
      })
      if (r.error) throw new Error(`${to}: ${r.error.message || 'resend_error'}`)
      console.log(`✅ 테스트 발송 → ${to}  id=${r.data?.id}`)
      console.log(`   제목     ${SUBJECT(row.name)}`)
      console.log(`   ctaScore ${p.ctaScore.slice(0, 100)}…`)
      await sleep(600)
    }
    return
  }

  const [ktc, profiles, evts] = await Promise.all([
    all('ktc_candidates', 'email,applied_company'),
    all('user_profiles', 'id,email,full_name,english_cert,korean_cert,languages'),
    all('events', 'user_id,event,meta'),
  ])

  const blank = (v) => !String(v || '').trim()
  const noLanguage = (p) =>
    blank(p.english_cert) && blank(p.korean_cert)
    && !(Array.isArray(p.languages) && p.languages.some((l) => String(l?.name || '').trim()))

  // KTC 이메일 → 지원처. 같은 사람이 여러 번 지원했으면 첫 건을 쓴다.
  const ktcBy = {}
  for (const k of ktc) {
    const e = String(k.email || '').toLowerCase()
    if (e && !ktcBy[e]) ktcBy[e] = k
  }
  const unsubLeads = new Set(evts.filter((e) => e.event === 'coldmail_unsub').map((e) => e.meta?.lead).filter(Boolean))
  const langSent = new Set(evts.filter((e) => e.event === 'coldmail_lang_sent' && e.user_id).map((e) => e.user_id))
  const already = new Set(
    evts.filter((e) => e.event === 'coldmail_lang_sent' && e.meta?.campaign === CAMPAIGN)
      .map((e) => e.user_id).filter(Boolean),
  )

  let targets = profiles.filter((p) => {
    const e = String(p.email || '').toLowerCase()
    return e && ktcBy[e] && noLanguage(p)
      && !langSent.has(p.id) && !already.has(p.id) && !unsubLeads.has(leadId(p.email))
  }).map((p) => ({
    user_id: p.id,
    email: p.email,
    name: p.full_name || '',
    company: ktcBy[String(p.email).toLowerCase()]?.applied_company || '',
  }))

  if (maxN) targets = targets.slice(0, maxN)

  const withCo = targets.filter((t) => t.company).length
  console.log(`대상 ${targets.length}명 · 캠페인 ${CAMPAIGN}`)
  console.log(`템플릿 ${TEMPLATE}`)
  console.log(`제목 ${SUBJECT('◯◯')}`)
  console.log(`KTC 지원처 기록 있음 ${withCo}명 / 없음 ${targets.length - withCo}명 (문장이 갈린다)`)
  console.log(`오늘 어학메일 수신자 ${langSent.size}명 · 수신거부 ${unsubLeads.size}명 (자동 제외)`)

  if (!doSend) {
    console.log('\n[드라이런] 발송하지 않았습니다. --send 로 실발송 + coldmail_lang_sent 기록.')
    for (const t of targets.slice(0, 3)) console.log(`  ${t.email}  ${t.company || '(지원처 기록 없음)'}`)
    return
  }

  let ok = 0, fail = 0
  for (const row of targets) {
    try {
      const p = fill(row)
      const resp = await resend.emails.send({
        from: RESEND_FROM, to: row.email, subject: SUBJECT(p.name), html: render(tpl, p),
      })
      if (resp.error) throw new Error(resp.error.message || 'resend_error')
      await sb.from('events').insert({
        event: 'coldmail_lang_sent',
        user_id: row.user_id,
        meta: { campaign: CAMPAIGN, lang: 'vi', lead: leadId(row.email), resend_id: resp.data?.id || null },
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