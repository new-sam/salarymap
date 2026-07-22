import { createClient } from '@supabase/supabase-js'

// ktc-support Supabase candidates → salarymap ktc_candidates 동기화 (멱등 upsert).
// admin/ktc-sources-sync(대시보드 동기화 버튼) · scripts/sync-ktc-candidates.mjs 가 공유.
// env: KTC_SUPABASE_URL, KTC_SUPABASE_SERVICE_ROLE_KEY (+ salarymap service key)

export const KTC_SUPPORT_URL = 'https://ktc-support.vercel.app'

// applied_job 앞머리의 공고코드 추출 (예: "LM1001 - Fullstack Developer" → LM1001)
function extractJobCode(appliedJob) {
  const m = (appliedJob || '').trim().match(/^([A-Z]{2,6}\d{3,4})/)
  return m ? m[1] : null
}

// 탭별 날짜 포맷이 제각각이라 dayFirst 를 탭별로 지정 (미국식 m/d 는 LinkedIn·구글폼 계열만)
const MONTH_FIRST_TABS = new Set(['LinkedIn', 'Form Responses 1', 'legacy-sheet'])

// 원본 문자열 → ISO(+07:00 ICT). 파싱 실패 시 null.
function parseAppliedAt(raw, sheetSource) {
  if (!raw) return null
  const s = raw.trim()
  let y, mo, d, h = 0, mi = 0, se = 0

  let m
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/))) {
    // ISO: 2026-07-08 13:36:44
    ;[, y, mo, d, h = 0, mi = 0, se = 0] = m.map(Number)
  } else if ((m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))? (\d{1,2})[/-](\d{1,2})[/-](\d{4})/))) {
    // top-dev: 10:26:13 13/05/2026 (시간이 앞, 날짜는 d/m)
    h = +m[1]; mi = +m[2]; se = +(m[3] || 0); d = +m[4]; mo = +m[5]; y = +m[6]
  } else if ((m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/))) {
    // d/m/Y 또는 m/d/Y (탭별 지정, 12 초과 값이 있으면 그걸로 확정)
    const a = +m[1], b = +m[2]
    y = +m[3]; h = +(m[4] || 0); mi = +(m[5] || 0); se = +(m[6] || 0)
    let dayFirst = !MONTH_FIRST_TABS.has(sheetSource)
    if (a > 12) dayFirst = true
    else if (b > 12) dayFirst = false
    ;[d, mo] = dayFirst ? [a, b] : [b, a]
  } else {
    return null
  }

  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const pad = n => String(n).padStart(2, '0')
  return `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:${pad(se)}+07:00`
}

// ktc-support 의 시트→DB 동기화를 먼저 트리거 (SSE 스트림을 끝까지 소비해 완료 대기)
export async function triggerSheetSync() {
  const res = await fetch(`${KTC_SUPPORT_URL}/api/sync-sheets`, { method: 'POST' })
  if (!res.ok || !res.body) throw new Error(`ktc-support sync-sheets ${res.status}`)
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let last = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    last += decoder.decode(value, { stream: true })
    if (last.length > 20000) last = last.slice(-5000) // 마지막 이벤트만 유지
  }
  // 스트림 마지막 done/summary 이벤트에서 결과 추출 (형식이 바뀌어도 동기화 자체는 성공)
  const events = last.split('\n\n').filter(Boolean)
  for (let i = events.length - 1; i >= 0; i--) {
    const m = events[i].match(/^data: (.+)$/m)
    if (!m) continue
    try {
      const ev = JSON.parse(m[1])
      if (ev.type === 'done' || ev.type === 'error') return ev
    } catch { /* skip */ }
  }
  return null
}

// ── 지원 "건" 동기화: 구글시트를 직접 읽어 행 그대로 적재 ─────────────────────
// ktc-support 동기화는 이메일 기준 전역 중복제거(최초 채널 귀속)라 지원 건수가 안 남는다.
// 그래서 시트 원본을 직접 읽어 ktc_applications 에 탭 단위 전량 재적재한다.
// env: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SHEET_ID (ktc-support 와 동일 값)

