import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'

// 이탈자 코호트 (Amplitude Microscope) — reached 단계 도달 & butNot 단계 미도달 유저.
// funnel_users RPC 호출 후, user_key 가 로그인 유저(uuid)면 이메일을 붙여준다.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const STEP_RE = /^[a-zA-Z0-9_.:-]{2,64}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function handler(req, res) {
  const user = await verifyAdminOrDevStub(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { from, to } = req.query
  const steps = String(req.query.steps || '').split(',').map(s => s.trim()).filter(Boolean)
  const reached = parseInt(req.query.reached, 10)
  const butNot = req.query.butNot ? parseInt(req.query.butNot, 10) : null
  if (steps.length < 2 || steps.length > 10 || !steps.every(s => STEP_RE.test(s)) || !reached) {
    return res.status(400).json({ error: 'bad params' })
  }
  const windowSec = Math.max(1, Math.min(parseInt(req.query.window, 10) || 86400, 366 * 86400))
  const order = ['this', 'any', 'exact'].includes(req.query.order) ? req.query.order : 'this'
  const startISO = new Date(`${from || '2026-04-20'}T00:00:00+07:00`).toISOString()
  const endISO = new Date(new Date(`${to || new Date().toISOString().slice(0, 10)}T00:00:00+07:00`).getTime() + 86400000).toISOString()

  try {
    const rpcParams = {
      p_steps: steps.map(event => ({ event })),
      p_from: startISO,
      p_to: endISO,
      p_window: `${windowSec} seconds`,
      p_order: order,
      p_reached: reached,
      p_but_not: butNot,
    }
    // 목록 + "이탈 직후 1시간 내 첫 행동" 분포를 한 번에 (모달 1회 로드)
    const [usersRes, nextRes] = await Promise.all([
      supabase.rpc('funnel_users', { ...rpcParams, p_limit: 1000 }),
      supabase.rpc('funnel_next_actions', { ...rpcParams, p_gap: '1 hour', p_limit: 20 }),
    ])
    if (usersRes.error) throw usersRes.error
    const data = usersRes.data

    // 로그인 유저는 이메일 표시 (익명 client_id 는 그대로)
    const uuids = [...new Set((data || []).map(r => r.user_key).filter(k => UUID_RE.test(k)))]
    const emailMap = {}
    for (let i = 0; i < uuids.length; i += 200) {
      const { data: profiles } = await supabase.from('user_profiles')
        .select('id, email').in('id', uuids.slice(i, i + 200))
      for (const p of profiles || []) emailMap[p.id] = p.email
    }

    res.status(200).json({
      users: (data || []).map(r => ({
        key: r.user_key,
        email: emailMap[r.user_key] || null,
        entered_at: r.entered_at,
        last_step_at: r.last_step_at,
      })),
      nextActions: nextRes.error ? null : (nextRes.data || []).map(r => ({ event: r.event_name, users: Number(r.users) })),
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
