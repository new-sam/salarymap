import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'
import { isExcludedSignup } from '../../../lib/admin-metrics'

// "목표지표 - Sean" 이력서 공개 전환 실험 탭 데이터.
// 실험: 웹 /cv 등록 흐름에 이력서 공개(오퍼 수신) 기본 ON 토글 추가 → 웹 공개 전환율 상승 여부.
// 앱은 예전부터 등록 시 공개를 기본 안내해 전환율이 높음 → 앱을 baseline으로 웹과 비교한다.
// 공개는 토글 이벤트가 없어 프로필 상태(is_resume_public) 스냅샷을 updated_at으로 버킷팅한다
// (추이 그래프와 동일 방식). resume_platform은 20260617 마이그 이후 행만 채워짐(이전=null 제외).
const GOAL_PASSWORD = process.env.GOAL_METRICS_PASSWORD || 'wsj11029'

// 웹 공개 토글 배포일(ICT). 이 날짜 이전이 베이스라인, 이후가 실험 구간. ⚠️실제 배포 시 갱신.
const EXPERIMENT_START = '2026-07-14'
const WINDOW_DAYS = 28

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

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
    const rows = (await fetchAll(() => supabase.from('user_profiles')
      .select('updated_at, email, is_resume_public, resume_platform')
      .not('resume_url', 'is', null)))
      .filter((r) => r.updated_at && !isExcludedSignup(r))

    // 누적 스냅샷(전 기간) — 헤드라인 전환율. resume_platform null(구데이터)은 앱/웹 어디에도 안 잡힘.
    const cum = { webReg: 0, webPublic: 0, appReg: 0, appPublic: 0 }
    for (const r of rows) {
      if (r.resume_platform === 'web') { cum.webReg++; if (r.is_resume_public) cum.webPublic++ }
      else if (r.resume_platform === 'app') { cum.appReg++; if (r.is_resume_public) cum.appPublic++ }
    }

    // 일별 버킷(최근 WINDOW_DAYS, updated_at 기준) — 빈 날도 0으로
    const days = {}
    const windowStart = vnDay(new Date(Date.now() - (WINDOW_DAYS - 1) * 86400000).toISOString())
    for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
      const d = vnDay(new Date(Date.now() - i * 86400000).toISOString())
      days[d] = { day: d, webReg: 0, webPublic: 0, appReg: 0, appPublic: 0 }
    }
    for (const r of rows) {
      const d = days[vnDay(r.updated_at)]
      if (!d) continue
      if (r.resume_platform === 'web') { d.webReg++; if (r.is_resume_public) d.webPublic++ }
      else if (r.resume_platform === 'app') { d.appReg++; if (r.is_resume_public) d.appPublic++ }
    }

    const daily = Object.values(days)
    const sum = (arr, k) => arr.reduce((a, r) => a + r[k], 0)
    const summary = (arr) => {
      const webReg = sum(arr, 'webReg'), webPublic = sum(arr, 'webPublic')
      const appReg = sum(arr, 'appReg'), appPublic = sum(arr, 'appPublic')
      return {
        days: arr.length,
        webReg, webPublic, webRate: webReg ? webPublic / webReg : 0,
        appReg, appPublic, appRate: appReg ? appPublic / appReg : 0,
      }
    }

    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({
      experimentStart: EXPERIMENT_START,
      windowStart,
      cumulative: {
        ...cum,
        webRate: cum.webReg ? cum.webPublic / cum.webReg : 0,
        appRate: cum.appReg ? cum.appPublic / cum.appReg : 0,
      },
      daily,
      before: summary(daily.filter((d) => d.day < EXPERIMENT_START)),
      after: summary(daily.filter((d) => d.day >= EXPERIMENT_START)),
      generatedAt: new Date().toISOString(),
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
