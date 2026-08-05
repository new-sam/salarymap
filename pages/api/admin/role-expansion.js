import supabase from '../../../lib/supabaseAdmin'
import { verifyAdminOrDevStub } from './check'
import { SUBMIT_CATEGORIES, submitRoleCategory, submitRoleLabel } from '../../../constants/jobs'

// 승주 작업실 [전직군 개편] 탭 — 직군 선택을 2단계(대분류 12 → 소분류 48)로 바꾸고
// 비개발까지 넓힌 개편이 실제로 먹히는지 본다.
//
// 기준일(rollout)은 첫 wizard_cat_click 이벤트 날짜로 자동 인식 — 배포일을 손으로 안 박는다.
// 배포 전에는 deployed:false 로 내려가고, 제출 기반 지표(현재 직군 구성)만 보인다.
//
// ⚠️ 시드(source='seed') 제출은 전부 제외 — 비개발 시드 3,700건이 실유입처럼 보이면 안 된다.
// ⚠️ 클릭/단계 이벤트는 배포 이후에만 쌓인다. 개편 전후 비교는 제출(submissions) 기준만 유효.

const DEV_CATS = new Set(['it', 'data', 'pm', 'design']) // 개편 전에도 고를 수 있던 직군
const DAY = 86400000
const vnDay = (iso) => new Date(new Date(iso).getTime() + 7 * 36e5).toISOString().slice(0, 10)

async function fetchAll(build) {
  const PAGE = 1000
  let all = [], from = 0
  while (true) {
    const { data, error } = await build().range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    all = all.concat(data || [])
    if (!data || data.length < PAGE) break
    from += PAGE
  }
  return all
}

export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })

  try {
    // 1) 개편 배포 시점 = 첫 대분류 클릭 이벤트
    const { data: firstCat } = await supabase.from('events').select('created_at')
      .eq('event', 'wizard_cat_click').order('created_at', { ascending: true }).limit(1)
    const rolloutAt = firstCat?.[0]?.created_at || null
    const rolloutDate = rolloutAt ? vnDay(rolloutAt) : null

    // 2) 창: 배포 후면 배포일 -14일부터(전후 비교), 배포 전이면 최근 30일
    const compareDays = 14
    const fromMs = rolloutAt
      ? new Date(rolloutAt).getTime() - compareDays * DAY
      : Date.now() - 30 * DAY
    const fromIso = new Date(fromMs).toISOString()

    const [events, subs] = await Promise.all([
      rolloutAt
        ? fetchAll(() => supabase.from('events').select('event, meta, created_at')
            .in('event', ['wizard_cat_click', 'wizard_step_1', 'wizard_step_4'])
            .gte('created_at', rolloutAt))
        : Promise.resolve([]),
      fetchAll(() => supabase.from('submissions').select('role, created_at')
        .neq('source', 'seed').gte('created_at', fromIso)),
    ])

    // 3) 대분류별 퍼널 (클릭 → 소분류 확정 → 제출 완료)
    const cat = {} // key → { clicks, starts, submits, subs }
    SUBMIT_CATEGORIES.forEach(c => { cat[c.key] = { clicks: 0, starts: 0, submits: 0, subs: 0 } })
    for (const e of events) {
      const m = e.meta || {}
      if (e.event === 'wizard_cat_click') {
        if (cat[m.cat]) cat[m.cat].clicks++
        continue
      }
      const c = submitRoleCategory(m.role)
      if (!c) continue
      if (e.event === 'wizard_step_1') cat[c.key].starts++
      else cat[c.key].submits++
    }

    // 4) 제출(실유입) — 대분류/소분류 분포 + 일별 개발:신규직군
    const daily = {}   // date → { dev, expand }
    const subRole = {} // 소분류 값 → 건수 (신규 직군만)
    const before = { dev: 0, expand: 0 }
    const after = { dev: 0, expand: 0 }
    for (const s of subs) {
      const c = submitRoleCategory(s.role)
      if (!c) continue
      const isDev = DEV_CATS.has(c.key)
      const d = vnDay(s.created_at)
      const row = (daily[d] ||= { date: d, dev: 0, expand: 0 })
      row[isDev ? 'dev' : 'expand']++
      // 배포 전에는 전 기간이 기준선(before) — 개편 후와 비교할 대상이 된다
      ;(rolloutDate && d >= rolloutDate ? after : before)[isDev ? 'dev' : 'expand']++
      if (!isDev) subRole[s.role] = (subRole[s.role] || 0) + 1
      if (cat[c.key]) cat[c.key].subs++
    }

    const cats = SUBMIT_CATEGORIES.map(c => ({
      key: c.key,
      label: { ko: c.label.ko, en: c.label.en },
      dev: DEV_CATS.has(c.key),
      ...cat[c.key],
    }))
    const sum = (keys, f) => cats.filter(c => keys.has(c.key)).reduce((a, c) => a + f(c), 0)
    const allKeys = new Set(cats.map(c => c.key))
    const expandKeys = new Set(cats.filter(c => !c.dev).map(c => c.key))

    res.json({
      deployed: !!rolloutAt,
      rolloutDate,
      compareDays,
      totals: {
        clicks: sum(allKeys, c => c.clicks),
        starts: sum(allKeys, c => c.starts),
        submits: sum(allKeys, c => c.submits),
        expandClicks: sum(expandKeys, c => c.clicks),
        expandStarts: sum(expandKeys, c => c.starts),
        expandSubmits: sum(expandKeys, c => c.submits),
      },
      // 개편 전후 실제 제출 구성 — 배포 전에는 before 가 비어 있다
      mix: { before, after },
      cats,
      subRoles: Object.entries(subRole)
        .map(([role, n]) => ({ role, label: { ko: submitRoleLabel(role, 'ko'), en: submitRoleLabel(role, 'en') }, n }))
        .sort((a, b) => b.n - a.n).slice(0, 20),
      daily: Object.values(daily).sort((a, b) => a.date.localeCompare(b.date)),
      generatedAt: new Date().toISOString(),
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
