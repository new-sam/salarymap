#!/usr/bin/env node
/**
 * 어학 7차('어느 시험이었나요') 발송 대상 확정.
 *
 *   node scripts/lang-exam-coldmail/build-audience.mjs            # 드라이런(요약만)
 *   node scripts/lang-exam-coldmail/build-audience.mjs --write     # data/ 에 CSV 저장
 *
 * 대상: english_cert 가 맨 등급값인 사람. "B2" 한 글자처럼 등급만 있고 시험명이 없어
 * certOf 가 자격증으로 못 읽는 값이다. 여기에 시험명만 얹으면 미상에서 급수로 넘어온다.
 *
 * 대상 조건 (전부 AND)
 *   1. english_cert 가 /^[A-C][12]$/    — 맨 등급값
 *   2. 이메일 보유
 *   3. 수신거부 아님
 *   4. 이 캠페인 기수신 아님
 *
 * ※ 등급이 섞인 값은 일부러 뺀다 — "B2 Level"·"Intermediate (B2)" 뿐 아니라
 *   "DELF B1"·"B2 Cambridge"·"VNU Test B1"(이미 다른 시험명이 붙음)과 "B2–C1"(범위)이
 *   같은 층에 섞여 있다. 원탭으로 VSTEP·APTIS 를 얹으면 원문이 사라진다.
 *   그 30명은 폼(cta=exam)으로만 받아야 한다.
 *
 * ※ korean_cert 맨 등급값(1명)도 뺀다. 한국어 척도는 TOPIK 이라 VSTEP·APTIS 를
 *   얹는 게 말이 안 된다.
 *
 * ※ 정렬은 md5(user_id + SALT) — 가입일·지원일 같은 실제 속성과 무관해야 100명을
 *   잘라도 편향이 안 생긴다. SALT 를 바꾸면 명단이 통째로 바뀐다. 발송 후 건들지 말 것.
 */
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { writeFileSync, mkdirSync } from 'node:fs'
import { config } from 'dotenv'
import { leadId } from '../../lib/ktcMailToken.js'
import { certOf } from '../../lib/langTier.js'

config({ path: '.env.local', quiet: true })

const argv = process.argv.slice(2)
const flag = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d }

const SALT = 'lang-exam-2026-08'     // 고정. 변경 = 명단 전체 변경.
const CAMPAIGN = 'coldmail-lang-exam-1'
/* 기본은 조건 충족 전원이다. 상한을 두면 남은 사람이 '예비'로 떠 있는데, 이 회차는
   A/B 도 없고 뒤에 이어 붙일 웨이브도 없어서 그 예비가 소진될 자리가 없다.
   좁히고 싶을 때만 --limit 으로 자른다. */
const LIMIT = flag('--limit') ? Number(flag('--limit')) : Infinity
const OUT = flag('--out', 'data/lang-exam-audience.csv')

/* recheck-1 기발송자를 뺄지. 기본은 뺀다 — 같은 사람에게 "점수 넣어주세요" 다음에
   "어느 시험이었나요"를 연달아 보내면 두 캠페인의 응답이 서로 오염된다.
   모수가 모자라면 --include-recheck 로 푼다(그때는 결과를 따로 읽을 것). */
