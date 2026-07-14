import { createClient } from '@supabase/supabase-js'
import { isExcludedSignup } from './admin-metrics'

// 가입 게이트 실험 집계 — 실험탭 API(experiment-metrics)와 롤백 알림 크론(experiment-alert)이 공유.
// 게이트 퍼널(company_gate_click → login_success) + 가드지표(제출/가입) + 롤백 판정.

// 실험 배포일(ICT). 이 날짜 이전 구간이 베이스라인.
export const EXPERIMENT_START = '2026-07-13'
// Phase 2: 하드 게이트(결과 전체 블러) + Google One Tap 배포일
export const PHASE2_START = '2026-07-14'
const WINDOW_DAYS = 28

// 롤백 기준 — "실험 전 7일 평균" 대비 "실험 후 최근 3 완결일 평균"의 비율.
// warnBelow 미만이면 주의(amber), rollbackBelow 미만이면 즉시 롤백(red).
export const ROLLBACK_RULES = [
  { key: 'submissions', labelKo: '제출/일', warnBelow: 0.85, rollbackBelow: 0.7 },
  { key: 'signups', labelKo: '가입/일', warnBelow: 1.0, rollbackBelow: 0.85 },
]

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

// VN(UTC+7) 기준 'YYYY-MM-DD'
const ICT_OFFSET_MS = 7 * 60 * 60 * 1000
const vnDay = (iso) => new Date(new Date(iso).getTime() + ICT_OFFSET_MS).toISOString().slice(0, 10)

async function fetchAll(build) {
  const PAGE = 1000
  let all = []
  let from = 0
  while (true) {
    const { data, error } = await build().range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || !data.length) break
    all = all.concat(data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return all
}

export async function computeExperimentMetrics() {
  const sinceIso = new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString()

  const [profiles, submissions, gateEvents] = await Promise.all([
    fetchAll(() => supabase.from('user_profiles')
      .select('created_at, email').gte('created_at', sinceIso).order('created_at')),
    fetchAll(() => supabase.from('submissions')
      .select('created_at, user_id, is_seed').gte('created_at', sinceIso).order('created_at')),
    fetchAll(() => supabase.from('events')
      .select('created_at, event, meta')
      .in('event', ['company_gate_click', 'company_gate_login_success', 'result_gate_view', 'one_tap_success'])
      .gte('created_at', sinceIso).order('created_at')),
  ])

  // 일별 버킷 초기화 (빈 날도 0으로)
  const days = {}
  for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
    const d = vnDay(new Date(Date.now() - i * 86400000).toISOString())
    days[d] = { day: d, signups: 0, submissions: 0, linked: 0, gateClicks: 0, gateLogins: 0, resultGateViews: 0, oneTapSignups: 0 }
  }
  const bump = (iso, key) => {
    const d = days[vnDay(iso)]
    if (d) d[key]++
  }

  for (const p of profiles) {
    if (isExcludedSignup(p)) continue
    bump(p.created_at, 'signups')
  }
  for (const s of submissions) {
    if (s.is_seed) continue
    bump(s.created_at, 'submissions')
    if (s.user_id) bump(s.created_at, 'linked')
  }
  for (const e of gateEvents) {
    if (e.event === 'company_gate_click') bump(e.created_at, 'gateClicks')
    else if (e.event === 'company_gate_login_success') bump(e.created_at, 'gateLogins')
    else if (e.event === 'result_gate_view') bump(e.created_at, 'resultGateViews')
    else if (e.event === 'one_tap_success' && e.meta?.new_user) bump(e.created_at, 'oneTapSignups')
  }

  const daily = Object.values(days)
  const before = daily.filter((d) => d.day < EXPERIMENT_START)
  const after = daily.filter((d) => d.day >= EXPERIMENT_START)
  const avg = (rows, key) => (rows.length ? rows.reduce((a, r) => a + r[key], 0) / rows.length : 0)
  const sum = (rows, key) => rows.reduce((a, r) => a + r[key], 0)
  const summary = (rows) => ({
    days: rows.length,
    signupsPerDay: avg(rows, 'signups'),
    submissionsPerDay: avg(rows, 'submissions'),
    linkedRate: sum(rows, 'submissions') ? sum(rows, 'linked') / sum(rows, 'submissions') : 0,
    gateClicks: sum(rows, 'gateClicks'),
    gateLogins: sum(rows, 'gateLogins'),
    resultGateViews: sum(rows, 'resultGateViews'),
    oneTapSignups: sum(rows, 'oneTapSignups'),
  })

  // 롤백 판정 — 오늘(진행중인 날)은 부분 집계라 제외하고 최근 3 완결일만 사용
  const todayVn = vnDay(new Date().toISOString())
  const baselineRows = before.slice(-7)
  const completedAfter = after.filter((d) => d.day !== todayVn)
  const recentRows = completedAfter.slice(-3)
  const rollback = {
    baselineDays: baselineRows.length,
    sampleDays: recentRows.length,
    rules: ROLLBACK_RULES.map((r) => {
      const baseline = avg(baselineRows, r.key)
      const current = recentRows.length ? avg(recentRows, r.key) : null
      const ratio = baseline > 0 && current != null ? current / baseline : null
      const status = ratio == null ? 'pending'
        : ratio < r.rollbackBelow ? 'rollback'
        : ratio < r.warnBelow ? 'warn'
        : 'ok'
      return { ...r, baseline, current, ratio, status }
    }),
  }

  return {
    experimentStart: EXPERIMENT_START,
    phase2Start: PHASE2_START,
    daily,
    before: summary(before),
    after: summary(after),
    rollback,
    generatedAt: new Date().toISOString(),
  }
}

