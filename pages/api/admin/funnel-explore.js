import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'

// 행동 퍼널 API — 계산은 전부 Postgres RPC(20260716_funnel_analytics.sql).
// 이벤트 행을 서버로 끌어와 JS로 세지 않는다.
//  ?catalog=1&from&to                            → 이벤트 카탈로그 (list_events)
//  ?steps=a,b,c&from&to&window=86400&order=this  → Amplitude 의미론 퍼널 (funnel)
//     window: 전환 윈도우(초, t0 기준 누적), order: this|any|exact
//  &mode=count                                   → 순서 무시 이벤트 건수만

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const STEP_RE = /^[a-zA-Z0-9_.:-]{2,64}$/
const MISSING_RPC = (e) => e && (e.code === 'PGRST202' || /function .* does not exist|schema cache/i.test(e.message || ''))

export default async function handler(req, res) {
  const user = await verifyAdminOrDevStub(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { from, to } = req.query
  const startISO = new Date(`${from || '2026-04-20'}T00:00:00+07:00`).toISOString()
  // to 는 "그 날 포함" 의미라 반열린 [from, to+1day) 로 변환
  const endISO = new Date(new Date(`${to || new Date().toISOString().slice(0, 10)}T00:00:00+07:00`).getTime() + 86400000).toISOString()

  try {
    if (req.query.catalog) {
      const { data, error } = await supabase.rpc('list_events', { p_from: startISO, p_to: endISO })
      if (error) throw error
      return res.status(200).json({ events: data || [] })
    }

    const steps = String(req.query.steps || '').split(',').map(s => s.trim()).filter(Boolean)
    if (steps.length < 2 || steps.length > 10 || !steps.every(s => STEP_RE.test(s))) {
      return res.status(400).json({ error: 'steps must be 2~10 event names' })
    }

    if (req.query.mode === 'count') {
      // 건수 모드는 퍼널이 아니라 단순 카운트 — DB head-count 병렬 쿼리
      const counts = await Promise.all(steps.map(async ev => {
        const { count } = await supabase.from('events')
          .select('id', { count: 'exact', head: true })
          .eq('event', ev).gte('created_at', startISO).lt('created_at', endISO)
        return count || 0
      }))
      return res.status(200).json({ mode: 'count', steps: steps.map((event, i) => ({ event, count: counts[i] })) })
    }

    const windowSec = Math.max(1, Math.min(parseInt(req.query.window, 10) || 86400, 366 * 86400))
    const order = ['this', 'any', 'exact'].includes(req.query.order) ? req.query.order : 'this'

    const { data, error } = await supabase.rpc('funnel', {
      p_steps: steps.map(event => ({ event })),
      p_from: startISO,
      p_to: endISO,
      p_window: `${windowSec} seconds`,
      p_order: order,
    })
    if (error) throw error

    const rows = (data || []).sort((a, b) => a.step_index - b.step_index)
    return res.status(200).json({
      mode: 'users',
      order,
      windowSec,
      steps: rows.map(r => ({
        event: r.step_name,
        users: Number(r.users),
        medianSec: r.median_sec,
        avgSec: r.avg_sec,
      })),
    })
  } catch (e) {
    if (MISSING_RPC(e)) {
      return res.status(501).json({ error: 'funnel RPC 미적용 — supabase/migrations/20260716_funnel_analytics.sql 을 SQL 에디터에서 실행하세요' })
    }
    res.status(500).json({ error: e.message })
  }
}