// 탭별 헤더 → 필드 매핑 (ktc-support lib/google-sheets.ts 의 COLUMN_MAPS 에서 필요 필드만 포팅)
const SHEET_COLUMN_MAPS = {
  'landing-page': {
    'Họ & Tên': 'full_name', Email: 'email', 'Vị trí ứng tuyển': 'position',
    'Ngày nộp': 'applied_date', 'Applied Job': 'applied_job', 'Applied Company': 'applied_company',
  },
  'ITviec-api': {
    'Họ & Tên': 'full_name', Email: 'email', 'Job Title': 'applied_job', 'Ngày nộp': 'applied_date',
  },
  'top-dev': {
    'Candidate Fullname': 'full_name', 'Candidate Email': 'email', 'Job title': 'applied_job', 'Applied date': 'applied_date',
  },
  'jobs-go': {
    'Họ tên': 'full_name', Email: 'email', 'Thời gian': 'applied_date',
    'Applied Job': 'position', 'Job ID': 'applied_job', 'Applied Company': 'applied_company',
  },
  'top-cv': {
    'Họ Tên': 'full_name', Email: 'email', 'Ngày tiếp nhận': 'applied_date',
    'Applied Job': 'position', 'Job ID': 'applied_job', 'Applied Company': 'applied_company',
  },
  _default: { // glint, LinkedIn, YBOX, legacy-sheet
    'Full Name': 'full_name', Email: 'email', Position: 'position',
    'Date Submitted': 'applied_date', 'Applied Jobs': 'applied_job',
  },
}
// 지원 건 집계에서 제외할 탭: 시스템 탭 + FYI(지원 건은 salarymap DB 라이브가 정답)
const SKIP_TABS = ['Form Responses 1', 'log', 'FYI']

export async function syncKtcApplications() {
  // 랜딩 지원 건은 시트가 아니라 ktc-landing DB(applications)가 원본 — env 있으면 DB 직행, 없으면 시트 폴백
  const useLandingDb = Boolean(process.env.KTC_LANDING_SUPABASE_URL && process.env.KTC_LANDING_SUPABASE_SERVICE_ROLE_KEY)
  const skipTabs = useLandingDb ? [...SKIP_TABS, 'landing-page'] : SKIP_TABS
  const { google } = await import('googleapis')
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  const sheets = google.sheets({ version: 'v4', auth })
  const sheetId = process.env.GOOGLE_SHEET_ID
  const fyi = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId })
  const tabs = (meta.data.sheets || [])
    .map(s => s.properties?.title || '')
    .filter(t => t && !skipTabs.includes(t))

  const syncedAt = new Date().toISOString()
  const perTab = {}
  for (const tab of tabs) {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `'${tab}'!A1:Z` })
    const rows = res.data.values
    if (!rows || rows.length < 2) { perTab[tab] = 0; continue }
    const map = SHEET_COLUMN_MAPS[tab] || SHEET_COLUMN_MAPS._default
    const idx = {}
    rows[0].forEach((h, i) => { const f = map[(h || '').trim()]; if (f) idx[f] = i })

    const records = []
    for (let i = 1; i < rows.length; i++) {
      const get = (f) => (idx[f] !== undefined ? (rows[i][idx[f]] || '').trim() : '')
      const fullName = get('full_name')
      if (!fullName) continue
      const appliedJob = get('applied_job')
      records.push({
        sheet_source: tab,
        full_name: fullName,
        email: get('email') || null,
        applied_job: appliedJob || null,
        job_code: extractJobCode(appliedJob),
        applied_company: get('applied_company') || null,
        position: get('position') || null,
        applied_date_raw: get('applied_date') || null,
        applied_at: parseAppliedAt(get('applied_date'), tab),
        synced_at: syncedAt,
      })
    }

    // 탭 단위 전량 재적재 — 시트가 원본이라 삭제 후 삽입이 항상 정확
    const { error: delErr } = await fyi.from('ktc_applications').delete().eq('sheet_source', tab)
    if (delErr) throw new Error(`applications delete ${tab}: ${delErr.message}`)
    for (let i = 0; i < records.length; i += 500) {
      const { error } = await fyi.from('ktc_applications').insert(records.slice(i, i + 500))
      if (error) throw new Error(`applications insert ${tab} ${i}: ${error.message}`)
    }
    perTab[tab] = records.length
  }

  // 랜딩: ktc-landing DB applications → sheet_source='landing-page' 로 적재 (시트보다 원본·최신, UTM 보유)
  if (useLandingDb) {
    const landing = createClient(process.env.KTC_LANDING_SUPABASE_URL, process.env.KTC_LANDING_SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const apps = []
    for (let off = 0; ; off += 1000) {
      const { data, error } = await landing
        .from('applications')
        .select('full_name, email, applied_job, applied_company, position, job_id, created_at')
        .range(off, off + 999)
      if (error) throw new Error(`landing applications fetch: ${error.message}`)
      apps.push(...data)
      if (data.length < 1000) break
    }
    const records = apps
      .filter(a => a.full_name)
      .map(a => ({
        sheet_source: 'landing-page',
        full_name: a.full_name,
        email: a.email || null,
        applied_job: a.applied_job || null,
        job_code: (a.job_id || '').trim() || extractJobCode(a.applied_job),
        applied_company: (a.applied_company || '').trim() || null,
        position: a.position || null,
        applied_date_raw: a.created_at,
        applied_at: a.created_at,
        synced_at: syncedAt,
      }))
    const { error: delErr } = await fyi.from('ktc_applications').delete().eq('sheet_source', 'landing-page')
    if (delErr) throw new Error(`applications delete landing-page: ${delErr.message}`)
    for (let i = 0; i < records.length; i += 500) {
      const { error } = await fyi.from('ktc_applications').insert(records.slice(i, i + 500))
      if (error) throw new Error(`applications insert landing-page ${i}: ${error.message}`)
    }
    perTab['landing-page'] = records.length
  }

  return { total: Object.values(perTab).reduce((s, n) => s + n, 0), perTab }
}

