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

config({ path: '.env.local', quiet: true })

const SALT = 'lang-coldmail-2026-08'   // 고정. 변경 = 명단 전체 변경.
const PER_ARM = 100
const ARMS = ['coldmail-language-1', 'coldmail-language-2']

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
    all('events', 'user_id,event', (q) => q.ilike('event', 'coldmail%')),
  ])

  // 최신 지원 1건 — 메일의 {{company}}/{{position}} 은 여기서 나온다.
  const lastApp = {}
  for (const a of apps) {
    if (!a.user_id) continue
    const cur = lastApp[a.user_id]
    if (!cur || a.created_at > cur.created_at) lastApp[a.user_id] = a
  }
  const mailed = new Set(coldEvents.filter((e) => e.event.endsWith('_sent')).map((e) => e.user_id).filter(Boolean))

  const eligible = profiles.filter((p) =>
    p.resume_url && p.email && noLanguage(p) && lastApp[p.id] && !mailed.has(p.id)
    // 개인화가 빈칸으로 나가면 한 통으로 신뢰를 잃는다 — 둘 다 있어야 대상.
    && lastApp[p.id].job_company && lastApp[p.id].job_title,
  )

  const ordered = eligible.slice().sort((a, b) => rank(a.id).localeCompare(rank(b.id)))
  const picked = ordered.slice(0, PER_ARM * ARMS.length)
  const rows = picked.map((p, i) => ({
    user_id: p.id,
    email: p.email,
    name: p.full_name || '',
    company: lastApp[p.id].job_company,
    position: lastApp[p.id].job_title,
    campaign: ARMS[i % ARMS.length],
  }))

  const perArm = ARMS.map((a) => rows.filter((r) => r.campaign === a).length)
  console.log(`조건 충족            ${eligible.length}명`)
  console.log(`선정                 ${rows.length}명  (${ARMS[0]} ${perArm[0]} / ${ARMS[1]} ${perArm[1]})`)
  console.log(`예비(미발송)         ${eligible.length - rows.length}명`)
  if (rows.length < PER_ARM * ARMS.length) {
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
  const out = 'data/lang-coldmail-audience.csv'
  writeFileSync(out, csv)
  console.log(`\n저장: ${out}`)
  console.log('※ data/ 는 gitignore 다. 이 파일이 arm 배정의 유일한 기록이니 발송 전까지 지우지 말 것.')
}

main().catch((e) => { console.error(e); process.exit(1) })