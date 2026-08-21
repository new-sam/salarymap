#!/usr/bin/env node
/**
 * 어학 7차('어느 시험이었나요') 발송. 발신: Resend, RESEND_FROM.
 *
 *   node scripts/lang-exam-coldmail/send.mjs --test you@x.com --lang ko
 *   node scripts/lang-exam-coldmail/send.mjs                    # 드라이런(대상·제목만)
 *   node scripts/lang-exam-coldmail/send.mjs --send             # 실발송 + coldmail_lang_sent 기록
 *
 * 테스트 발송은 제목에 [TEST] 를 붙이고 events 에 아무것도 남기지 않는다 —
 * 테스트가 분모에 섞이면 전환율이 조용히 틀어진다.
 *
 * 대상 명단은 build-audience.mjs 가 만든 data/lang-exam-audience.csv 를 읽는다.
 * 여기서 다시 뽑지 않는다 — 두 스크립트가 각자 뽑으면 명단이 갈린다.
 *
 * 제목 A/B 가 없다. 이 회차의 질문은 "어느 시험이었나"이고 답은 버튼으로 갈린다
 * (vstep · aptis · exam · self). 제목까지 쪼개면 100통으로 두 축을 다 못 읽는다.
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
const lang = (arg('--lang', 'vi') || 'vi').toLowerCase()   // 실발송 기본은 베트남어
const doSend = has('--send')

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com').replace(/\/$/, '')
const RESEND_FROM = process.env.RESEND_FROM || 'FYI <hello@salary-fyi.com>'
const CSV = arg('--csv', 'data/lang-exam-audience.csv')
const CAMPAIGN = 'coldmail-lang-exam-1'

/* 회차 표기. 캠페인 ID 와 따로 두는 이유: ID 는 "무엇을 물었나"(exam)를 뜻하고
   round 는 "어학 재확인 시리즈의 몇 번째인가"를 뜻한다. 둘을 한 값에 섞으면
   대시보드에서 계열로 묶는 것과 순서대로 세우는 것 중 하나를 포기해야 한다.

   round 는 발송 이벤트에만 실린다 — 클릭·저장은 랜딩에서 찍히는데 거기선 회차를
   모른다. lang-coldmail 의 wave 와 같은 방식으로, 대시보드가 발송 기록에서
   user_id → round 를 만들어 뒤 단계에 되붙인다. */
const ROUND = 'R7'

/* 제목은 템플릿 주석의 확정본과 한 글자도 다르면 안 된다 — 바꿀 땐 양쪽 같이.

   lang-recheck-coldmail 의 확정 문구를 그대로 쓴다(scripts/lang-recheck-coldmail/send.mjs).
   같은 층에 같은 사실을 말하는 제목이라 새로 짓지 않는다 — 캠페인마다 표현이 갈리면
   수신자에게는 매번 다른 이야기로 보이고, 제목별 성과도 서로 비교할 수 없게 된다.

   {{cert}} 를 제목에 넣지 않는다. 손실("추천해 드리지 못했다")이 훅이고, 값이 무엇인지는
   열고 나서 본문 첫 줄이 말한다. 그래서 제목은 전원 동일하다. */
const SUBJECT = {
  ko: () => '어학 요건 공고에 추천해 드리지 못했습니다',
  vi: () => 'Chúng tôi chưa thể giới thiệu bạn cho vị trí yêu cầu ngoại ngữ',
}

const TEMPLATE = { ko: 'scripts/lang-exam-coldmail/email-ko.html', vi: 'scripts/lang-exam-coldmail/email-vi.html' }

/* 네 버튼 모두 같은 착지 페이지로 간다. cta 가 무엇을 누른 건지 남긴다.
     vstep·aptis — 원탭 확정. 랜딩이 뜨자마자 저장된 등급에 시험명만 얹는다.
     exam        — 폼. 다른 시험명·점수를 본인이 고른다.
     self        — 시험이 아니라는 확정. 값은 그대로 두고 기록만 남는다.
   lang 을 같이 싣는 이유는 lang-coldmail/send.mjs 와 같다 — 수신자는 전원 로그아웃
   상태로 들어와서 랜딩이 언어를 추측할 방법이 없다. */
const ctaUrl = (email, kind) =>
  `${SITE}/lang?t=${encodeURIComponent(makeToken(email, CAMPAIGN))}&cta=${kind}&lang=${lang}`

const render = (tpl, p) => tpl
  .replace(/\{\{name\}\}/g, p.name)
  .replace(/\{\{cert\}\}/g, p.cert)
  .replace(/\{\{ctaVstep\}\}/g, p.ctaVstep)
  .replace(/\{\{ctaAptis\}\}/g, p.ctaAptis)
  .replace(/\{\{ctaExam\}\}/g, p.ctaExam)
  .replace(/\{\{ctaSelf\}\}/g, p.ctaSelf)
  .replace(/\{\{unsubscribeUrl\}\}/g, p.unsub)
  .replace(/\{\{pixelUrl\}\}/g, p.pixel)

