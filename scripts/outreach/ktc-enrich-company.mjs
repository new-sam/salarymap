// 리드 CSV에 '지원기업'·'지원공고' 컬럼을 채운다 (KTC applications.applied_company/applied_job).
// 콜드메일 제목·본문을 "{기업} - {직무}" 로 개인화하기 위한 전처리.
//
//   node scripts/outreach/ktc-enrich-company.mjs          # dry-run: 커버리지만 출력
//   node scripts/outreach/ktc-enrich-company.mjs --write  # CSV 갱신(원본은 .bak 백업)
//
// 기업명이 없는 리드(약 23%)는 빈 값으로 두고, 발송 스크립트가 직무만 쓰는 폴백으로 처리한다.
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { env } from './lib.mjs'

const CSV = new URL('../../data/ktc-leads-not-in-fyi.csv', import.meta.url)
const doWrite = process.argv.includes('--write')

const csvCell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
const oneLine = (v) => String(v ?? '').replace(/\s+/g, ' ').trim()

function parseCsv(text) {
  const bom = text.charCodeAt(0) === 0xFEFF
  if (bom) text = text.slice(1)
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
  return { bom, head, rows: rows.filter(r => r.length > 1) }
}

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

const { bom, head, rows } = parseCsv(readFileSync(CSV, 'utf8'))
const idxEmail = head.indexOf('이메일')
const idxPos = head.indexOf('최신 지원포지션')
if (idxEmail < 0) throw new Error('이메일 컬럼 없음')

const ktc = createClient(env.KTC_LANDING_SUPABASE_URL, env.KTC_LANDING_SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } })

// 이메일별 '최신' 지원 1건 — 메일에서 언급할 공고는 가장 최근 것이 자연스럽다.
const apps = await fetchAll(() => ktc.from('applications')
  .select('email, position, applied_job, applied_company, created_at')
  .order('created_at', { ascending: false }))
const latest = new Map()
for (const a of apps) {
  const e = (a.email || '').trim().toLowerCase()
  if (e && !latest.has(e)) latest.set(e, a)
}

// 이미 컬럼이 있으면 덮어쓰고, 없으면 뒤에 추가
let iCo = head.indexOf('지원기업'), iJb = head.indexOf('지원공고')
const newHead = head.slice()
if (iCo < 0) { newHead.push('지원기업'); iCo = newHead.length - 1 }
if (iJb < 0) { newHead.push('지원공고'); iJb = newHead.length - 1 }

let both = 0, onlyJob = 0, none = 0
const coCount = {}
const out = rows.map(r => {
  const row = r.slice()
  while (row.length < newHead.length) row.push('')
  const a = latest.get((row[idxEmail] || '').trim().toLowerCase())
  const co = oneLine(a?.applied_company)
  const jb = oneLine(a?.applied_job) || oneLine(a?.position) || oneLine(row[idxPos])
  row[iCo] = co
  row[iJb] = jb
  if (co && jb) { both++; coCount[co] = (coCount[co] || 0) + 1 }
  else if (jb) onlyJob++
  else none++
  return row
})

const pct = (n) => (n / rows.length * 100).toFixed(1)
console.log(`리드 ${rows.length}명`)
console.log(`  기업+직무 확보 : ${both}명 (${pct(both)}%)  → "{기업} - {직무}" 개인화`)
console.log(`  직무만        : ${onlyJob}명 (${pct(onlyJob)}%) → 폴백(직무만)`)
console.log(`  둘 다 없음     : ${none}명 (${pct(none)}%)`)
console.log('\n기업별 리드 수 상위 10:')
Object.entries(coCount).sort((a, b) => b[1] - a[1]).slice(0, 10)
  .forEach(([c, n]) => console.log(`  ${String(n).padStart(4)}명  ${c}`))

if (!doWrite) {
  console.log('\n[dry-run] CSV 변경 안 함. --write 로 실제 갱신.')
  process.exit(0)
}

const bak = new URL('../../data/ktc-leads-not-in-fyi.csv.bak', import.meta.url)
if (!existsSync(bak)) copyFileSync(CSV, bak)
const text = (bom ? '﻿' : '') +
  [newHead, ...out].map(r => r.map(csvCell).join(',')).join('\n')
writeFileSync(CSV, text)
console.log(`\n✅ CSV 갱신 완료 (백업: data/ktc-leads-not-in-fyi.csv.bak)`)
