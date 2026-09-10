import '../outreach/lib.mjs' // env 로딩
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
for (const s of meta.data.sheets) console.log(s.properties.sheetId + ' :: ' + s.properties.title)