function fill(row) {
  return {
    name: row.name || (lang === 'vi' ? 'bạn' : '회원'),
    cert: String(row.cert || '').toUpperCase(),
    ctaVstep: ctaUrl(row.email, 'vstep'),
    ctaAptis: ctaUrl(row.email, 'aptis'),
    ctaExam: ctaUrl(row.email, 'exam'),
    ctaSelf: ctaUrl(row.email, 'self'),
    unsub: `${SITE}/api/ktc/unsub?t=${encodeURIComponent(makeToken(row.email, CAMPAIGN))}`,
    pixel: `${SITE}/api/o?t=${encodeURIComponent(makeToken(row.email, CAMPAIGN))}`,
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
    for (const to of testTo.split(',').map((s) => s.trim()).filter(Boolean)) {
      const row = { email: to, name: lang === 'vi' ? 'Tây' : '유진', cert: arg('--cert', 'B2') }
      const p = fill(row)
      const subject = SUBJECT[lang](p.name, p.cert)
      const r = await resend.emails.send({
        from: RESEND_FROM, to, subject: `[TEST/${lang}] ` + subject, html: render(tpl, p),
      })
      if (r.error) throw new Error(`${to}: ${r.error.message || 'resend_error'}`)
      console.log(`✅ 테스트 발송 → ${to}  id=${r.data?.id}`)
      console.log(`   제목     ${subject}`)
      console.log(`   ctaVstep ${p.ctaVstep.slice(0, 96)}…`)
      await sleep(600) // Resend rate limit 2req/s
    }
    return
  }

  // ── 실발송 ──
  let rows
  try { rows = parseCsv(readFileSync(CSV, 'utf8')) } catch {
    console.error(`${CSV} 가 없습니다. 먼저: node scripts/lang-exam-coldmail/build-audience.mjs --write`)
    process.exit(1)
  }

  /* cert 가 비었으면 제목과 본문이 «"" 한 글자입니다» 로 나간다. 한 통으로 신뢰를 잃는
     자리라 발송 자체를 막는다 — build-audience 가 맨 등급값만 뽑으므로 여기가 비어 있으면
     명단이 잘못 만들어진 것이다. */
  const bad = rows.filter((r) => !/^[A-C][12]$/i.test(String(r.cert || '').trim()))
  if (bad.length) {
    console.error(`cert 가 맨 등급값이 아닌 행 ${bad.length}건 — 명단을 다시 만들어야 합니다.`)
    for (const r of bad.slice(0, 5)) console.error(`  ${r.email}  cert=${JSON.stringify(r.cert)}`)
    process.exit(1)
  }

  const byCert = {}
  for (const r of rows) { const k = String(r.cert).toUpperCase(); byCert[k] = (byCert[k] || 0) + 1 }
  console.log(`대상 ${rows.length}명 · ${Object.entries(byCert).sort().map(([k, v]) => `${k} ${v}`).join(' · ')}`)
  console.log(`템플릿 ${TEMPLATE[lang]}`)
  console.log(`캠페인 ${CAMPAIGN} · 회차 ${ROUND}`)
  console.log(`제목   ${SUBJECT[lang]('◯◯', 'B2')}`)

  if (!doSend) { console.log('\n[드라이런] 발송하지 않았습니다. --send 로 실발송 + coldmail_lang_sent 기록.'); return }

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const resend = await resendClient()
  let ok = 0, fail = 0
  for (const row of rows) {
    try {
      const p = fill(row)
      const resp = await resend.emails.send({
        from: RESEND_FROM, to: row.email, subject: SUBJECT[lang](p.name, p.cert), html: render(tpl, p),
      })
      if (resp.error) throw new Error(resp.error.message || 'resend_error')
      await sb.from('events').insert({
        event: 'coldmail_lang_sent',
        user_id: row.user_id || null,
        // cert 를 같이 남긴다 — 발송 시점의 값을 박아둬야 나중에 "무엇이 무엇으로
        // 바뀌었나"를 이벤트만으로 복원할 수 있다(프로필은 재파싱이 덮는다).
        meta: { campaign: CAMPAIGN, lang, round: ROUND, lead: leadId(row.email), cert: p.cert, resend_id: resp.data?.id || null },
      })
      ok++
    } catch (e) {
      fail++
      console.error(`  ! ${row.email}: ${e.message}`)
    }
    await sleep(600)
  }
  console.log(`\n발송 ${ok}건 · 실패 ${fail}건`)
})()