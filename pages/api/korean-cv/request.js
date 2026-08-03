import { createClient } from '@supabase/supabase-js'

// 한국식 이력서 첨삭 요청 접수/조회. 요청·발송 상태는 별도 테이블 없이 events 로 기록한다:
//   kcv_request(유저 요청) / kcv_sent(어드민 발송 완료, /admin/korean-cv 에서 기록)
// 마지막 kcv_request 이후 kcv_sent 가 있으면 처리 완료로 본다.
const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
)

export default async function handler(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'unauthorized' })
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'unauthorized' })

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('events')
      .select('event, created_at')
      .eq('user_id', user.id)
      .in('event', ['kcv_request', 'kcv_sent'])
      .order('created_at', { ascending: false })
    if (error) return res.status(500).json({ error: error.message })
    const lastRequest = (data || []).find(e => e.event === 'kcv_request')
    const lastSent = (data || []).find(e => e.event === 'kcv_sent')
    const requested = !!lastRequest
    const sent = !!lastSent && (!lastRequest || lastSent.created_at >= lastRequest.created_at)
    return res.json({ requested, sent })
  }

  if (req.method === 'POST') {
    const meta = req.body?.meta || {}
    const { error } = await supabase.from('events').insert([{
      event: 'kcv_request', page: '/korean-cv', user_id: user.id,
      meta: { ...meta, email: user.email },
    }])
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ ok: true })
  }

  return res.status(405).json({ error: 'method not allowed' })
}