const INCLUDE_RECHECK = argv.includes('--include-recheck')

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function all(table, cols, tweak) {
  let out = [], from = 0
  for (;;) {
    let q = sb.from(table).select(cols).range(from, from + 999)
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

const t = (v) => String(v || '').trim()
const BARE = /^[A-C][12]$/i
const HAS_LEVEL = /\b[A-C][12]\b/i
const rank = (id) => createHash('md5').update(id + SALT).digest('hex')

const main = async () => {
  const [profiles, coldEvents] = await Promise.all([
    all('user_profiles', 'id,email,full_name,english_cert,korean_cert,resume_url'),
    all('events', 'user_id,event,meta', (q) => q.ilike('event', 'coldmail%')),
  ])

  const unsubLeads = new Set(
    coldEvents.filter((e) => e.event === 'coldmail_unsub').map((e) => e.meta?.lead).filter(Boolean),
  )
  const sentIn = (re) => new Set(
    coldEvents.filter((e) => e.event === 'coldmail_lang_sent' && re.test(e.meta?.campaign || ''))
      .map((e) => e.user_id).filter(Boolean),
  )
  const examSent = sentIn(/^coldmail-lang-exam/)      // 이 캠페인 기수신 — 항상 제외
  const recheckSent = sentIn(/^coldmail-lang-recheck/)

  const bare = profiles.filter((p) => BARE.test(t(p.english_cert)))
  const eligible = bare.filter((p) =>
    p.email
    && !unsubLeads.has(leadId(p.email))
    && !examSent.has(p.id)
    && (INCLUDE_RECHECK || !recheckSent.has(p.id)),
  )

  const ordered = eligible.slice().sort((a, b) => rank(a.id).localeCompare(rank(b.id)))
  const picked = ordered.slice(0, LIMIT)
  const rows = picked.map((p) => ({
    user_id: p.id,
    email: p.email,
    name: p.full_name || '',
    cert: t(p.english_cert).toUpperCase(),   // 메일의 {{cert}} — 본인이 볼 현재 값
    campaign: CAMPAIGN,
  }))

  /* 확정 시 어느 급수로 가는지 미리 센다. 이 회차의 성과는 "123명 급수화"가 아니라
     "실제로 후보 추림에서 힘이 붙는 B급 이상 몇 명"이라, 그 숫자를 발송 전에 박아둔다.
     VSTEP·APTIS·CEFR 는 급수표가 같으므로(langTier.GRADES) 어느 버튼을 눌러도 동일하다. */
  const TIER = { C1: 'A급', C2: 'A급', B2: 'B급', B1: 'C급', A1: 'C급', A2: 'C급' }
  const tiers = {}
  for (const r of rows) { const k = TIER[r.cert] || '?'; tiers[k] = (tiers[k] || 0) + 1 }

  // 대상에서 뺀 층 — 왜 뺐는지 숫자로 같이 보여준다. 조용히 줄이면 "전부 커버했다"로 읽힌다.
  const mixed = profiles.filter((p) => t(p.english_cert) && !certOf(p.english_cert)
    && HAS_LEVEL.test(t(p.english_cert)) && !BARE.test(t(p.english_cert)))
  const koBare = profiles.filter((p) => BARE.test(t(p.korean_cert)))

  console.log(`대상 조건        english_cert 가 맨 등급값 · 수신거부 아님 · 이 캠페인 미수신`)
  console.log(`맨 등급값 전체    ${bare.length}명`)
  console.log(`  − 이메일 없음   ${bare.filter((p) => !p.email).length}명`)
  console.log(`  − 수신거부      ${bare.filter((p) => p.email && unsubLeads.has(leadId(p.email))).length}명`)
  console.log(`  − 이 캠페인 기수신 ${bare.filter((p) => examSent.has(p.id)).length}명`)
  console.log(`  − recheck 기발송 ${INCLUDE_RECHECK ? '포함' : `${bare.filter((p) => recheckSent.has(p.id)).length}명`}`)
  console.log(`조건 충족        ${eligible.length}명`)
  console.log(`선정             ${rows.length}명`)
  console.log(`예비(미발송)      ${eligible.length - rows.length}명`)
  console.log(`\n확정 시 급수     ${Object.entries(tiers).sort().map(([k, v]) => `${k} ${v}`).join(' · ')}`)
  console.log(`\n[대상 아님] 등급 섞인 값 ${mixed.length}명 — 원탭 금지(원문 소실). 폼으로만 받을 것`)
  console.log(`[대상 아님] korean_cert 맨 등급값 ${koBare.length}명 — 한국어 척도는 TOPIK`)

  if (!argv.includes('--write')) {
    console.log('\n[드라이런] 저장하지 않았습니다. --write 로 CSV 를 만듭니다.')
    console.log('샘플 3건:')
    for (const r of rows.slice(0, 3)) console.log(`  ${r.email}  cert=${r.cert}`)
    return
  }

  mkdirSync('data', { recursive: true })
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`
  const csv = ['user_id,email,name,cert,campaign']
    .concat(rows.map((r) => [r.user_id, r.email, r.name, r.cert, r.campaign].map(esc).join(',')))
    .join('\n')
  writeFileSync(OUT, csv)
  console.log(`\n저장: ${OUT}`)
  console.log('※ data/ 는 gitignore 다. 발송 전까지 지우지 말 것.')
}

main().catch((e) => { console.error(e); process.exit(1) })