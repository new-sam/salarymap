import { verifyAdminOrDevStub } from './check'
import { CATEGORIES, normalizePosition, fetchAll } from './talent-supply'

// 비개발 인재풀 추이 — "비개발 공고를 늘리는 액션이 실제로 인재풀을 늘렸나"를 보는 지표.
// 인재 공급 탭(스냅샷)과 같은 분류(normalizePosition)를 쓰되 가입일 기준 누적 곡선을 만든다.
//
// ⚠️ position/desired_roles 는 현재값이라, 나중에 직군을 바꾼 사람은 과거 날짜에도 지금 직군으로 잡힌다.
// ⚠️ 이력서 보유도 시점 정보가 없어 가입일에 얹는다. 둘 다 추세를 보는 근사치.
// ⚠️ 포지션 미입력이 절반을 넘어(≈56%) 여기 숫자는 "직군을 밝힌 사람" 기준의 하한이다.

const NONTECH = new Set(CATEGORIES.filter((c) => c.group === 'nontech').map((c) => c.key))
const CAT_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]))

// 그래프 세로선으로 표시할 액션. 새 액션을 하면 여기에 한 줄 추가한다.
const ACTIONS = [
  { id: 'vw-crawl', date: '2026-07-30', title: 'VietnamWorks 비개발 공고 게재', color: '#7C3AED' },
]

const DAY = 86400000
const toVN = (iso) => new Date(new Date(iso).getTime() + 7 * 3600000).toISOString().slice(0, 10)

export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const [profiles, jobs] = await Promise.all([
      fetchAll('user_profiles', 'id, created_at, position, desired_roles, resume_url'),
      fetchAll('jobs', 'role', (q) => q.eq('is_active', true)),
    ])

    const nowMs = Date.now()
    const today = toVN(new Date(nowMs).toISOString())
    const d7 = toVN(new Date(nowMs - 7 * DAY).toISOString())
    const d30 = toVN(new Date(nowMs - 30 * DAY).toISOString())

    const totals = { profiles: profiles.length, nontech: 0, nontechResume: 0, tech: 0, noPosition: 0 }
    const byDate = {} // 'YYYY-MM-DD' → { total, resume }
    const byCat = {}  // 카테고리 key → { all, resume, d7, d30 }

    for (const p of profiles) {
      let key = normalizePosition(p.position)
      if (!key && Array.isArray(p.desired_roles) && p.desired_roles.length) {
        key = normalizePosition(p.desired_roles.find((v) => String(v || '').trim()) || '')
      }
      if (!key) { totals.noPosition++; continue }
      if (!NONTECH.has(key)) { if (key !== 'other') totals.tech++; continue }

      const hasResume = !!p.resume_url
      const date = toVN(p.created_at)
      totals.nontech++
      if (hasResume) totals.nontechResume++

      const d = (byDate[date] ||= { total: 0, resume: 0 })
      d.total++
      if (hasResume) d.resume++

      const c = (byCat[key] ||= { all: 0, resume: 0, d7: 0, d30: 0 })
      c.all++
      if (hasResume) c.resume++
      if (date >= d7) c.d7++
      if (date >= d30) c.d30++
    }

    // 첫 비개발 가입일 ~ 오늘까지 하루도 빠짐없이 채운 누적 곡선
    const dates = Object.keys(byDate).sort()
    const series = []
    let total = 0
    let resume = 0
    for (let ms = new Date(`${dates[0] || today}T00:00:00Z`).getTime(); ; ms += DAY) {
      const date = new Date(ms).toISOString().slice(0, 10)
      const d = byDate[date]
      if (d) { total += d.total; resume += d.resume }
      series.push({ date, total, resume })
      if (date >= today) break
    }

    const categories = Object.entries(byCat)
      .map(([key, v]) => ({ key, ko: CAT_LABEL[key]?.ko || key, en: CAT_LABEL[key]?.en || key, vi: CAT_LABEL[key]?.vi || key, ...v }))
      .sort((a, b) => b.all - a.all)

    // 액션 쪽(공고) 현황 — 인재풀이 안 늘면 공고가 없어서인지 다른 문제인지 구분하려고 같이 본다.
    let nontechJobs = 0
    for (const j of jobs) {
      const key = normalizePosition(j.role)
      if (key && NONTECH.has(key)) nontechJobs++
    }

    res.setHeader('Cache-Control', 'no-store')
    res.json({
      generatedAt: new Date().toISOString(),
      totals,
      series,
      categories,
      actions: ACTIONS,
      jobs: { nontech: nontechJobs, active: jobs.length },
      recent: { d7: categories.reduce((s, c) => s + c.d7, 0), d30: categories.reduce((s, c) => s + c.d30, 0) },
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
