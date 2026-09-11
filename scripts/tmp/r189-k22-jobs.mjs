// R189(어뮤징랩)·K22(코스모스) 공고 조회 + source_id 백필
import { sb } from '/Users/wiseungju/salarymap/scripts/outreach/lib.mjs'

const doFix = process.argv.includes('--fix')

const { data: amusing } = await sb.from('jobs').select('id,title,company,location,role,salary_min,salary_max,source,source_id,is_active,created_at,description')
  .or('company.ilike.%amusing%,company.ilike.%어뮤징%,title.ilike.%thị trường%')
const { data: cosmos } = await sb.from('jobs').select('id,title,company,source,source_id,is_active')
  .eq('id', '165b888e-c444-4ceb-9153-6589589a0f2b')

for (const j of amusing || []) {
  const { description, ...rest } = j
  console.log(JSON.stringify(rest, null, 1))
  console.log('--- description ---')
  console.log(String(description || '').slice(0, 2500))
}
console.log('\ncosmos:', JSON.stringify(cosmos))

if (doFix) {
  const am = (amusing || []).filter((j) => /amusing|어뮤징/i.test(j.company))
  if (am.length === 1 && !am[0].source_id) {
    const { error } = await sb.from('jobs').update({ source_id: 'R189' }).eq('id', am[0].id)
    console.log(error ? '어뮤징 백필 실패: ' + error.message : `✅ 어뮤징랩 ${am[0].id} source_id=R189`)
  } else console.log('어뮤징 백필 스킵:', am.map((j) => `${j.id}=${j.source_id}`))
  if (cosmos?.[0] && !cosmos[0].source_id) {
    const { error } = await sb.from('jobs').update({ source_id: 'K22' }).eq('id', cosmos[0].id)
    console.log(error ? '코스모스 백필 실패: ' + error.message : `✅ 코스모스 ${cosmos[0].id} source_id=K22`)
  } else console.log('코스모스 백필 스킵:', cosmos?.[0]?.source_id)
}
