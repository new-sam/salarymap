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
    .filter(t => t && !SKIP_TABS.includes(t))

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
  return { total: Object.values(perTab).reduce((s, n) => s + n, 0), perTab }
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
