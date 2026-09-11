// ops 시트에서 Cosmos Soft 행 조회 (읽기 전용)
import '/Users/wiseungju/salarymap/scripts/outreach/lib.mjs'
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

const meta = await sheets.spreadsheets.get({ spreadsheetId: OPS_ID })
const titles = meta.data.sheets.map((s) => s.properties.title)
console.log('탭:', titles.join(' / '))

for (const t of titles) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: OPS_ID, range: `'${t}'!A1:V` })
  const rows = res.data.values || []
  const hits = []
  rows.forEach((r, i) => { if (/jinosys|지노시스|진오시스/i.test(r.join(' '))) hits.push(i) })
  if (!hits.length) continue
  console.log(`\n===== 탭 [${t}] =====`)
  console.log('1행:', JSON.stringify((rows[0] || []).map((c) => String(c).replace(/\n/g, ' ').slice(0, 20))))
  console.log('2행:', JSON.stringify((rows[1] || []).map((c) => String(c).replace(/\n/g, ' ').slice(0, 20))))
  for (const i of hits) {
    console.log(`행${i + 1}:`, JSON.stringify(rows[i].map((c) => String(c).replace(/\n/g, ' ⏎ ').slice(0, 60))))
  }
}
