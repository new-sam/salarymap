import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'
import { isExcludedEmail } from '../../../lib/admin-metrics'

// 승주 작업실 > 홍익 QR — /hongik 현장 캠페인 트래킹.
// 퍼널은 events(hongik_*)로 세고, 명단은 hongik_verify 유저를 프로필과 조인해 만든다.
//
// 제외 규칙: 클라이언트 이벤트(view/oauth_start/cv_success)는 /api/track 이 로그인한
// 팀 계정을 이미 걸러 넣지만, verify.js 가 서버에서 직접 넣는 hongik_verify/topik/roles 는
// 제외가 없다. 그래서 명단은 프로필 이메일로 팀 계정을 표시(excluded)하고 카운트에서 뺀다.
// 비로그인 view 는 이메일이 없어 못 거른다 — 유입 수는 그만큼 부풀 수 있는 참고치.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

const EVENTS = ['hongik_view', 'hongik_oauth_start', 'hongik_verify', 'hongik_topik', 'hongik_roles', 'hongik_cv_success']

const ICT_OFFSET_MS = 7 * 60 * 60 * 1000
const vnDay = (iso) => new Date(new Date(iso).getTime() + ICT_OFFSET_MS).toISOString().slice(0, 10)

// Supabase select 는 기본 1000행 캡 — range 페이지네이션(.order 필수).
async function fetchAll(build) {
  const PAGE = 1000
  let all = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1)
    if (error) throw error
    all = all.concat(data || [])
    if (!data || data.length < PAGE) break
  }
  return all
}

export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const evs = await fetchAll(() => supabase
      .from('events')
      .select('event, user_id, client_id, meta, created_at')
      .in('event', EVENTS)
      .order('created_at', { ascending: true }))

    const viewEvs = evs.filter(e => e.event === 'hongik_view')
    const startEvs = evs.filter(e => e.event === 'hongik_oauth_start')
    const verifyAt = new Map() // user_id → 첫 인증 시각
    const topikOf = new Map() // user_id → 마지막 응답(1~6 | 'none')
    const rolesOf = new Map() // user_id → 마지막 응답(배열 | 'skip')
    const cvSet = new Set()
    for (const e of evs) {
      if (!e.user_id) continue
      if (e.event === 'hongik_verify' && !verifyAt.has(e.user_id)) verifyAt.set(e.user_id, e.created_at)
      if (e.event === 'hongik_topik') topikOf.set(e.user_id, e.meta?.topik ?? null)
      if (e.event === 'hongik_roles') rolesOf.set(e.user_id, e.meta?.roles ?? null)
      if (e.event === 'hongik_cv_success') cvSet.add(e.user_id)
    }

    const uids = [...verifyAt.keys()]
    const profById = new Map()
    for (let i = 0; i < uids.length; i += 200) {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, full_name, korean_cert, desired_roles, resume_url')
        .in('id', uids.slice(i, i + 200))
      if (error) throw error
      for (const p of data || []) profById.set(p.id, p)
    }

    const people = uids
      .map(uid => {
        const p = profById.get(uid) || {}
        return {
          userId: uid,
          verifiedAt: verifyAt.get(uid),
          email: p.email || null,
          name: p.full_name || null,
          koreanCert: p.korean_cert || null,
          topik: topikOf.get(uid) ?? null,
          roles: rolesOf.get(uid) ?? null, // 배열 | 'skip' | null(스텝 미도달)
          hasCv: cvSet.has(uid) || !!p.resume_url,
          excluded: isExcludedEmail(p.email),
        }
      })
      .sort((a, b) => (a.verifiedAt < b.verifiedAt ? 1 : -1))

    const real = people.filter(p => !p.excluded)
    const topikDist = {}
    let topikNone = 0
    for (const p of real) {
      if (p.topik === 'none') topikNone++
      else if (p.topik != null) topikDist[p.topik] = (topikDist[p.topik] || 0) + 1
    }
    const roleFreq = {}
    let rolesChosen = 0
    let rolesSkipped = 0
    for (const p of real) {
      if (p.roles === 'skip') rolesSkipped++
      else if (Array.isArray(p.roles) && p.roles.length) {
        rolesChosen++
        for (const r of p.roles) roleFreq[r] = (roleFreq[r] || 0) + 1
      }
    }

    // 일별: 유입(뷰)과 가입·인증 — 재방문/다음 회차 부착 대비.
    const daily = {}
    for (const e of viewEvs) {
      const d = vnDay(e.created_at)
      daily[d] = daily[d] || { day: d, views: 0, verified: 0 }
      daily[d].views++
    }
    for (const p of real) {
      const d = vnDay(p.verifiedAt)
      daily[d] = daily[d] || { day: d, views: 0, verified: 0 }
      daily[d].verified++
    }

    res.json({
      views: {
        total: viewEvs.length,
        uniq: new Set(viewEvs.map(e => e.client_id).filter(Boolean)).size,
      },
      starts: new Set(startEvs.map(e => e.client_id).filter(Boolean)).size || startEvs.length,
      verified: real.length,
      topik: { answered: real.filter(p => p.topik != null).length, none: topikNone, dist: topikDist },
      roles: { chosen: rolesChosen, skipped: rolesSkipped, freq: roleFreq },
      cv: real.filter(p => p.hasCv).length,
      daily: Object.values(daily).sort((a, b) => (a.day < b.day ? 1 : -1)),
      people,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
