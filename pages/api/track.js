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

  // 출석 기록은 "분석"이 아니라 사용자 기능(streak 뱃지)이므로 내부/HR 제외와 무관하게
  // 항상 먼저 기록한다. (아래 EXCLUDED_DOMAINS/HR return은 events 분석 오염 방지용일 뿐)
  // 모바일 앱은 user_id를 meta 안에 넣어 보내므로 top-level/meta 둘 다에서 찾는다.
  // 중복은 PK(user_id, day)로 무시. 실패해도 트래킹 응답은 막지 않는다.
  const activeUserId = userId || (meta && meta.user_id) || null
  if (activeUserId) {
    await supabase
      .from('user_activity_days')
      .upsert({ user_id: activeUserId, day: vnDay() }, { onConflict: 'user_id,day', ignoreDuplicates: true })
  }

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

  res.json({ ok: true })
}
