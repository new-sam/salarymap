import supabase from '../../lib/supabaseAdmin'

const EXCLUDED_DOMAINS = ['likelion.net']

// 베트남(UTC+7) 기준 오늘 날짜 'YYYY-MM-DD' — 출석 streak의 "하루" 단위.
function vnDay() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { event, page, meta, email, userId, clientId } = req.body
  if (!event) return res.status(400).json({ error: 'event required' })

  if (email && EXCLUDED_DOMAINS.some(d => email.endsWith('@' + d))) {
    return res.json({ ok: true, skipped: true })
  }

  // Skip events from HR users to avoid data contamination
  if (email) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('email', email)
      .single()
    if (profile?.role === 'hr') return res.json({ ok: true, skipped: true })
  }

  const { error } = await supabase
    .from('events')
    .insert([{ event, page: page || null, meta: meta || null, user_id: userId || null, client_id: clientId || null }])

  if (error) return res.status(500).json({ error: error.message })

  // 로그인 사용자의 활동이면 오늘(베트남 기준) 출석을 기록 — 출석 streak 뱃지용.
  // 중복은 PK(user_id, day)로 무시. 실패해도 트래킹 응답은 막지 않는다.
  if (userId) {
    await supabase
      .from('user_activity_days')
      .upsert({ user_id: userId, day: vnDay() }, { onConflict: 'user_id,day', ignoreDuplicates: true })
  }

  res.json({ ok: true })
}
