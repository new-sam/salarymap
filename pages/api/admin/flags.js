import supabase from '../../../lib/supabaseAdmin'
import { verifyAdminOrDevStub } from './check'

// 실험 플래그 어드민 토글 — 목표지표 실험탭의 원클릭 롤백.
// GET: 현재 상태 / POST { key, enabled }: 스위치. experiment-metrics와 동일 인증(x-goal-pass).
const GOAL_PASSWORD = process.env.GOAL_METRICS_PASSWORD || 'wsj11029'
const KNOWN_FLAGS = ['hero_wizard', 'hard_gate', 'one_tap']

export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })
  if ((req.headers['x-goal-pass'] || '') !== GOAL_PASSWORD) {
    return res.status(403).json({ error: 'bad_pass' })
  }

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('app_flags').select('key, enabled, updated_at')
    if (error) return res.status(500).json({ error: error.message })
    const out = {}
    for (const k of KNOWN_FLAGS) out[k] = { enabled: true, updated_at: null } // 행 없으면 기본 ON
    for (const r of data || []) out[r.key] = { enabled: r.enabled, updated_at: r.updated_at }
    return res.status(200).json(out)
  }

  if (req.method === 'POST') {
    const { key, enabled } = req.body || {}
    if (!KNOWN_FLAGS.includes(key) || typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'key(hero_wizard|hard_gate|one_tap) + enabled(boolean) required' })
    }
    const { error } = await supabase
      .from('app_flags')
      .upsert({ key, enabled, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    if (error) return res.status(500).json({ error: error.message })
    // 감사 로그 — 언제 누가 껐는지 events에 남김
    await supabase.from('events').insert([{ event: 'experiment_flag_change', page: '/admin', meta: { key, enabled } }])
    return res.status(200).json({ ok: true, key, enabled })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
