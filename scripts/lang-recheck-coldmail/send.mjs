#!/usr/bin/env node
/**
 * 어학 재확인 콜드메일 6차 — 어학을 적었지만 자격증이 아닌 층.
 *
 *   node scripts/lang-recheck-coldmail/send.mjs                 # 드라이런
 *   node scripts/lang-recheck-coldmail/send.mjs --test a@b      # 테스트 1통(이벤트 안 남김)
 *   node scripts/lang-recheck-coldmail/send.mjs --send          # 실발송
 *   옵션: --max N · --lang ko|vi (기본 ko) · --allow-same-day
 *
 * 5차(coldmail-lang-recheck-1, 100통)와 같은 모집단에 본문을 바꿔 다시 보낸다.
 * 5차 실적: 도달 20 · 저장 16 · 자격증 회수 5. 저장한 16명 중 11명이 '그대로'를 눌렀고,
 * 본문이 "아직 없으시면 그대로라고만 알려주셔도 됩니다"로 끝나 면죄부를 준 탓이 크다.
 *
 * ※ 어학 메일 기수신자를 통째로 빼지 않는다 — 이 층은 애초에 어학 메일에 답해서 값이
 *   생긴 사람이 많다. 전원 제외하면 대상이 거의 남지 않는다. 5차 수신자만 뺀다.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { config } from 'dotenv'
import { makeToken as langToken, leadId } from '../../lib/ktcMailToken.js'

config({ path: '.env.local', quiet: true })

const argv = process.argv.slice(2)
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d }
const testTo = arg('--test')
const doSend = argv.includes('--send')
const allowSameDay = argv.includes('--allow-same-day')
const maxN = arg('--max') ? Number(arg('--max')) : 100
const lang = (arg('--lang', 'ko') || 'ko').toLowerCase()

const CAMPAIGN = 'coldmail-lang-recheck-2'
const TPL = `scripts/lang-recheck-coldmail/email-${lang}.html`
const SUBJECT = {
  ko: '어학 요건 공고에 추천해 드리지 못했습니다',
  vi: 'Chúng tôi chưa thể giới thiệu bạn cho vị trí yêu cầu ngoại ngữ',
}
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com').replace(/\/$/, '')
const RESEND_FROM = process.env.RESEND_FROM || 'FYI <hello@salary-fyi.com>'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* range() 로 1000 행씩 끊어 읽을 때 정렬이 없으면 페이지마다 순서가 달라진다 —
   같은 행이 두 번 나오거나 아예 빠진다. 실제로 '재확인 기수신'이 같은 명령에서
   0명 / 100명 을 오갔다. 0 으로 잡힌 회차에 발송했으면 5 차 수신자 100명에게
   그대로 다시 나갔을 것이다.
   id 는 유니크라 페이지 경계에서 동률이 없다 — created_at 정렬로는 같은 초에
   여러 행이 있을 때 여전히 흔들린다. */
async function all(table, cols, tweak) {
  let out = [], from = 0
  for (;;) {
    let q = sb.from(table).select(cols).order('id').range(from, from + 999)
    if (tweak) q = tweak(q)
    const { data, error } = await q
    if (error) throw error
    if (!data?.length) break
    out = out.concat(data)
    if (data.length < 1000) break
    from += 1000
  }
  return out
}

/* ── 대상 판정 ──────────────────────────────────────────────
   판정은 lib/langTier.js 의 certOf 와 같아야 한다. 다르면 이미 자격증을 낸 사람에게
   "확인할 수 없는 값"이라고 보내게 된다 — 그 사람 입장에선 우리가 못 읽은 것이다. */
const CERT_HEAD = /^(TOEIC|IELTS|TOEFL|VSTEP|APTIS|TOPIK|CEFR)\b/i
const certValue = (r) => String(r.english_cert || '').trim() || String(r.korean_cert || '').trim()

/* 랜딩이 대신 써넣은 값. /lang?cta=daily|basic|none 이 프리셀렉트하는 값이라
   본인이 쓴 말이 아니다. "전에 Basic 이라고 알려주셨죠"는 한 적 없는 말을 했다고
   하는 셈이라, 이 셋은 대상에서 뺀다. pages/lang.js 의 LEVEL_OF 와 같아야 한다. */
const BUTTON_VALUES = new Set(['intermediate', 'basic', 'none'])

/* CEFR 등급 표기(B1·B2·C1…)는 별도 캠페인으로 간다 — 그 값이 진짜 CEFR 인지부터
   확인해야 하고(Cambridge·Aptis·VSTEP 이 그 척도로 발급된다), 질문이 다르다. */
const CEFR_TOKEN = /\b[ABC][12]\b/i

