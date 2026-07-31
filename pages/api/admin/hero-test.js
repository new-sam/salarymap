import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'

// 히어로 CTA 존치 판정 — "버튼을 눌렀다"가 아니라 "버튼 없이도 도달하는가"를 잰다.
//
//   ?target=cv    /cv   히어로 '바로 등록하기' → 등록 폼 도달
//   ?target=ktc   /ktc  히어로 '지금 지원하기' → 공고 섹션 도달
//
// 두 페이지 모두 도달 이벤트 meta.via 가 hero | nav | scrolldown | scroll 로 찍힌다.
// 도달 수만으로는 버튼의 값어치를 못 정한다 — 버튼이 아직 준비 안 된 사람을 끌고
// 내려온 것일 수도 있어서, 경로별 도달 이후 전환까지 같이 센다.
// 연결은 client_id(localStorage sm_cid — 로그인 전후로 유지).

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

const TARGETS = {
  cv: {
    view: 'cv_view',
    arrive: 'cv_form_view',
    steps: ['cv_attach_file', 'cv_oauth_start', 'cv_register_success'],
  },
  ktc: {
    view: 'ktc_view',
    arrive: 'ktc_jobs_view',
    // submit_application 은 /jobs 등 다른 표면에서도 찍히지만, 여기 집계 대상은
    // '공고 섹션에 도달한 client_id' 로 한정돼 있어 귀속이 크게 어긋나지 않는다.
    steps: ['ktc_job_click', 'submit_application'],
  },
}

const VIA = ['hero', 'nav', 'scrolldown', 'scroll']

async function fetchAll(build) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999)
    if (error) throw error
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

export default async function handler(req, res) {
  const user = await verifyAdminOrDevStub(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { from, to } = req.query
  if (!from || !to) return res.status(400).json({ error: 'from/to required' })
  const T = TARGETS[req.query.target]
  if (!T) return res.status(400).json({ error: 'target must be cv | ktc' })

  const gte = new Date(`${from}T00:00:00+07:00`).toISOString()
  const lt = new Date(new Date(`${to}T00:00:00+07:00`).getTime() + 86400000).toISOString()

  try {
    const [arrivals, rest, viewers] = await Promise.all([
      fetchAll(() => supabase.from('events')
        .select('client_id, meta, created_at')
        .eq('event', T.arrive).gte('created_at', gte).lt('created_at', lt)
        .order('created_at', { ascending: true })),
      fetchAll(() => supabase.from('events')
        .select('client_id, event, created_at')
        .in('event', T.steps).gte('created_at', gte).lt('created_at', lt)
        .order('created_at', { ascending: true })),
      fetchAll(() => supabase.from('events')
        .select('client_id')
        .eq('event', T.view).gte('created_at', gte).lt('created_at', lt)),
    ])

    // 사람당 첫 도달만 센다 — 같은 사람이 여러 번 오면 경로가 섞여 귀속이 흐려진다.
    const first = new Map()
    for (const a of arrivals) {
      if (!a.client_id || first.has(a.client_id)) continue
      first.set(a.client_id, {
        via: VIA.includes(a.meta?.via) ? a.meta.via : 'scroll',
        at: a.created_at,
      })
    }

    const blank = () => ({ reached: 0, ...Object.fromEntries(T.steps.map(s => [s, 0])) })
    const byVia = Object.fromEntries([...VIA, 'total'].map(k => [k, blank()]))
    for (const { via } of first.values()) { byVia[via].reached++; byVia.total.reached++ }

    // 도달 이후에 발생한 단계만, 사람당 단계별 1회.
    const seen = new Set()
    for (const e of rest) {
      const a = first.get(e.client_id)
      if (!a || e.created_at < a.at) continue
      const k = `${e.client_id}:${e.event}`
      if (seen.has(k)) continue
      seen.add(k)
      byVia[a.via][e.event]++
      byVia.total[e.event]++
    }

    res.json({
      target: req.query.target,
      steps: T.steps,
      viewers: new Set(viewers.map(v => v.client_id).filter(Boolean)).size,
      reached: first.size,
      byVia,
    })
  } catch (e) {
    console.error('hero-test:', e.message)
    res.status(500).json({ error: e.message })
  }
}