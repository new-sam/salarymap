// 2026 KTC ops(정본) Matching Status vs FYI jobs.source_id 전수 대조
import { sb } from '../outreach/lib.mjs'
import { google } from 'googleapis'
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
})
const sheets = google.sheets({ version: 'v4', auth })
const OPS_ID = '1opr9KoR7KRZ31CJDNGM63xbA2rPZjPuNaG6eeLPTXjM'
const res = await sheets.spreadsheets.values.get({ spreadsheetId: OPS_ID, range: "'Matching Status'!A1:T" })
const rows = res.data.values || []
const hIdx = rows.findIndex(r => r.some(c => String(c || '').trim() === 'Code'))
const H = rows[hIdx].map(c => String(c || '').replace(/\n/g, ' ').trim())
const col = (name) => H.findIndex(h => h === name || h.startsWith(name))
const ci = { code: col('Code'), company: col('Company'), pos: col('Position'), pos2: col('Position 2'), status: 0, funnel: col('Funnel') }
console.log('헤더 매핑: ' + JSON.stringify(ci) + ' / ' + JSON.stringify(H.slice(0, 12)))

const ops = []
for (const r of rows.slice(hIdx + 1)) {
  const code = String(r[ci.code] || '').trim()
  if (!/^[A-Z]{1,3}\d{1,4}/.test(code)) continue
  ops.push({ code, status: String(r[0] || '').trim(), funnel: String(r[ci.funnel] || '').trim(), company: String(r[ci.company] || '').trim(), pos: String(r[ci.pos] || '').trim(), pos2: String(r[ci.pos2] || '').trim() })
}
console.log('ops 코드 행: ' + ops.length)
const opsByCode = new Map(ops.map(o => [o.code, o]))

const { data: jobs } = await sb.from('jobs').select('id,title,company,source_id,is_active').eq('source', 'ktc').not('source_id', 'is', null).order('created_at')
const base = s => (String(s || '').match(/^([A-Z]{1,6}\d{1,4})/) || [])[1] || String(s || '')
let okN = 0
const missing = [], report = []
for (const j of jobs) {
  const o = opsByCode.get(base(j.source_id))
  if (!o) { missing.push(`${j.source_id} · ${j.company} · ${j.title}${j.is_active ? '' : ' (비활성)'}`); continue }
  okN++
  report.push(`${j.source_id} → ops[${o.company} · ${o.pos2 || o.pos} · ${o.funnel}] ← FYI[${j.company} · ${j.title}]`)
}
console.log('\n── ops에 코드 존재(회사 일치 여부는 육안 확인): ' + okN + ' ──')
for (const r of report) console.log('  ' + r)
console.log('\n── ops에 없는 코드(정본 이탈): ' + missing.length + ' ──')
for (const m of missing) console.log('  ' + m)
