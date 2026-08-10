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

// ── FYI 지원 건 공용 로더 ───────────────────────────────────────────────────
// KTC 공고의 job_applications 전량 — job_id 청크(.in 50개) × range 페이지네이션(1000행 캡).
async function fetchFyiApps(fyi, jobIds, select) {
  let apps = []
  for (let i = 0; i < jobIds.length; i += 50) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await fyi
        .from('job_applications')
        .select(select)
        .in('job_id', jobIds.slice(i, i + 50))
        .order('created_at', { ascending: true })
        .range(from, from + 999)
      if (error) throw new Error(`fyi applications: ${error.message}`)
      apps = apps.concat(data || [])
      if (!data || data.length < 1000) break
    }
  }
  return apps
}

// ── FYI 지원자 → ktc-support 파이프라인 유입 ────────────────────────────────
// salarymap의 KTC 공고 지원 건을 ktc-support candidates에 "지원건 단위"로 직접 넣는다.
// ktc-support 동기화가 2026-08-06부터 지원건 단위(재지원 = 새 행)로 바뀌어 여기도 맞췄다
// (이전엔 이메일 기존재 스킵 = 최초 채널 귀속이라, 타 채널로 먼저 들어온 사람의 FYI
// 재지원이 파이프라인에 안 잡혔음 — 2026-08-10 Presto 미표시 사건).
// 행 키 sheet_row_identifier = job_applications.id — 시트 FYI 탭 ID 컬럼과 같은 값이라
// ktc-support의 시트 재수집(identifier 우선 매칭)과 중복 없이 수렴한다. idempotent.
export async function pushFyiToKtc() {
  const fyi = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const ktc = createClient(process.env.KTC_SUPABASE_URL, process.env.KTC_SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: jobs, error: jErr } = await fyi.from('jobs').select('id, title, company, source_id').eq('source', 'ktc')
  if (jErr) throw new Error(`fyi jobs: ${jErr.message}`)
  const jobById = new Map(jobs.map(j => [j.id, j]))

  // 테스트 제외, 이메일·이름 있는 것만 (이메일이 파이프라인 정체성, 이름 없으면 후보 행 불가)
  let apps = await fetchFyiApps(fyi, jobs.map(j => j.id),
    'id, job_id, applicant_name, applicant_email, applicant_role, applicant_experience, resume_url, status, job_title, job_company, created_at')
  apps = apps.filter(a => a.applicant_email && !a.applicant_email.endsWith('@likelion.net') && a.applicant_name)
  // 취소 후 재지원 쌍은 활성 지원이 대표가 되게 활성을 앞으로
  apps.sort((a, b) => ((a.status === 'canceled') - (b.status === 'canceled')) || (a.created_at < b.created_at ? -1 : 1))

  // 기존 candidates — identifier(지원건 id) 직접 대조 + 사람(이메일)별 공고 매칭용 인덱스
  const idSet = new Set()
  const byEmail = new Map()
  for (let off = 0; ; off += 1000) {
    const { data, error } = await ktc
      .from('candidates')
      .select('email, sheet_row_identifier, applied_job, applied_company')
      .range(off, off + 999)
    if (error) throw new Error(`ktc candidates: ${error.message}`)
    for (const c of data) {
      if (c.sheet_row_identifier) idSet.add(c.sheet_row_identifier)
      const e = (c.email || '').toLowerCase()
      if (e) {
        if (!byEmail.has(e)) byEmail.set(e, [])
        byEmail.get(e).push(c)
      }
    }
    if (data.length < 1000) break
  }

  // 지원건 동일 판정: 코드 일치 > (한쪽이라도 무코드면) 제목+회사 일치 — ktc-support findExisting 축약판
  const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()
  const stripCode = s => norm(String(s || '').replace(/^[A-Z]{2,6}\d{3,4}(#\d+)?\s*[-–:]?\s*/, ''))
  const sameApp = (row, code, title, company) => {
    const rCode = extractJobCode(row.applied_job)
    if (code && rCode) return code === rCode
    return stripCode(row.applied_job) === stripCode(title) && norm(row.applied_company) === norm(company)
  }

  const seen = new Set() // 같은 실행 내 (사람|공고) 중복 방지
  const records = []
  let alreadyInPipeline = 0
  for (const a of apps) {
    if (idSet.has(a.id)) { alreadyInPipeline++; continue }
    const email = a.applicant_email.toLowerCase()
    const job = jobById.get(a.job_id)
    const code = extractJobCode(job?.source_id) // source_id 는 CODE 또는 CODE#2 (재게재)
    const title = (a.job_title || job?.title || '').trim()
    const company = a.job_company || job?.company || null
    const appKey = `${email}|${code || stripCode(title)}`
    if (seen.has(appKey)) { alreadyInPipeline++; continue }
    seen.add(appKey)
    if ((byEmail.get(email) || []).some(r => sameApp(r, code, title, company))) { alreadyInPipeline++; continue }
    records.push({
      full_name: a.applicant_name,
      email,
      position: a.applicant_role || null,
      yoe: a.applicant_experience != null ? String(a.applicant_experience) : null,
      cv_url: a.resume_url || null,
      source: 'FYI',
      applied_date: (a.created_at || '').slice(0, 16).replace('T', ' '),
      applied_job: code ? `${code} - ${title}` : title || null,
      applied_company: company,
      sheet_source: 'FYI',
      sheet_row_identifier: a.id,
      pipeline_status: 'new',
    })
  }

  for (let i = 0; i < records.length; i += 200) {
    const { error } = await ktc.from('candidates').upsert(records.slice(i, i + 200), { onConflict: 'sheet_source,sheet_row_identifier', ignoreDuplicates: true })
    if (error) throw new Error(`ktc push insert ${i}: ${error.message}`)
  }
  return { fyiPeople: apps.length, pushed: records.length, alreadyInPipeline }
}

// ── FYI 지원 건 → Candidate Data 시트 FYI 탭 append ─────────────────────────
// FYI 탭은 원래 베트남팀 Apps Script(recruitment@ 계정)가 채우는데, 새 공고마다
// Job ID를 스크립트에 수동 매핑해야 해서 매핑 누락 = 기록 유실이었다
// (2026-08-07 PS/LION 4공고 실사례 — 8/6~10 나흘 유실 후 수동 캐치업).
// 여기서는 salarymap DB를 원본으로 시트에 없는 지원 건(ID uuid)만 멱등 append 한다.
// JD Code 는 jobs.source_id 에서 자동 — 수동 매핑 불필요. 컬럼은 헤더명 기준 매핑이라
// 시트 컬럼 순서가 바뀌어도 안전. Apps Script 와 병행해도 양쪽 다 ID 대조라 중복 없고,
// 드물게 동시 실행으로 중복 행이 생겨도 ktc-support 수집이 같은 identifier 를 스킵한다.
export async function appendFyiToSheet({ dry = false } = {}) {
  const { google } = await import('googleapis')
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  const sheets = google.sheets({ version: 'v4', auth })
  const sheetId = process.env.GOOGLE_SHEET_ID
  const fyi = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `'FYI'!A1:Z` })
  const rows = res.data.values || []
  const header = rows[0] || []
  if (header[0] !== 'ID') throw new Error(`FYI 탭 헤더가 예상과 다름: ${JSON.stringify(header)}`)
  const have = new Set(rows.slice(1).map(r => r[0]).filter(Boolean))

  const { data: jobs, error: jErr } = await fyi.from('jobs').select('id, title, company, source_id').eq('source', 'ktc')
  if (jErr) throw new Error(`fyi jobs: ${jErr.message}`)
  const jobById = new Map(jobs.map(j => [j.id, j]))

  const apps = await fetchFyiApps(fyi, jobs.map(j => j.id),
    'id, job_id, applicant_name, applicant_email, applicant_role, applicant_experience, resume_url, status, job_title, job_company, created_at, utm_source, utm_medium, utm_campaign, utm_content, referrer, application_source')
  const missing = apps.filter(a => !have.has(a.id))

  // Ngày nộp 은 기존 행과 동일하게 dd/MM/yyyy HH:mm ICT
  const pad = n => String(n).padStart(2, '0')
  const ict = (iso) => {
    const d = new Date(new Date(iso).getTime() + 7 * 60 * 60 * 1000)
    return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
  }
  const outRows = missing.map(a => {
    const job = jobById.get(a.job_id)
    const vals = {
      ID: a.id,
      'Ngày nộp': ict(a.created_at),
      'Họ & Tên': a.applicant_name || '',
      Email: a.applicant_email || '',
      'Vị trí ứng tuyển': a.applicant_role || '',
      'Applied Job': (a.job_title || job?.title || '').trim(),
      'Applied Company': a.job_company || job?.company || '',
      'Job ID': a.job_id,
      'Năm kinh nghiệm': a.applicant_experience != null ? String(a.applicant_experience) : '',
      'CV URL': a.resume_url || '',
      'Trạng thái': a.status || '',
      'UTM Source': a.utm_source || '',
      'UTM Medium': a.utm_medium || '',
      'UTM Campaign': a.utm_campaign || '',
      'UTM Content': a.utm_content || '',
      Referrer: a.referrer || '',
      'Application Source': a.application_source || '',
      'JD Code': extractJobCode(job?.source_id) || '',
    }
    return header.map(h => vals[h] ?? '')
  })

  if (!dry && outRows.length) {
    for (let i = 0; i < outRows.length; i += 500) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: `'FYI'!A1`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: outRows.slice(i, i + 500) },
      })
    }
  }
  return { sheetRows: have.size, appended: outRows.length, dry }
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

