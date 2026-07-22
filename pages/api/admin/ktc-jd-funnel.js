import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'

// KTC 공고별 퍼널 — JD EXECUTION(공고 원장, Master 시트 라이브) × 지원(ktc_applications)
// × 파이프라인(ktc_candidates) × 인터뷰(Master INTERVIEW 탭) × 입사(ktc_hires, 이메일→공고코드 귀속).
// 시트는 요청 시 라이브로 읽음 (소량·저빈도라 API 한도 문제 없음, SWR가 30초 dedupe).
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const MASTER_SHEET_ID = '1mR1_-a3LmjxAbbox3tTKBu6WYwDbfBYKmPB6TP9EnKI'
const CODE_RE = /[A-Z]{2,6}\d{3,4}/g

const DOC_PASS = new Set(['passed', 'ai_interview_sent', 'ai_interview_done', 'ai_interview_passed', 'final_passed'])
const AI_PASS = new Set(['ai_interview_passed', 'final_passed'])

async function fetchAll(table, select) {
  let all = [], offset = 0
  for (;;) {
    const { data, error } = await supabase.from(table).select(select).range(offset, offset + 999)
    if (error) throw error
    all = all.concat(data || [])
    if (!data || data.length < 1000) break
    offset += 1000
  }
  return all
}

export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const { google } = await import('googleapis')
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })
    const sheets = google.sheets({ version: 'v4', auth })

    const [jdRes, ivRes, applications, candidates, hires] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: MASTER_SHEET_ID, range: "'JD EXECUTION'!A1:N" }),
      sheets.spreadsheets.values.get({ spreadsheetId: MASTER_SHEET_ID, range: "'INTERVIEW'!A1:N" }),
      fetchAll('ktc_applications', 'job_code'),
      fetchAll('ktc_candidates', 'job_code, email, pipeline_status'),
      fetchAll('ktc_hires', 'email, full_name, company').catch(() => []),
    ])

    // JD 원장 (헤더 3행 스킵, Job ID 있는 행만)
    const jds = (jdRes.data.values || []).slice(3)
      .filter(r => (r[0] || '').trim())
      .map(r => ({
        code: r[0].trim(),
        company: (r[1] || '').trim(),
        title: (r[2] || '').trim(),
        yoe: (r[6] || '').trim(),
        korean: (r[7] || '').trim(),
        headcount: parseInt(r[8]) || null,
        dateReceived: (r[9] || '').trim(),
        status: (r[11] || '').trim(),
      }))

    // 지원 건 / 지원자·파이프라인 per 공고코드
    const apps = {}
    for (const a of applications) if (a.job_code) apps[a.job_code] = (apps[a.job_code] || 0) + 1
    const people = {}, docPass = {}, aiPass = {}, finalPass = {}
    const codeByEmail = {} // 입사 귀속용: 이메일 → 공고코드
    for (const c of candidates) {
      if (!c.job_code) continue
      people[c.job_code] = (people[c.job_code] || 0) + 1
      if (DOC_PASS.has(c.pipeline_status)) docPass[c.job_code] = (docPass[c.job_code] || 0) + 1
      if (AI_PASS.has(c.pipeline_status)) aiPass[c.job_code] = (aiPass[c.job_code] || 0) + 1
      if (c.pipeline_status === 'final_passed') finalPass[c.job_code] = (finalPass[c.job_code] || 0) + 1
      const e = (c.email || '').toLowerCase()
      if (e && !codeByEmail[e]) codeByEmail[e] = c.job_code
    }

    // 인터뷰 (Master INTERVIEW 탭): Job Application 텍스트에서 코드 추출, 이메일당 코드별 1회
    const interviews = {}
    const ivSeen = new Set()
    for (const r of (ivRes.data.values || []).slice(2)) {
      const email = (r[2] || '').trim().toLowerCase()
      const name = (r[1] || '').trim()
      if (!name) continue
      const codes = [...new Set(((r[13] || '').match(CODE_RE)) || [])]
      for (const code of codes) {
        const key = `${email || name}|${code}`
        if (ivSeen.has(key)) continue
        ivSeen.add(key)
        interviews[code] = (interviews[code] || 0) + 1
      }
    }

    // 입사 per 공고코드 (이메일 → candidates 공고코드)
    const hired = {}
    for (const h of hires) {
      const code = codeByEmail[(h.email || '').toLowerCase()]
      if (code) hired[code] = (hired[code] || 0) + 1
    }

    const rows = jds.map(j => ({
      ...j,
      apps: apps[j.code] || 0,
      people: people[j.code] || 0,
      docPass: docPass[j.code] || 0,
      aiPass: aiPass[j.code] || 0,
      interviews: interviews[j.code] || 0,
      finalPass: finalPass[j.code] || 0,
      hires: hired[j.code] || 0,
    }))

    const statusCounts = {}
    for (const j of rows) statusCounts[j.status || '(없음)'] = (statusCounts[j.status || '(없음)'] || 0) + 1

    res.json({ jds: rows, statusCounts })
  } catch (e) {
    console.error('ktc-jd-funnel:', e)
    res.status(500).json({ error: e.message })
  }
}