// 인트라데이 펄스 — "지금까지"를 지난 7일 같은 시간대와 비교 (급락/급등 즉시 감지용).
// 두 윈도우: 오늘 0시(ICT)~지금 누적 + 최근 3시간 슬라이딩.
export async function computeIntradayPulse() {
  const LOOKBACK = 7
  const now = Date.now()
  const ictNow = new Date(now + ICT_OFFSET_MS)
  const todayStartMs = Date.UTC(ictNow.getUTCFullYear(), ictNow.getUTCMonth(), ictNow.getUTCDate()) - ICT_OFFSET_MS
  const elapsedMs = now - todayStartMs
  const sinceIso = new Date(todayStartMs - LOOKBACK * 86400000).toISOString()

  const [profiles, submissions, gateEvents] = await Promise.all([
    fetchAll(() => supabase.from('user_profiles')
      .select('created_at, email').gte('created_at', sinceIso).order('created_at')),
    fetchAll(() => supabase.from('submissions')
      .select('created_at, is_seed').gte('created_at', sinceIso).order('created_at')),
    fetchAll(() => supabase.from('events')
      .select('created_at, event')
      .in('event', ['result_gate_view', 'company_gate_login_success'])
      .gte('created_at', new Date(now - 3 * 3600e3).toISOString())),
  ])

  const countIn = (rows, startMs, dur) => rows.filter((r) => {
    const t = new Date(r.created_at).getTime()
    return t >= startMs && t < startMs + dur
  }).length

  const sources = [
    { key: 'submissions', label: '제출', rows: submissions.filter((s) => !s.is_seed) },
    { key: 'signups', label: '가입', rows: profiles.filter((p) => !isExcludedSignup(p)) },
  ]
  const windows = [
    { key: 'today', label: `오늘 누적 (${Math.floor(elapsedMs / 3600e3)}h)`, start: todayStartMs, dur: elapsedMs },
    { key: 'last3h', label: '최근 3시간', start: now - 3 * 3600e3, dur: 3 * 3600e3 },
  ]

  const metrics = []
  for (const src of sources) {
    for (const w of windows) {
      const today = countIn(src.rows, w.start, w.dur)
      let sum = 0
      for (let d = 1; d <= LOOKBACK; d++) sum += countIn(src.rows, w.start - d * 86400000, w.dur)
      const expected = sum / LOOKBACK
      metrics.push({
        metric: src.key, label: src.label, window: w.key, windowLabel: w.label,
        today, expected, ratio: expected > 0 ? today / expected : null,
      })
    }
  }

  return {
    elapsedMinutes: Math.round(elapsedMs / 60000),
    metrics,
    gateViews3h: gateEvents.filter((e) => e.event === 'result_gate_view').length,
    gateLogins3h: gateEvents.filter((e) => e.event === 'company_gate_login_success').length,
  }
}