// ── FYI 의 KTC 공고 ↔ JD 원장(Master 시트) 공고코드 매칭: jobs.source_id 백필 ──────
// FYI 에 올라간 KTC 공고에는 공고코드(FPT403 등)가 저장돼 있지 않아, 스태핑 마스터
// 대시보드가 FYI 직접 지원을 공고별로 귀속할 때 제목 추정 매칭에 의존해야 했다
// (2026-07-28 실사례: FPT403 의 FYI 지원 15건이 공고별 표시에서 통째로 누락).
// 여기서 코드를 jobs.source_id 에 영구 기록한다 — source_id 의 기존 의미("원본 소스의
// ID", 크롤러들이 source 별로 스코프해 사용)와 정확히 같은 용법이라 충돌 없음.
// 매칭 규칙(스태핑 마스터 aggregate 와 동일): ① 원장 내 유니크 제목 정확 일치
// ② 회사 매칭(영숫자 정규화 포함관계 — "FPT Software Korea" ⊃ "Fptsoftware") 후
//    제목 유사(괄호·" - " 접미 제거 정확/포함 → 앞 3단어 일치). 모호하면 건드리지 않는다.
// 이미 source_id 가 있는 행은 존중하고, 매칭 결과와 다르면 conflict 로 보고만 한다.
const MASTER_SHEET_ID = '1mR1_-a3LmjxAbbox3tTKBu6WYwDbfBYKmPB6TP9EnKI'

