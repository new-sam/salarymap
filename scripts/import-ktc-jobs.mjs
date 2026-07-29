// KTC 랜딩 공고 → FYI jobs 일회성 임포트. 로직은 lib/ktcJobsSync.js 공유.
//   node scripts/import-ktc-jobs.mjs           (드라이런 — 변경 없이 계획만 출력)
//   node scripts/import-ktc-jobs.mjs --apply   (실제 반영)
import { readFileSync } from 'node:fs'

// lib 이 모듈 로드 시 process.env 를 읽으므로 먼저 .env.local 주입
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const i = line.indexOf('=')
  if (i > 0 && !line.trim().startsWith('#')) {
    const k = line.slice(0, i).trim()
    if (!(k in process.env)) process.env[k] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
}

const { importKtcLandingJobs } = await import('../lib/ktcJobsSync.js')

const apply = process.argv.includes('--apply')
const r = await importKtcLandingJobs({ dry: !apply })

console.log(`KTC 랜딩 ${r.counts.ktc}건 | FYI source=ktc ${r.counts.fyi}건`)

console.log(`\n① 신규 등록 ${r.counts.insert}건`)
for (const x of r.insert) console.log(`   + ${x.code.padEnd(9)} ${x.active ? '활성' : '비활성'}  ${x.company} / ${String(x.title).slice(0, 40)}`)

console.log(`\n② 노출상태 변경 ${r.counts.activate}건`)
for (const x of r.activate) console.log(`   ~ ${x.code.padEnd(9)} ${x.from ? '활성' : '비활성'} → ${x.to ? '활성' : '비활성'}  ${String(x.label).slice(0, 44)}`)

console.log(`\n③ 본문 원문(raw_payload) 채우기 ${r.counts.fill}건`)

console.log(`\n④ KTC 에 없는 FYI 행 ${r.counts.orphan}건 — 손대지 않음`)
for (const x of r.orphans) console.log(`   ? ${String(x.source_id).padEnd(9)} ${x.active ? '활성' : '비활성'}  ${x.company} / ${String(x.title).slice(0, 36)}`)

if (r.notes.length) {
  console.log(`\n⑤ 참고 ${r.notes.length}건`)
  for (const x of r.notes) console.log(`   · ${x.reason}${x.code ? ` (${x.code})` : ''}${x.title ? ` — ${x.title}` : ''}`)
}

console.log(apply ? `\n✅ 반영 완료 — 등록 ${r.inserted.length}건 · 노출변경 ${r.counts.activate}건 · 원문채움 ${r.counts.fill}건` : `\n[드라이런] 아무것도 쓰지 않음. --apply 로 반영.`)
