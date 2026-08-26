import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'

/* /cv 이력서 등록 이탈의 "어디까지 갔나" — funnel-explore(RPC)는 meta 를 못 쪼개서
   따로 둔다. 순차 퍼널이 답하지 못하는 두 가지를 본다.
   ① 폼에 닿지 못한 사람이 아예 안 내려간 건가, 내려가다 만 건가 (cv_scroll_depth.pct)
   ② 폼에 닿은 사람은 무엇을 밟고 왔나 (cv_form_view.via — 히어로 CTA / 하단 바 / 맨손 스크롤)
   둘은 처방이 반대라(거리·신호 vs 중간 콘텐츠) 갈라 보지 않으면 판단이 안 선다. */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const EVENTS = ['cv_view', 'cv_scroll_depth', 'cv_form_view', 'cv_open_picker', 'cv_register_success']
const PAGE = 1000
const MAX_ROWS = 60000 // 안전판 — 넘으면 잘렸다고 알린다(무한 페이징 금지)
const vnToday = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10)

export default async function handler(req, res) {
  const user = await verifyAdminOrDevStub(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { from, to } = req.query
  const startISO = new Date(`${from || '2026-08-25'}T00:00:00+07:00`).toISOString()
  const endISO = new Date(new Date(`${to || vnToday()}T00:00:00+07:00`).getTime() + 86400000).toISOString()

  try {
    // 사람 단위로 접으려면 행이 필요하다 — client_id 와 meta 만 가져온다.
    const rows = []
    let truncated = false
    for (let off = 0; off < MAX_ROWS; off += PAGE) {
      const { data, error } = await supabase
        .from('events')
        .select('event, client_id, meta')
        .in('event', EVENTS)
        .gte('created_at', startISO).lt('created_at', endISO)
        .order('created_at', { ascending: true })
        .range(off, off + PAGE - 1)
      if (error) throw error
      rows.push(...(data || []))
      if (!data || data.length < PAGE) break
      if (off + PAGE >= MAX_ROWS) truncated = true
    }

    /* 사람 단위 집계. client_id 가 없는 행(구 계측·앱)은 셀 수 없으니 버린다 —
       분모에 넣으면 "안 내려간 사람"으로 잡혀 이탈이 과장된다. */
    const per = new Map()
    for (const r of rows) {
      const k = r.client_id
      if (!k) continue
      let u = per.get(k)
      if (!u) { u = { view: false, maxPct: -1, via: null, picker: false, done: false }; per.set(k, u) }
      if (r.event === 'cv_view') u.view = true
      else if (r.event === 'cv_scroll_depth') {
        const p = Number(r.meta?.pct)
        if (Number.isFinite(p) && p > u.maxPct) u.maxPct = p
      } else if (r.event === 'cv_form_view') { u.via = r.meta?.via || 'unknown' }
      else if (r.event === 'cv_open_picker') u.picker = true
      else if (r.event === 'cv_register_success') u.done = true
    }

    const viewers = [...per.values()].filter(u => u.view)
    const bucket = (u) => {
      if (u.via) return 'form'          // 폼까지 온 사람은 깊이와 무관하게 도달로 센다
      if (u.maxPct < 25) return 'lt25'  // 스크롤 이벤트가 없거나 25% 미만 — 사실상 안 내려감
      if (u.maxPct < 50) return 'p25'
      if (u.maxPct < 75) return 'p50'
      if (u.maxPct < 100) return 'p75'
      return 'p100'                     // 끝까지 내려갔는데 폼 도달이 안 찍힌 사람
    }
    const depth = { lt25: 0, p25: 0, p50: 0, p75: 0, p100: 0, form: 0 }
    const via = { hero: 0, scrolldown: 0, scroll: 0, unknown: 0 }
    let picker = 0, done = 0
    const viaDone = { hero: [0, 0], scrolldown: [0, 0], scroll: [0, 0] } // [도달, 등록완료]
    for (const u of viewers) {
      depth[bucket(u)]++
      if (u.picker) picker++
      if (u.done) done++
      if (u.via) {
        via[u.via in via ? u.via : 'unknown']++
        if (u.via in viaDone) { viaDone[u.via][0]++; if (u.done) viaDone[u.via][1]++ }
      }
    }

    res.setHeader('Cache-Control', 'private, max-age=30')
    return res.status(200).json({
      viewers: viewers.length,
      depth, via, picker, done, viaDone,
      truncated,
      // 스크롤 계측이 없던 기간을 섞으면 lt25 가 부풀려진다 — UI 가 경고를 띄우게 알려준다.
      scrollTracked: viewers.filter(u => u.maxPct >= 0 || u.via).length,
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
