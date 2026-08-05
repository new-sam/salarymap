#!/usr/bin/env node
/**
 * coldmail_lang_responses 소급 기록 — 표를 만들기 전에 들어온 응답을 옮긴다.
 *
 *   node scripts/backfill-lang-responses.mjs            # 드라이런
 *   node scripts/backfill-lang-responses.mjs --write
 *
 * 출처: events.coldmail_lang_fill(누가·언제·어느 캠페인) + 직전 coldmail_lang_click(cta)
 *      + user_profiles 의 현재 값.
 *
 * ⚠️ 한계 — 이 백필은 원본이 아니라 '지금 값'을 옮긴다.
 *   2026-08-05 이력서 재파싱이 어학 칸을 덮으면서 최소 21명의 응답이 이미 손상됐다
 *   (점수 7명 + 빈값 14명). 그 사람들은 여기서도 잘못된 값이 들어가거나 비어서 들어간다.
 *   그래서 손상이 의심되는 행은 source='backfill-suspect' 로 따로 표시한다 —
 *   나중에 백업에서 원문을 찾으면 그 행만 골라 고칠 수 있게 하려는 것이다.
 *
 *   판정: cta=score 로 저장했는데 지금 값이 자격증 형태가 아니면 덮인 것으로 본다.
 *        (score 를 누른 사람은 TOEIC/IELTS 같은 값을 넣었다)
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local', quiet: true })

const write = process.argv.includes('--write')
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

const CERT = /^(TOEIC|IELTS|TOEFL|VSTEP|APTIS|TOPIK)\b/i
const blank = (v) => !String(v || '').trim()

const evts = await all('events', 'event,user_id,created_at,meta',
  (q) => q.in('event', ['coldmail_lang_fill', 'coldmail_lang_click']).order('created_at'))

// 첫 저장 한 건만 옮긴다 — 전환을 세는 방식과 같다. 재저장 이력은 표가 생긴 뒤부터 쌓인다.
const firstFill = {}
for (const e of evts) {
  if (e.event !== 'coldmail_lang_fill' || !e.user_id) continue
  if (!firstFill[e.user_id]) firstFill[e.user_id] = { at: e.created_at, campaign: e.meta?.campaign || null }
}
// 저장 직전에 누른 버튼
const ctaOf = {}
for (const e of evts) {
  if (e.event !== 'coldmail_lang_click' || !e.user_id) continue
  if (firstFill[e.user_id] && e.created_at <= firstFill[e.user_id].at) ctaOf[e.user_id] = e.meta?.cta || null
}

const ids = Object.keys(firstFill)
const profs = await all('user_profiles', 'id,english_cert,korean_cert', (q) => q.in('id', ids))
const byId = Object.fromEntries(profs.map((p) => [p.id, p]))

// 표가 없으면 여기서 멈춘다. 조회 오류를 무시하면 '이미 기록됨 0건'으로 조용히 넘어가
// 드라이런이 통과한 것처럼 보인다.
const { data: existing, error: exErr } = await sb.from('coldmail_lang_responses').select('user_id')
if (exErr) {
  console.error(`coldmail_lang_responses 조회 실패: ${exErr.message}`)
  console.error('→ supabase/migrations/20260805_coldmail_lang_responses.sql 을 Supabase 대시보드에서 먼저 실행하세요.')
  process.exit(1)
}
const done = new Set((existing || []).map((r) => r.user_id))

const rows = []
let suspect = 0
for (const id of ids) {
  if (done.has(id)) continue
  const p = byId[id]
  if (!p) continue
  const cta = ctaOf[id] || null
  const looksOverwritten = cta === 'score'
    && !(CERT.test(String(p.english_cert || '').trim()) || CERT.test(String(p.korean_cert || '').trim()))
  if (looksOverwritten) suspect++
  rows.push({
    user_id: id,
    campaign: firstFill[id].campaign,
    cta,
    english_cert: blank(p.english_cert) ? null : p.english_cert,
    korean_cert: blank(p.korean_cert) ? null : p.korean_cert,
    source: looksOverwritten ? 'backfill-suspect' : 'backfill',
    created_at: firstFill[id].at,   // 저장 시각을 그대로 — 백필 시각이 아니라
  })
}

console.log(`저장 이벤트 ${ids.length}명 · 이미 기록됨 ${done.size}명 · 새로 넣을 행 ${rows.length}건`)
console.log(`  그중 덮인 것으로 의심(source=backfill-suspect): ${suspect}건`)
console.log(`  값이 비어 들어가는 행: ${rows.filter((r) => !r.english_cert && !r.korean_cert).length}건`)

if (!write) {
  console.log('\n[드라이런] 저장하지 않았습니다. --write 로 실행하세요.')
  for (const r of rows.slice(0, 5)) console.log(' ', r.created_at.slice(5, 16), r.campaign, '| cta', r.cta, '| en', r.english_cert, '| ko', r.korean_cert, '|', r.source)
  process.exit(0)
}

for (let i = 0; i < rows.length; i += 200) {
  const { error } = await sb.from('coldmail_lang_responses').insert(rows.slice(i, i + 200))
  if (error) { console.error('실패:', error.message); process.exit(1) }
}
console.log(`\n✅ ${rows.length}건 기록 완료`)
