import { createClient } from '@supabase/supabase-js'

// 일반 사용자 약관/개인정보 동의 기록. 모바일(salary-fyi) 로그인 게이트에서 동의 후 호출.
// service_role로 Bearer 토큰의 user.id를 검증한 뒤 user_consents에 upsert한다.
// 베트남 PDPL 대비 동의 시점·약관 버전·마케팅 수신여부를 박제(법적 증빙).
const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
)

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'method not allowed' })
  }

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'unauthorized' })
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'unauthorized' })

  // GET: 이 계정이 특정 약관 버전에 이미 동의했는지 조회(모바일 로그인 후 동의 게이트 판단용).
  // 기기가 아닌 '계정' 단위로 동의를 판정하기 위해 서버 기록을 직접 확인한다.
  if (req.method === 'GET') {
    const version = (req.query.terms_version || '').toString().trim()
    const { data: record, error: readErr } = await supabase
      .from('user_consents')
      .select('terms_version, marketing_opt_in')
      .eq('user_id', user.id)
      .maybeSingle()
    if (readErr) return res.status(500).json({ error: readErr.message })
    const consented = !!record && (!version || record.terms_version === version)
    return res.status(200).json({
      consented,
      terms_version: record?.terms_version ?? null,
      marketing_opt_in: record?.marketing_opt_in ?? null,
    })
  }

  const { terms_version, marketing_opt_in, platform } = req.body || {}
  if (typeof terms_version !== 'string' || !terms_version.trim()) {
    return res.status(400).json({ error: 'terms_version required' })
  }

  // 마케팅 수신여부는 명시적 boolean으로 온 경우에만 갱신한다.
  // (게이트를 건너뛴 재로그인은 marketing_opt_in을 생략 → 기존 값 유지)
  let marketing
  if (typeof marketing_opt_in === 'boolean') {
    marketing = marketing_opt_in
  } else {
    const { data: existing } = await supabase
      .from('user_consents')
      .select('marketing_opt_in')
      .eq('user_id', user.id)
      .maybeSingle()
    marketing = existing?.marketing_opt_in ?? false
  }

  const now = new Date().toISOString()
  const { error } = await supabase.from('user_consents').upsert(
    {
      user_id: user.id,
      terms_agreed_at: now,
      privacy_agreed_at: now,
      terms_version: terms_version.trim(),
      marketing_opt_in: marketing,
      platform: platform || null,
      updated_at: now,
    },
    { onConflict: 'user_id' },
  )
  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ ok: true })
}
