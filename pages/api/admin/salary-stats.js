import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'
import { fetchExcludedUserIds } from '../../../lib/admin-metrics'

// "승주 작업실" 연봉 수집 탭 데이터 — 인재풀(이력서 보유) 대비 현/직전연봉 확보 현황과 수집값 분석.
// 연봉 소스 2개: 직접기입(user_profiles.current_salary, 원 단위 — /salary-update 랜딩·프로필 폼)
//             > 뱃지 인증(salary_verifications approved, 백만 단위/월 — 증빙 검토 완료분) 폴백.
// 연봉위저드 제출(submissions)은 쓰지 않는다 — 익명 통계용 자기신고라 부정확(유저 지시 8/13,
// 정확한 값만: 직접기입·증빙인증). 값은 전부 백만 VND/월(triệu)로 통일. 인재풀 카드와 동일 우선순위.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

async function fetchAll(build) {
  const PAGE = 1000
  let all = [], from = 0
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

// 분포 구간(triệu/월) — 베트남 사무직 월급 스펙트럼 기준.
const BANDS = [
  { label: '<10', min: 0, max: 9 },
  { label: '10–14', min: 10, max: 14 },
  { label: '15–19', min: 15, max: 19 },
  { label: '20–24', min: 20, max: 24 },
  { label: '25–29', min: 25, max: 29 },
  { label: '30–39', min: 30, max: 39 },
  { label: '40–49', min: 40, max: 49 },
  { label: '50+', min: 50, max: Infinity },
]
const YOE_BANDS = [
  { label: '<1y', min: 0, max: 11 },
  { label: '1–2y', min: 12, max: 35 },
  { label: '3–4y', min: 36, max: 59 },
  { label: '5–6y', min: 60, max: 83 },
  { label: '7y+', min: 84, max: Infinity },
]

const quantile = (sorted, q) => {
  if (!sorted.length) return null
  const i = (sorted.length - 1) * q
  const lo = Math.floor(i), hi = Math.ceil(i)
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo))
}

export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const [profilesRaw, verifs, fillsRaw, excludedIds] = await Promise.all([
      fetchAll(() => supabase.from('user_profiles')
        .select('id, full_name, position, yoe_months, resume_url, current_salary')
        .not('resume_url', 'is', null).order('created_at', { ascending: false })),
      fetchAll(() => supabase.from('salary_verifications')
        .select('user_id, salary_amount, created_at')
        .eq('status', 'approved').order('created_at', { ascending: false })),
      fetchAll(() => supabase.from('events')
        .select('user_id, meta, created_at')
        .eq('event', 'coldmail_salary_fill').order('created_at', { ascending: false })),
      fetchExcludedUserIds(supabase),
    ])
    // 내부/테스트 계정(@likelion.net 등)은 수집 현황·분포에서 제외.
    const profiles = profilesRaw.filter((p) => !excludedIds.has(p.id))
    const fills = fillsRaw.filter((f) => !excludedIds.has(f.user_id))

    // 유저당 최신 승인 1건 (폴백 소스)
    const verified = {}
    for (const v of verifs) {
      if (!(v.user_id in verified)) verified[v.user_id] = v.salary_amount
    }

    // 사람 단위로 salary(triệu)·source 확정 — 직접기입 우선
    const sane = (v) => Number.isFinite(v) && v >= 1 && v <= 999
    const people = profiles.map((p) => {
      const direct = p.current_salary ? Math.round(p.current_salary / 1000000) : null
      const ver = verified[p.id] != null ? Math.round(verified[p.id]) : null
      const salary = sane(direct) ? direct : sane(ver) ? ver : null
      return { ...p, salary, source: sane(direct) ? 'direct' : sane(ver) ? 'verified' : null }
    })

    const experienced = people.filter((p) => (p.yoe_months ?? 0) >= 12)
    const count = (list, src) => list.filter((p) => p.source === src).length
    // 신입(경력 1년 미만 확인됨)은 현/직전연봉이 없는 게 정상 — "신입"으로 채운 것으로
    // 간주해 진행률에 포함(유저 지시 8/13). yoe 미상(null)은 신입이 아니라 미수집.
    const fresher = people.filter((p) => p.salary == null && p.yoe_months != null && p.yoe_months < 12).length
    const pool = {
      total: people.length,
      direct: count(people, 'direct'),
      verified: count(people, 'verified'),
      fresher,
      expTotal: experienced.length,
      expDirect: count(experienced, 'direct'),
      expVerified: count(experienced, 'verified'),
    }

    const withSalary = people.filter((p) => p.salary != null)
    const values = withSalary.map((p) => p.salary).sort((a, b) => a - b)
    const stats = {
      n: values.length,
      median: quantile(values, 0.5),
      avg: values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null,
      p25: quantile(values, 0.25),
      p75: quantile(values, 0.75),
    }

    const bands = BANDS.map((b) => ({
      label: b.label,
      direct: withSalary.filter((p) => p.source === 'direct' && p.salary >= b.min && p.salary <= b.max).length,
      verified: withSalary.filter((p) => p.source === 'verified' && p.salary >= b.min && p.salary <= b.max).length,
    })).map((b) => ({ ...b, total: b.direct + b.verified }))

    const byYoe = YOE_BANDS.map((b) => {
      const seg = withSalary
        .filter((p) => p.yoe_months != null && p.yoe_months >= b.min && p.yoe_months <= b.max)
        .map((p) => p.salary).sort((x, y) => x - y)
      return { label: b.label, n: seg.length, median: quantile(seg, 0.5) }
    })

    // 최근 랜딩 입력(콜드메일 전환 원본) — 프로필 조인해 직군·경력 표시. 프로필 폼 직접 수정은
    // 이벤트가 없어 이 목록엔 안 잡힌다(현황 카운트에는 포함).
    const profById = Object.fromEntries(people.map((p) => [p.id, p]))
    const recent = fills.slice(0, 30).map((f) => {
      const p = profById[f.user_id] || {}
      return {
        at: f.created_at,
        name: p.full_name || '(이름없음)',
        position: p.position || null,
        yoeMonths: p.yoe_months ?? null,
        amount: f.meta?.amount ?? null,
        type: f.meta?.type ?? null,
        campaign: f.meta?.campaign ?? null,
      }
    })

    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ pool, stats, bands, byYoe, recent, generatedAt: new Date().toISOString() })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
