import { createClient } from '@supabase/supabase-js'

// 홍익대 국제언어교육원 QR 랜딩(/hongik)의 한국어 현장 인증.
// 가입(로그인)만 하면 korean_cert 가 비어 있을 때에 한해 현장 인증 마커를 넣는다 —
// TOPIK 급수 등 이미 있는 값은 절대 덮지 않는다(8/5 어학값 덮어쓰기 사고 원칙).
// 응답에 resume_url 유무를 실어 랜딩이 재방문자를 완료 화면으로 바로 보낼 수 있게 한다.
const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
)

const CERT_MARK = '홍익대 국제언어교육원 재학 (현장 인증)'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'unauthorized' })
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'unauthorized' })

  const { data: prof, error: findErr } = await supabase
    .from('user_profiles')
    .select('korean_cert, resume_url')
    .eq('id', user.id)
    .maybeSingle()
  if (findErr) return res.status(500).json({ error: findErr.message })

  const existing = (prof?.korean_cert || '').trim()
  let didSet = false
  if (!existing) {
    // OAuth 콜백의 프로필 upsert 와 경합할 수 있어 행이 아직 없으면 여기서 만든다
    const { error: upErr } = await supabase.from('user_profiles').upsert({
      id: user.id,
      email: user.email,
      korean_cert: CERT_MARK,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    if (upErr) return res.status(500).json({ error: upErr.message })
    didSet = true
  }

  const meta = req.body?.meta || {}
  await supabase.from('events').insert([{
    event: 'hongik_verify', page: '/hongik', user_id: user.id,
    meta: { ...meta, email: user.email, set: didSet, existing_cert: existing || null },
  }])

  return res.json({ ok: true, koreanCert: existing || CERT_MARK, hasResume: !!prof?.resume_url })
}