/* 문자열 안에 시험명이 들어 있으면 자기서술이 아니다 — "Fluent – TOEIC 865",
   "6.5 IELTS" 처럼 certOf 가 맨 앞만 봐서 놓치는 값들이다. 이 사람들에게
   "확인할 수 없는 값"이라고 보내면 본인은 점수를 적었다고 생각한다. */
const TEST_ANYWHERE = /\b(TOEIC|IELTS|TOEFL|TOPIK|VSTEP|APTIS|CEFR|OPIC|HSK|JLPT|Cambridge|Linguaskill)\b/i

/* 이번 회차가 말을 거는 층 — 자기평가를 높게 적은 사람들. 점수가 있을 가능성이
   "Cơ bản"(기초)이라고 적은 사람보다 높다. 하위 서술에 보내면 '그대로'만 돌아온다. */
const HIGH_SELF = /^(fluent|advanced|proficient|business|upper|conversational|intermediate\b.+)/i

/* 본문 문장과 이탈구 링크에 값이 그대로 박힌다. 114 자짜리가 실제로 있어서
   "…는 저희가 확인할 수 없는 값이라" 앞이 통째로 문단이 된다. */
const MAX_CERT_LEN = 40

const eligible = (p) => {
  const v = certValue(p)
  return !!p.email && !!v && !CERT_HEAD.test(v) && !BUTTON_VALUES.has(v.toLowerCase())
    && !CEFR_TOKEN.test(v) && !TEST_ANYWHERE.test(v)
    && HIGH_SELF.test(v) && v.length <= MAX_CERT_LEN
}

// ── 렌더 ────────────────────────────────────────────────
const ctaUrl = (email, kind) =>
  `${SITE}/lang?t=${encodeURIComponent(langToken(email, CAMPAIGN))}&cta=${kind}&lang=${lang}`

const fill = (row) => ({
  name: row.name || (lang === 'vi' ? 'bạn' : '회원'),
  cert: row.cert,
  ctaScore: ctaUrl(row.email, 'score'),
  ctaSame: ctaUrl(row.email, 'same'),
  unsub: `${SITE}/api/ktc/unsub?t=${encodeURIComponent(langToken(row.email, CAMPAIGN))}`,
  pixel: `${SITE}/api/o?t=${encodeURIComponent(langToken(row.email, CAMPAIGN))}`,
})

function render(tpl, p) {
  const html = tpl
    // 검수용 주석에 파일 경로·캠페인 ID·판단 근거가 들어 있다. 한국어로 나가면
    // 수신자가 메일 소스를 열었을 때 그대로 보인다.
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\{\{name\}\}/g, p.name)
    .replace(/\{\{cert\}\}/g, p.cert)
    .replace(/\{\{ctaScore\}\}/g, p.ctaScore)
    .replace(/\{\{ctaSame\}\}/g, p.ctaSame)
    .replace(/\{\{unsubscribeUrl\}\}/g, p.unsub)
    .replace(/\{\{pixelUrl\}\}/g, p.pixel)
  // 한 통이라도 잘못 나가면 회수할 수 없다. 나가기 직전에 막는다.
  const left = html.match(/\{\{\w+\}\}/g)
  if (left) throw new Error(`플레이스홀더 미치환: ${[...new Set(left)].join(', ')}`)
  // 내부 기준(등급 체계·실적 숫자)은 본문에 쓰지 않기로 했다. 되돌아오면 여기서 걸린다.
  if (/등급/.test(html)) throw new Error('본문에 등급 언급이 남아 있다')
  return html
}

// ── 실행 ────────────────────────────────────────────────
const tpl = readFileSync(TPL, 'utf8')
const resend = new (await import('resend')).Resend(process.env.RESEND_API_KEY)

if (testTo) {
  for (const to of testTo.split(',').map((s) => s.trim()).filter(Boolean)) {
    const p = fill({ email: to, name: lang === 'vi' ? 'Tây' : '유진', cert: 'Fluent' })
    const r = await resend.emails.send({
      from: RESEND_FROM, to, subject: `[TEST/recheck/${lang}] ${SUBJECT[lang]}`, html: render(tpl, p),
    })
    if (r.error) throw new Error(`${to}: ${r.error.message || 'resend_error'}`)
    console.log(`✅ 테스트 발송 → ${to}  id=${r.data?.id}`)
    console.log(`   {{cert}} = ${p.cert} · events 에는 아무것도 남기지 않았습니다`)
    await sleep(600)
  }
  process.exit(0)
}

const [profiles, evts] = await Promise.all([
  all('user_profiles', 'id,email,full_name,english_cert,korean_cert'),
  all('events', 'user_id,event,meta,created_at', (q) => q.ilike('event', 'coldmail%')),
])

