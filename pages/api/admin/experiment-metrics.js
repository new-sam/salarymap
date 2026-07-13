import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'
import { isExcludedSignup } from '../../../lib/admin-metrics'

// "목표지표 - Sean" 실험 탭 데이터 — 가입 게이트 실험(회사 데이터 언락: 제출 → 제출+로그인).
// 게이트 퍼널(company_gate_click → company_gate_login_success) + 가드지표(제출 수, 가입 수, 제출 로그인 연결률).
const GOAL_PASSWORD = process.env.GOAL_METRICS_PASSWORD || 'wsj11029'

// 실험 배포일(ICT). 이 날짜 이전 구간이 베이스라인.
const EXPERIMENT_START = '2026-07-13'
const WINDOW_DAYS = 28

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

export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })
  if ((req.headers['x-goal-pass'] || '') !== GOAL_PASSWORD) {
    return res.status(403).json({ error: 'bad_pass' })
  }

  try {
    const sinceIso = new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString()

    const [profiles, submissions, gateEvents] = await Promise.all([
      fetchAll(() => supabase.from('user_profiles')
        .select('created_at, email').gte('created_at', sinceIso).order('created_at')),
      fetchAll(() => supabase.from('submissions')
        .select('created_at, user_id, is_seed').gte('created_at', sinceIso).order('created_at')),
      fetchAll(() => supabase.from('events')
        .select('created_at, event')
        .in('event', ['company_gate_click', 'company_gate_login_success'])
        .gte('created_at', sinceIso).order('created_at')),
    ])

    // 일별 버킷 초기화 (빈 날도 0으로)
    const days = {}
    for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
      const d = vnDay(new Date(Date.now() - i * 86400000).toISOString())
      days[d] = { day: d, signups: 0, submissions: 0, linked: 0, gateClicks: 0, gateLogins: 0 }
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
      bump(e.created_at, e.event === 'company_gate_click' ? 'gateClicks' : 'gateLogins')
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
    })

    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({
      experimentStart: EXPERIMENT_START,
      daily,
      before: summary(before),
      after: summary(after),
      generatedAt: new Date().toISOString(),
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
