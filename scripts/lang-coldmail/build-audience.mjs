#!/usr/bin/env node
/**
 * 어학 콜드메일 제목 A/B 발송 대상 확정.
 *
 *   node scripts/lang-coldmail/build-audience.mjs           # 드라이런(요약만)
 *   node scripts/lang-coldmail/build-audience.mjs --write    # data/ 에 CSV 저장
 *
 * 왜 스크립트인가: 사람이 손으로 200명을 고르면 arm 배정에 편향이 섞이고, 다시
 * 돌렸을 때 명단이 달라져 사후 분석에서 "누가 A였는지"를 복원할 수 없다. 여기서
 * 정한 규칙은 전부 결정적(deterministic)이라 몇 번을 돌려도 같은 명단이 나온다.
 *
 * 대상 조건 (전부 AND)
 *   1. 이력서 보유 (resume_url)          — "이력서는 확인했다"가 참이어야 메일 첫 줄이 성립
 *   2. 어학 3칸이 모두 빔                 — english_cert / korean_cert / languages
 *   3. 지원 경험 있음                     — {{company}}·{{position}} 개인화가 빈칸이면 안 된다
 *   4. 콜드메일 미수신                    — 기존 캠페인 수신자는 제외(간섭 차단)
 *   5. 이메일 보유
 *
 * arm 배정
 *   md5(user_id + SALT) 순으로 정렬 → 앞에서 200명 → 짝수번째 A, 홀수번째 B.
 *   해시 정렬은 가입일·지원일 같은 실제 속성과 무관하므로 두 arm 이 자동으로
 *   균형을 이루고, 교대 배정이라 정확히 100/100 이 된다.
 *   ※ SALT 를 바꾸면 명단이 통째로 바뀐다. 발송 후에는 절대 건드리지 말 것.
 */
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { writeFileSync, mkdirSync } from 'node:fs'
import { config } from 'dotenv'
import { leadId } from '../../lib/ktcMailToken.js'

config({ path: '.env.local', quiet: true })

const argv = process.argv.slice(2)
const flag = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d }

const SALT = 'lang-coldmail-2026-08'   // 고정. 변경 = 명단 전체 변경.
const ARMS = ['coldmail-language-1', 'coldmail-language-2']

// wave 1 은 100/arm 고정이었다. wave 2 는 남은 대상을 전부 태우므로 상한을 두지 않는다.
// --per-arm 을 주면 그만큼만 뽑는다.
const PER_ARM = flag('--per-arm') ? Number(flag('--per-arm')) : Infinity

/* --include-mailed : 다른 콜드메일을 받은 적 있는 사람도 대상에 넣는다(wave 2).
   wave 1 은 간섭을 피하려고 전원 미수신자로 뽑았다. 지금은 그 조건을 풀어 모수를 넓힌다.
   ※ 이 조건이 지금까지 수신거부자를 막는 방패 노릇을 하고 있었다 — 수신거부한 사람은
     반드시 메일을 받은 적이 있으니 자동으로 걸러졌다. 조건을 푸는 순간 그 방패가
     사라지므로, 아래에서 coldmail_unsub 을 명시적으로 뺀다. 빼먹으면 거부 의사를
     밝힌 사람에게 다시 보내게 된다. */
const INCLUDE_MAILED = argv.includes('--include-mailed')

// wave 1 명단을 덮어쓰면 "누가 A였는지"의 유일한 기록이 사라진다(data/ 는 gitignore).
const OUT = flag('--out', 'data/lang-coldmail-audience.csv')

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

const blank = (v) => !String(v || '').trim()
const noLanguage = (p) =>
  blank(p.english_cert) && blank(p.korean_cert)
  && !(Array.isArray(p.languages) && p.languages.some((l) => String(l?.name || '').trim()))

const rank = (id) => createHash('md5').update(id + SALT).digest('hex')