// ── FYI 지원자 → ktc-support 파이프라인 유입 ────────────────────────────────
// salarymap의 KTC 공고 지원자를 ktc-support candidates에 넣어 스크리닝 대상으로 만든다.
// ktc-support의 전역 중복 규칙(이메일 → 이름+전화)을 그대로 적용해 기존재자는 스킵
// (최초 유입 채널 귀속 유지). 신규만 sheet_source='FYI', pipeline_status='new'로 insert. idempotent.
export async function pushFyiToKtc() {
  const fyi = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const ktc = createClient(process.env.KTC_SUPABASE_URL, process.env.KTC_SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // FYI의 KTC 공고 지원 (테스트 제외, 이메일 있는 것만 — 이메일이 파이프라인 정체성)
  const { data: jobs, error: jErr } = await fyi.from('jobs').select('id').eq('source', 'ktc')
  if (jErr) throw new Error(`fyi jobs: ${jErr.message}`)
  const ids = jobs.map(j => j.id)
  let apps = []
  for (let i = 0; i < ids.length; i += 50) {
    const { data, error } = await fyi
      .from('job_applications')
      .select('applicant_name, applicant_email, applicant_role, applicant_experience, resume_url, job_title, job_company, created_at')
      .in('job_id', ids.slice(i, i + 50))
      .order('created_at', { ascending: true })
    if (error) throw new Error(`fyi applications: ${error.message}`)
    apps = apps.concat(data)
  }
  apps = apps.filter(a => a.applicant_email && !a.applicant_email.endsWith('@likelion.net') && a.applicant_name)

  // 사람 단위로 축약 (첫 지원 기준 — candidates는 1인 1행)
  const byEmail = {}
  for (const a of apps) {
    const e = a.applicant_email.toLowerCase()
    if (!byEmail[e]) byEmail[e] = a
  }

  // ktc-support 기존재자 키 셋 (그쪽 동기화와 동일 규칙)
  const existing = new Set()
  for (let off = 0; ; off += 1000) {
    const { data, error } = await ktc
      .from('candidates')
      .select('email, full_name, phone, sheet_row_identifier')
      .range(off, off + 999)
    if (error) throw new Error(`ktc candidates: ${error.message}`)
    for (const c of data) {
      if (c.email) existing.add(c.email.toLowerCase())
      if (c.sheet_row_identifier) existing.add(c.sheet_row_identifier.toLowerCase())
      if (c.full_name && c.phone) existing.add(`${c.full_name}-${c.phone}`.toLowerCase())
    }
    if (data.length < 1000) break
  }

  const records = Object.entries(byEmail)
    .filter(([e]) => !existing.has(e))
    .map(([e, a]) => ({
      full_name: a.applicant_name,
      email: e,
      position: a.applicant_role || null,
      yoe: a.applicant_experience != null ? String(a.applicant_experience) : null,
      cv_url: a.resume_url || null,
      source: 'FYI',
      applied_date: (a.created_at || '').slice(0, 16).replace('T', ' '),
      applied_job: a.job_title || null,
      applied_company: a.job_company || null,
      sheet_source: 'FYI',
      sheet_row_identifier: e,
      pipeline_status: 'new',
    }))

  for (let i = 0; i < records.length; i += 200) {
    const { error } = await ktc.from('candidates').upsert(records.slice(i, i + 200), { onConflict: 'sheet_source,sheet_row_identifier' })
    if (error) throw new Error(`ktc push insert ${i}: ${error.message}`)
  }
  return { fyiPeople: Object.keys(byEmail).length, pushed: records.length, alreadyInPipeline: Object.keys(byEmail).length - records.length }
}

// ── 입사자 동기화: KTC Ops 시트 Employee + 매출현황 → ktc_hires ─────────────
const KTC_OPS_SHEET_ID = '1opr9KoR7KRZ31CJDNGM63xbA2rPZjPuNaG6eeLPTXjM'

const toNum = (s) => {
  const n = parseFloat(String(s || '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : null
}
const toDate = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || '').trim()) ? s.trim() : null)
const normName = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()

