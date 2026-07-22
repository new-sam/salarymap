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
// VN(UTC+7) 기준 월 버킷
const toVNMonth = (iso) => new Date(new Date(iso).getTime() + 7 * 3600000).toISOString().slice(0, 7)

const DOC_PASS = new Set(['passed', 'ai_interview_sent', 'ai_interview_done', 'ai_interview_passed', 'final_passed'])
const AI_PASS = new Set(['ai_interview_passed', 'final_passed'])

async function fetchAll(table, select, tweak) {
  let all = [], offset = 0
  for (;;) {
    let q = supabase.from(table).select(select).range(offset, offset + 999)
    if (tweak) q = tweak(q)
    const { data, error } = await q
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
      fetchAll('ktc_candidates', 'job_code, email, pipeline_status, sheet_source, applied_at'),
      fetchAll('ktc_hires', 'email, full_name, company').catch(() => []),
    ])

    // FYI 지원자 이메일 (salarymap 라이브) — FYI 채널 퍼널 귀속용
    const ktcJobs = await fetchAll('jobs', 'id', q => q.eq('source', 'ktc')).catch(() => [])
    let fyiEmails = new Set()
    if (ktcJobs.length) {
      const ids = ktcJobs.map(j => j.id)
      let fyiApps = []
      for (let i = 0; i < ids.length; i += 50) {
        fyiApps = fyiApps.concat(await fetchAll('job_applications', 'applicant_email', q => q.in('job_id', ids.slice(i, i + 50))))
      }
      fyiEmails = new Set(fyiApps.map(a => (a.applicant_email || '').toLowerCase()).filter(e => e && !e.endsWith('@likelion.net')))
    }

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

    // 지원 건 / 지원자·파이프라인 per 공고코드 + per 채널
    const apps = {}
    for (const a of applications) if (a.job_code) apps[a.job_code] = (apps[a.job_code] || 0) + 1
    const people = {}, docPass = {}, aiPass = {}, finalPass = {}
    const codeByEmail = {} // 입사 귀속용: 이메일 → 공고코드
    const chanByEmail = {} // 채널 귀속용: 이메일 → 채널 (최초 유입, FYI탭 포함)
    const chan = {} // 채널 퍼널: key → {people, docPass, ..., months: {'2026-05': {...}}} (월 = 지원월 코호트)
    const chanOf = (src) => src // sheet_source 그대로 (FYI 탭은 'FYI')
    const monthByEmail = {} // 이메일 → 지원월 (인터뷰/입사를 지원월 코호트에 귀속)
    const bump = (key, field, month) => {
      const c = chan[key] || (chan[key] = { key, people: 0, docPass: 0, aiPass: 0, finalPass: 0, interviews: 0, hires: 0, months: {} })
      c[field]++
      if (month) {
        const m = c.months[month] || (c.months[month] = { people: 0, docPass: 0, aiPass: 0, finalPass: 0, interviews: 0, hires: 0 })
        m[field]++
      }
    }
    for (const c of candidates) {
      const e = (c.email || '').toLowerCase()
      const ch = chanOf(c.sheet_source)
      const month = c.applied_at ? toVNMonth(c.applied_at) : null
      bump(ch, 'people', month)
      if (DOC_PASS.has(c.pipeline_status)) bump(ch, 'docPass', month)
      if (AI_PASS.has(c.pipeline_status)) bump(ch, 'aiPass', month)
      if (c.pipeline_status === 'final_passed') bump(ch, 'finalPass', month)
      if (e && !chanByEmail[e]) chanByEmail[e] = ch
      if (e && month && !monthByEmail[e]) monthByEmail[e] = month
      if (!c.job_code) continue
      people[c.job_code] = (people[c.job_code] || 0) + 1
      if (DOC_PASS.has(c.pipeline_status)) docPass[c.job_code] = (docPass[c.job_code] || 0) + 1
      if (AI_PASS.has(c.pipeline_status)) aiPass[c.job_code] = (aiPass[c.job_code] || 0) + 1
      if (c.pipeline_status === 'final_passed') finalPass[c.job_code] = (finalPass[c.job_code] || 0) + 1
      if (e && !codeByEmail[e]) codeByEmail[e] = c.job_code
    }
    // FYI 채널: 파이프라인(시트 FYI 탭) 인원 외에 전체 지원자 규모를 라이브로 덧붙임
    if (chan.FYI) chan.FYI.peopleLive = fyiEmails.size
    else if (fyiEmails.size) chan.FYI = { key: 'FYI', people: 0, peopleLive: fyiEmails.size, docPass: 0, aiPass: 0, finalPass: 0, interviews: 0, hires: 0 }

    // 채널 판정: 이메일 → 후보 채널, 없으면 FYI 지원자 집합, 그래도 없으면 미귀속
    const channelForEmail = (e) => chanByEmail[e] || (fyiEmails.has(e) ? 'FYI' : null)

    // 인터뷰 (Master INTERVIEW 탭): Job Application 텍스트에서 코드 추출, 이메일당 코드별 1회
    const interviews = {}
    const ivSeen = new Set()
    const ivChanSeen = new Set()
    for (const r of (ivRes.data.values || []).slice(2)) {
      const email = (r[2] || '').trim().toLowerCase()
      const name = (r[1] || '').trim()
      if (!name) continue
      // 채널 퍼널: 사람 단위 1회
      const personKey = email || name
      if (!ivChanSeen.has(personKey)) {
        ivChanSeen.add(personKey)
        const ch = channelForEmail(email) || '_unattributed'
        bump(ch, 'interviews', monthByEmail[email])
      }
      const codes = [...new Set(((r[13] || '').match(CODE_RE)) || [])]
      for (const code of codes) {
        const key = `${email || name}|${code}`
        if (ivSeen.has(key)) continue
        ivSeen.add(key)
        interviews[code] = (interviews[code] || 0) + 1
      }
    }

    // 입사 per 공고코드 + per 채널
    const hired = {}
    for (const h of hires) {
      const e = (h.email || '').toLowerCase()
      const code = codeByEmail[e]
      if (code) hired[code] = (hired[code] || 0) + 1
      bump(channelForEmail(e) || '_unattributed', 'hires', monthByEmail[e])
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

    // 채널 퍼널 정렬: 지원자(파이프라인 인원) 많은 순, 미귀속은 맨 뒤
    const channels = Object.values(chan).sort((a, b) => {
      if (a.key === '_unattributed') return 1
      if (b.key === '_unattributed') return -1
      return (b.peopleLive || b.people) - (a.peopleLive || a.people)
    })

    res.json({ jds: rows, statusCounts, channels })
  } catch (e) {
    console.error('ktc-jd-funnel:', e)
    res.status(500).json({ error: e.message })
  }
}