const main = async () => {
  const [profiles, apps, coldEvents] = await Promise.all([
    all('user_profiles', 'id,email,full_name,resume_url,english_cert,korean_cert,languages,created_at'),
    all('job_applications', 'user_id,job_company,job_title,created_at'),
    all('events', 'user_id,event,meta', (q) => q.ilike('event', 'coldmail%')),
  ])

  // 최신 지원 1건 — 메일의 {{company}}/{{position}} 은 여기서 나온다.
  const lastApp = {}
  for (const a of apps) {
    if (!a.user_id) continue
    const cur = lastApp[a.user_id]
    if (!cur || a.created_at > cur.created_at) lastApp[a.user_id] = a
  }
  const mailed = new Set(coldEvents.filter((e) => e.event.endsWith('_sent')).map((e) => e.user_id).filter(Boolean))
  // 이 캠페인을 이미 받은 사람은 --include-mailed 여부와 무관하게 언제나 뺀다(중복 발송 방지).
  const langSent = new Set(
    coldEvents.filter((e) => e.event === 'coldmail_lang_sent').map((e) => e.user_id).filter(Boolean),
  )
  // 수신거부는 별도 테이블이 아니라 events.coldmail_unsub 이고, user_id 가 아니라
  // meta.lead(이메일 해시)로만 남는다 — 그래서 이메일을 해시해 대조해야 한다.
  const unsubLeads = new Set(
    coldEvents.filter((e) => e.event === 'coldmail_unsub').map((e) => e.meta?.lead).filter(Boolean),
  )

  const eligible = profiles.filter((p) =>
    p.resume_url && p.email && noLanguage(p) && lastApp[p.id]
    && !langSent.has(p.id)
    && !unsubLeads.has(leadId(p.email))
    && (INCLUDE_MAILED || !mailed.has(p.id))
    // 개인화가 빈칸으로 나가면 한 통으로 신뢰를 잃는다 — 둘 다 있어야 대상.
    && lastApp[p.id].job_company && lastApp[p.id].job_title,
  )

  const ordered = eligible.slice().sort((a, b) => rank(a.id).localeCompare(rank(b.id)))
  // 교대 배정이라 홀수면 A 가 한 명 더 간다. 한 명 차이는 버리는 손해가 더 크다.
  const cap = PER_ARM === Infinity ? ordered.length : PER_ARM * ARMS.length
  const picked = ordered.slice(0, cap)
  const rows = picked.map((p, i) => ({
    user_id: p.id,
    email: p.email,
    name: p.full_name || '',
    company: lastApp[p.id].job_company,
    position: lastApp[p.id].job_title,
    campaign: ARMS[i % ARMS.length],
  }))

  const perArm = ARMS.map((a) => rows.filter((r) => r.campaign === a).length)
  console.log(`대상 조건            이력서 O · 지원 1+ · 어학 3칸 빔 · 수신거부 아님`)
  console.log(`기존 콜드메일 수신자  ${INCLUDE_MAILED ? '포함' : '제외'}`)
  console.log(`조건 충족            ${eligible.length}명`)
  console.log(`선정                 ${rows.length}명  (${ARMS[0]} ${perArm[0]} / ${ARMS[1]} ${perArm[1]})`)
  console.log(`예비(미발송)         ${eligible.length - rows.length}명`)
  console.log(`이번 캠페인 기수신    ${langSent.size}명 (자동 제외)`)
  console.log(`수신거부             ${unsubLeads.size}명 (자동 제외)`)
  if (PER_ARM !== Infinity && rows.length < PER_ARM * ARMS.length) {
    console.log(`\n⚠️  ${PER_ARM * ARMS.length}명에 ${PER_ARM * ARMS.length - rows.length}명 모자랍니다. arm 당 인원을 줄이거나 조건을 완화해야 합니다.`)
  }

  if (!process.argv.includes('--write')) {
    console.log('\n[드라이런] 저장하지 않았습니다. --write 로 CSV 를 만듭니다.')
    console.log('샘플 3건:')
    for (const r of rows.slice(0, 3)) console.log(`  ${r.campaign}  ${r.email}  ${r.company} / ${r.position}`)
    return
  }

  mkdirSync('data', { recursive: true })
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`
  const csv = ['user_id,email,name,company,position,campaign']
    .concat(rows.map((r) => [r.user_id, r.email, r.name, r.company, r.position, r.campaign].map(esc).join(',')))
    .join('\n')
  writeFileSync(OUT, csv)
  console.log(`\n저장: ${OUT}`)
  console.log('※ data/ 는 gitignore 다. 이 파일이 arm 배정의 유일한 기록이니 발송 전까지 지우지 말 것.')
}

main().catch((e) => { console.error(e); process.exit(1) })