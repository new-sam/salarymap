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