export async function syncKtcJobCodes({ dry = false } = {}) {
  const { google } = await import('googleapis')
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  const sheets = google.sheets({ version: 'v4', auth })
  const jdRes = await sheets.spreadsheets.values.get({ spreadsheetId: MASTER_SHEET_ID, range: "'JD EXECUTION'!A1:N" })
  const rows = jdRes.data.values || []
  const hIdx = rows.findIndex(r => r.some(c => /job\s*id/i.test(String(c || ''))))
  if (hIdx < 0) throw new Error('JD EXECUTION 헤더(Job ID) 탐지 실패')
  const H = rows[hIdx].map(c => String(c || '').replace(/\n/g, ' ').trim())
  const col = (re, fb) => { const i = H.findIndex(h => re.test(h)); return i >= 0 ? i : fb }
  const ci = { code: col(/job\s*id/i, 0), company: col(/company/i, 1), title: col(/job\s*title/i, 2) }

  const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()
  const aln = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const simp = s => norm(String(s || '').replace(/\([^)]*\)/g, ' ').split(' - ')[0])
  const titleToCode = {}
  const jdIndex = []
  for (const r of rows.slice(hIdx + 1)) {
    const code = String(r[ci.code] || '').trim()
    if (!code) continue
    const t = norm(r[ci.title])
    if (t) titleToCode[t] = titleToCode[t] === undefined ? code : null
    jdIndex.push({ code, comp: aln(r[ci.company]), title: simp(r[ci.title]) })
  }
  const matchCode = (title, company) => {
    const jc = aln(company)
    const compMatch = c => c === jc || (c.length >= 4 && jc.length >= 4 && (c.includes(jc) || jc.includes(c)))
    // 제목 정확 일치라도 회사가 어긋나면 기각 — 원장에 없는 회사(OpenMinds 등)의 공고가
    // 같은 제목의 남의 코드(SHU1101)에 붙는 오귀속 실사례가 있어서 (2026-07-28 드라이런에서 발견)
    const exact = titleToCode[norm(title)]
    if (exact) {
      const owner = jdIndex.find(x => x.code === exact)
      if (!jc || !owner?.comp || compMatch(owner.comp)) return exact
    }
    const jt = simp(title)
    const cands = jdIndex.filter(x => x.comp && jc && compMatch(x.comp))
    const strong = cands.filter(x => x.title === jt || (jt && (x.title.includes(jt) || jt.includes(x.title))))
    const p3 = s => s.split(' ').slice(0, 3).join(' ')
    const weak = cands.filter(x => p3(x.title) === p3(jt))
    const hit = strong.length ? strong : weak
    return hit.length && new Set(hit.map(x => x.code)).size === 1 ? hit[0].code : null
  }

  const fyi = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: jobs, error } = await fyi
    .from('jobs')
    .select('id, title, company, source_id, is_active, created_at')
    .eq('source', 'ktc')
    .order('created_at', { ascending: true })
  if (error) throw new Error(`jobs 조회: ${error.message}`)

  // 같은 공고가 FYI 에 여러 번 게재된 실사례(재게시)가 있고 (source, source_id) 유니크
  // 제약이 걸려 있어, 중복 게재분은 CODE#2, CODE#3 … 으로 기록한다 (읽는 쪽은 앞머리
  // 코드만 파싱하면 됨 — 스태핑 마스터도 ^[A-Z]{2,6}\d{3,4} 로 읽는다).
  const baseOf = s => (String(s || '').match(/^([A-Z]{2,6}\d{3,4})/) || [])[1] || null
  const taken = new Set((jobs || []).map(j => j.source_id).filter(Boolean))
  const toSet = []
  const ambiguous = []
  const conflicts = []
  for (const j of jobs || []) {
    const code = matchCode(j.title, j.company)
    if (j.source_id) {
      if (code && code !== baseOf(j.source_id)) conflicts.push({ id: j.id, title: j.title, company: j.company, saved: j.source_id, matched: code })
      continue
    }
    if (!code) {
      ambiguous.push({ title: j.title, company: j.company, active: j.is_active })
      continue
    }
    let sid = code
    for (let n = 2; taken.has(sid); n++) sid = `${code}#${n}`
    taken.add(sid)
    toSet.push({ id: j.id, sid, code, title: j.title, company: j.company })
  }
  if (!dry) {
    for (const u of toSet) {
      const { error: e } = await fyi.from('jobs').update({ source_id: u.sid }).eq('id', u.id)
      if (e) throw new Error(`source_id 업데이트(${u.sid}): ${e.message}`)
    }
  }
  return {
    total: (jobs || []).length,
    alreadySet: (jobs || []).filter(j => j.source_id).length,
    set: toSet.length,
    ambiguous,
    conflicts,
    dry,
    mapping: toSet.map(u => `${u.sid} ← ${u.company} · ${u.title}`),
  }
}
