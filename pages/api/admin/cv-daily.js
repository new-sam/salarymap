import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'

/* /cv 퍼널을 날짜 × 단계 표로 준다. 배포 전후 비교는 창 두 개를 나란히 두느라
   "지금 어느 날이 좋았나"를 못 보여줬다 — 날짜를 세로로 깔면 배포일 전후가
   그대로 눈에 들어오고, 일간 변동폭이 얼마나 큰지도 같이 보인다.
   상단 날짜 피커를 그대로 따른다. */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const EVENTS = ['cv_view', 'cv_form_view', 'cv_open_picker', 'cv_attach_file',
                'cv_register_success', 'sign_up']
const PAGE = 1000
const MAX_ROWS = 120000
const vnToday = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10)
// VN(UTC+7) 기준 날짜 — 하루의 경계를 현지에 맞춘다.
const vnDay = (iso) => new Date(new Date(iso).getTime() + 7 * 3600000).toISOString().slice(0, 10)

/* /cv 개선 배포 시각. 그날 14:13 에 나가서 08-25 하루는 전후가 섞인다 —
   버리면 하루치(진입 124명)를 통째로 잃으므로 시각으로 갈라 두 줄로 낸다. */
const DEPLOY_AT = new Date('2026-08-25T14:13:00+07:00').getTime()
const DEPLOY_DAY = '2026-08-25'

export default async function handler(req, res) {
  if (!(await verifyAdminOrDevStub(req))) return res.status(401).json({ error: 'Unauthorized' })
  const { from, to } = req.query
  const startISO = new Date(`${from || vnToday()}T00:00:00+07:00`).toISOString()
  const endISO = new Date(new Date(`${to || vnToday()}T00:00:00+07:00`).getTime() + 86400000).toISOString()

  try {
    const rows = []
    let truncated = false
    for (let off = 0; off < MAX_ROWS; off += PAGE) {
      const { data, error } = await supabase
        .from('events').select('event, client_id, created_at')
        .in('event', EVENTS)
        .gte('created_at', startISO).lt('created_at', endISO)
        .order('created_at', { ascending: true })
        .range(off, off + PAGE - 1)
      if (error) throw error
      rows.push(...(data || []))
      if (!data || data.length < PAGE) break
      if (off + PAGE >= MAX_ROWS) truncated = true
    }

    /* 사람 단위로 센다 — 같은 사람이 하루에 여러 번 찍어도 1이다.
       client_id 가 없는 행은 버린다: 사람으로 접을 수 없어 분모를 부풀린다. */
    const per = new Map() // key → { day, part, event → Set }
    for (const r of rows) {
      if (!r.client_id) continue
      const d = vnDay(r.created_at)
      // 배포 당일만 시각으로 가른다. 나머지 날은 그대로 하루 한 줄.
      const part = d === DEPLOY_DAY
        ? (new Date(r.created_at).getTime() < DEPLOY_AT ? 'before' : 'after')
        : null
      const key = part ? `${d}#${part}` : d
      let g = per.get(key)
      if (!g) { g = { day: d, part }; for (const e of EVENTS) g[e] = new Set(); per.set(key, g) }
      g[r.event]?.add(r.client_id)
    }
    /* 가입은 전역 이벤트라 /cv 밖 유입도 섞인다 — 그날 /cv 를 본 사람과 교집합만 센다. */
    const order = (r) => `${r.day}${r.part === 'before' ? '0' : '1'}`
    const days = [...per.values()]
      .map(g => {
        const view = g.cv_view
        const o = { day: g.day, part: g.part, cv_view: view.size }
        for (const e of EVENTS) if (e !== 'cv_view' && e !== 'sign_up') o[e] = g[e].size
        o.signup = [...g.sign_up].filter(k => view.has(k)).length
        return o
      })
      .sort((a, b) => (order(a) < order(b) ? 1 : -1)) // 최신이 위, 같은 날은 후→전

    res.setHeader('Cache-Control', 'private, max-age=30')
    return res.status(200).json({ days, truncated })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