const unsubLeads = new Set(evts.filter((e) => e.event === 'coldmail_unsub').map((e) => e.meta?.lead).filter(Boolean))
// 5차 수신자만 뺀다(위 주석 참고). 6차를 두 번 돌려도 중복 발송되지 않게 자기 자신도 뺀다.
const rechecked = new Set(evts
  .filter((e) => e.event === 'coldmail_lang_sent' && /^coldmail-lang-recheck/.test(e.meta?.campaign || '') && e.user_id)
  .map((e) => e.user_id))

// 오늘 이미 다른 콜드메일을 받은 사람. 날짜는 ICT(베트남) 기준 — 수신자가 체감하는 '오늘'이다.
const ictDay = (iso) => new Date(new Date(iso).getTime() + 7 * 3600e3).toISOString().slice(0, 10)
const today = ictDay(new Date().toISOString())
const sentToday = {}
for (const e of evts) {
  if (!e.event.endsWith('_sent') || !e.user_id || ictDay(e.created_at) !== today) continue
  ;(sentToday[e.user_id] = sentToday[e.user_id] || new Set()).add(e.meta?.campaign || '?')
}

const base = profiles.filter((p) => eligible(p) && !rechecked.has(p.id) && !unsubLeads.has(leadId(p.email)))
const sameDayHit = base.filter((p) => sentToday[p.id])
let targets = base.filter((p) => allowSameDay || !sentToday[p.id])

/* 자기평가가 높을수록 먼저 보낸다 — 점수를 갖고 있을 가능성이 그쪽이 높다.
   같은 값 안에서는 최신 갱신순. updated_at 은 어학과 무관한 수정에도 갱신되므로
   '어학 등록 시점'이 아니라 정렬 보조로만 쓴다. */
const RANK = { fluent: 0, advanced: 1, proficient: 1, business: 2, upper: 3, conversational: 4 }
const rankOf = (v) => { const s = v.toLowerCase(); return Object.entries(RANK).find(([k]) => s.startsWith(k))?.[1] ?? 5 }
targets = targets
  .map((p) => ({ user_id: p.id, email: p.email, name: p.full_name || '', cert: certValue(p) }))
  .sort((a, b) => rankOf(a.cert) - rankOf(b.cert) || a.cert.localeCompare(b.cert))
if (maxN) targets = targets.slice(0, maxN)

const byCert = targets.reduce((m, t) => ({ ...m, [t.cert]: (m[t.cert] || 0) + 1 }), {})
console.log(`캠페인 ${CAMPAIGN} · 템플릿 ${TPL}`)
console.log(`제목   ${SUBJECT[lang]}`)
console.log(`모수 ${base.length}명 → 발송 ${targets.length}명 (--max ${maxN})`)
console.log(`재확인 기수신 ${rechecked.size}명 · 수신거부 ${unsubLeads.size}명 (자동 제외)`)
console.log(`오늘 다른 콜드메일 수신 ${sameDayHit.length}명 ${allowSameDay ? '→ --allow-same-day 로 포함' : '(제외)'}`)
console.log(`이름 없는 대상 ${targets.filter((t) => !t.name).length}명 (호칭 폴백)`)
console.log(`값 구성 ${Object.entries(byCert).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${v}`).join(' · ')}`)

if (!doSend) {
  console.log('\n[드라이런] 발송하지 않았습니다. --send 로 실발송 + coldmail_lang_sent 기록.')
  for (const t of targets.slice(0, 3)) console.log(`  ${t.email}  ${t.name || '(이름 없음)'}  "${t.cert}"`)
  process.exit(0)
}

let ok = 0, fail = 0
for (const row of targets) {
  try {
    const p = fill(row)
    const resp = await resend.emails.send({
      from: RESEND_FROM, to: row.email, subject: SUBJECT[lang], html: render(tpl, p),
    })
    if (resp.error) throw new Error(resp.error.message || 'resend_error')
    // cert 를 같이 남긴다 — 나중에 "어떤 값에게 보냈을 때 점수가 돌아왔나"를
    // 프로필 현재값이 아니라 발송 시점 값으로 봐야 한다(그 사이에 바뀐다).
    await sb.from('events').insert({
      event: 'coldmail_lang_sent',
      user_id: row.user_id,
      meta: { campaign: CAMPAIGN, lang, cert: row.cert, lead: leadId(row.email), resend_id: resp.data?.id || null },
    })
    ok++
  } catch (e) {
    fail++
    console.error(`  ! ${row.email}: ${e.message}`)
  }
  await sleep(600)
}
console.log(`\n발송 ${ok}건 · 실패 ${fail}건`)