export async function syncKtcHires() {
  const { google } = await import('googleapis')
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  const sheets = google.sheets({ version: 'v4', auth })
  const fyi = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Employee 탭 — 헤더 행을 'Name'과 'e-mail' 포함 여부로 탐지 (상단 장식 행 존재)
  const empRes = await sheets.spreadsheets.values.get({ spreadsheetId: KTC_OPS_SHEET_ID, range: "'Employee'!A1:T" })
  const empRows = empRes.data.values || []
  const hIdx = empRows.findIndex(r => r.includes('Name') && r.some(c => /e-?mail/i.test(c || '')))
  if (hIdx < 0) throw new Error('Employee 탭 헤더를 찾지 못함')
  const H = empRows[hIdx]
  const col = (re) => H.findIndex(c => re.test((c || '').replace(/\n/g, ' ').trim()))
  const ci = {
    category: col(/^Category$/i), status: col(/^Status$/i), code: col(/^Code$/i),
    company: col(/^Company$/i), pos1: col(/^Position 1$/i), pos2: col(/^Position 2$/i),
    name: col(/^Name$/i), email: col(/^e-?mail$/i),
    interview: col(/^Interview/i), onboarding: col(/^Onboarding/i), salary: col(/Gross_USD/i),
  }
  const hires = []
  for (const r of empRows.slice(hIdx + 1)) {
    const email = (r[ci.email] || '').trim()
    const name = (r[ci.name] || '').trim()
    if (!name || !email.includes('@')) continue // 카운트/빈 행 스킵
    hires.push({
      code: (r[ci.code] || '').trim() || null,
      category: (r[ci.category] || '').trim() || null,
      status: (r[ci.status] || '').trim() || null,
      company: (r[ci.company] || '').trim() || null,
      position1: (r[ci.pos1] || '').trim() || null,
      position2: (r[ci.pos2] || '').trim() || null,
      full_name: name,
      email: email.toLowerCase(),
      interview_month: (r[ci.interview] || '').trim() || null,
      onboarding_raw: (r[ci.onboarding] || '').trim() || null,
      salary_usd: toNum(r[ci.salary]),
    })
  }

  // 매출현황 탭 — (이름) 매칭으로 매출/이익/입사일 병합
  const revRes = await sheets.spreadsheets.values.get({ spreadsheetId: KTC_OPS_SHEET_ID, range: "'매출현황'!A1:N" })
  const revRows = revRes.data.values || []
  const rIdx = revRows.findIndex(r => r.some(c => /기업명/.test(c || '')) && r.some(c => /이름/.test(c || '')))
  if (rIdx >= 0) {
    const RH = revRows[rIdx]
    const rc = (re) => RH.findIndex(c => re.test((c || '').trim()))
    const rci = {
      company: rc(/^기업명/), name: rc(/^이름/), hired: rc(/^입사일/), end: rc(/^계약 ?만료일/),
      left: rc(/^이탈 ?일/), revenue: rc(/^총 ?매출액/), profit: rc(/^이익/),
    }
    const byName = Object.fromEntries(hires.map(h => [normName(h.full_name), h]))
    for (const r of revRows.slice(rIdx + 1)) {
      const h = byName[normName(r[rci.name])]
      if (!h) continue
      h.hired_at = toDate(r[rci.hired])
      h.contract_end = toDate(r[rci.end])
      h.left_at = toDate(r[rci.left])
      h.revenue_usd = toNum(r[rci.revenue])
      h.profit_usd = toNum(r[rci.profit])
    }
  }

  const syncedAt = new Date().toISOString()
  const records = hires.map(h => ({ ...h, synced_at: syncedAt }))
  const { error: delErr } = await fyi.from('ktc_hires').delete().not('id', 'is', null)
  if (delErr) throw new Error(`hires delete: ${delErr.message}`)
  if (records.length) {
    const { error } = await fyi.from('ktc_hires').insert(records)
    if (error) throw new Error(`hires insert: ${error.message}`)
  }
  return { total: records.length, withRevenue: records.filter(r => r.revenue_usd != null).length }
}

