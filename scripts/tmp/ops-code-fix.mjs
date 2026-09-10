// 9/10 ops 시트(정본) 기준 source_id 일괄 정정 — 각 건 ops 회사명 검증 후 적용
import { sb } from '../outreach/lib.mjs'
import { google } from 'googleapis'
const auth = new google.auth.GoogleAuth({
  credentials: { client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n') },
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
})
const sheets = google.sheets({ version: 'v4', auth })
const res = await sheets.spreadsheets.values.get({ spreadsheetId: '1opr9KoR7KRZ31CJDNGM63xbA2rPZjPuNaG6eeLPTXjM', range: "'Matching Status'!A1:T" })
const rows = res.data.values || []
const hIdx = rows.findIndex(r => r.some(c => String(c || '').trim() === 'Code'))
const opsByCode = new Map()
for (const r of rows.slice(hIdx + 1)) {
  const code = String(r[5] || '').trim()
  if (/^[A-Z]{1,3}\d{1,4}$/.test(code)) opsByCode.set(code, { company: String(r[8] || '').trim(), pos: String(r[19] || '').trim() })
}

// (FYI job id, 현재코드, 신코드, ops 회사명 검증 정규식)
const FIX = [
  ['65975789-367e-4650-9f2f-a5c440ecdd38', 'R106', 'R108', /로테아/],
  ['c4e49445-ea04-4941-a773-4331d033b9ac', 'R145', 'R109', /러엔/],
  ['c58646d8-aeb0-49d1-a8c0-60884f9a80e7', 'R146', 'R110', /러엔/],
  ['14849ca1-1e19-4f75-9f03-0f18323c461e', 'R147', 'R111', /러엔/],
  ['a2c89812-fec4-40fc-beb1-327925787ce9', 'R150', 'R112', /코망/],
  ['271c6595-052e-437d-ad4c-430bd0b50595', 'R148', 'R113', /에스2이테크/],
  ['81cb15db-0d44-4ce5-a99f-d1b366add720', 'K21', 'R114', /유피드/],
  ['7acef08a-3555-4f9a-bb10-92fa913454e8', 'R105', 'R115', /Atop/i],
  ['aec7a68f-b3d3-48ff-af86-36d4571c985e', 'R143', 'R116', /오버레이/],
  ['d9270090-abb8-4653-861d-8d08d4e3c161', 'R144', 'R117', /오버레이/],
  ['15bcad26-e30c-4ec8-89ed-72208972ee2a', 'R151', 'R118', /언틸/],
  ['df5b8a80-a2f9-4bc0-a568-32be22878161', 'R152', 'R119', /로보윙크/],
  ['3374ec2b-711c-4fc3-916b-6e607fd9a64a', 'R153', 'V86', /모티브픽쳐스/],
  ['38896fad-04c0-4473-b928-8e3ea4f81238', 'R154', 'R139', /픽케어/],
  ['2ceee468-83ff-4600-adee-57f8d76ff83c', 'R155', 'R138', /픽케어/],
]
let applied = 0
for (const [id, oldCode, newCode, companyRe] of FIX) {
  const o = opsByCode.get(newCode)
  if (!o || !companyRe.test(o.company)) { console.error(`⛔ 검증 실패 ${oldCode}→${newCode}: ops=${JSON.stringify(o)}`); continue }
  const { data: j } = await sb.from('jobs').select('source_id,title,company').eq('id', id).single()
  if (j.source_id !== oldCode) { console.error(`⛔ 현재값 불일치 ${id}: 기대 ${oldCode}, 실제 ${j.source_id}`); continue }
  const { error } = await sb.from('jobs').update({ source_id: newCode }).eq('id', id)
  if (error) { console.error(`⛔ 업데이트 실패 ${newCode}: ${error.message}`); continue }
  console.log(`✅ ${oldCode} → ${newCode} · ${j.company} · ${j.title} (ops: ${o.company})`)
  applied++
}
console.log(`\n적용 ${applied}/${FIX.length}`)