export async function syncKtcCandidates() {
  const ktc = createClient(process.env.KTC_SUPABASE_URL, process.env.KTC_SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const fyi = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 1) ktc-support 에서 전체 candidates 페이지네이션으로 로드
  const rows = []
  for (let off = 0; ; off += 1000) {
    const { data, error } = await ktc
      .from('candidates')
      .select('sheet_source, sheet_row_identifier, full_name, email, phone, city, university, position, yoe, source, applied_job, applied_company, applied_date, pipeline_status')
      .range(off, off + 999)
    if (error) throw new Error(`ktc fetch: ${error.message}`)
    rows.push(...data)
    if (data.length < 1000) break
  }

  // 2) 변환 (upsert 키 없는 행은 스킵, 원본 내 중복 키는 첫 행만)
  const syncedAt = new Date().toISOString()
  const seen = new Set()
  const records = []
  let skipped = 0
  for (const r of rows) {
    if (!r.sheet_source || !r.sheet_row_identifier || !r.full_name) { skipped++; continue }
    const key = `${r.sheet_source} ${r.sheet_row_identifier}`
    if (seen.has(key)) continue
    seen.add(key)
    records.push({
      sheet_source: r.sheet_source,
      sheet_row_identifier: r.sheet_row_identifier,
      full_name: r.full_name,
      email: r.email || null,
      phone: r.phone || null,
      city: r.city || null,
      university: r.university || null,
      position: r.position || null,
      yoe: r.yoe || null,
      source: r.source || null,
      applied_job: r.applied_job || null,
      applied_company: r.applied_company || null,
      job_code: extractJobCode(r.applied_job),
      applied_date_raw: r.applied_date || null,
      applied_at: parseAppliedAt(r.applied_date, r.sheet_source),
      pipeline_status: r.pipeline_status || null,
      synced_at: syncedAt,
    })
  }

  // 3) upsert (500건 배치)
  for (let i = 0; i < records.length; i += 500) {
    const { error } = await fyi
      .from('ktc_candidates')
      .upsert(records.slice(i, i + 500), { onConflict: 'sheet_source,sheet_row_identifier' })
    if (error) throw new Error(`upsert batch ${i}: ${error.message}`)
  }

  return {
    fetched: rows.length,
    upserted: records.length,
    skipped,
    dateParsed: records.filter(r => r.applied_at).length,
    jobCoded: records.filter(r => r.job_code).length,
  }
}
