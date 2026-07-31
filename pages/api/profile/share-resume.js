import { createClient } from '@supabase/supabase-js'

// 이력서 기업 공개(is_resume_public) ON/OFF. 공개 = 우리 공개 인재풀에 노출되는 것이고,
// 외부 인재마켓(VTM) 전송은 폐지됐다 — 예전엔 전송 성공이 공개의 전제라 전송이 실패하면
// 공개 자체가 500으로 죽었다(2026-07 웹 공개 전환율 붕괴의 원인).
const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'unauthorized' })

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'unauthorized' })

  try {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('resume_url, is_resume_public')
      .eq('id', user.id)
      .single()

    if (!profile?.resume_url) {
      return res.status(400).json({ error: 'No resume found' })
    }

    const { action } = req.body || {}
    const setPublic = (value) => supabase
      .from('user_profiles')
      .update({ is_resume_public: value, updated_at: new Date().toISOString() })
      .eq('id', user.id)

    // 명시적 set (idempotent) — /cv 등록 흐름에서 공개 ON을 확정적으로 켤 때 사용.
    // toggle과 달리 현재 상태를 뒤집지 않아 이미 공개된 이력서를 실수로 끄지 않는다.
    if (action === 'set') {
      const value = !!(req.body || {}).value
      if (value !== !!profile.is_resume_public) await setPublic(value)
      return res.json({ is_resume_public: value })
    }

    if (action === 'toggle') {
      const newValue = !profile.is_resume_public
      await setPublic(newValue)
      return res.json({ is_resume_public: newValue })
    }

    return res.status(400).json({ error: 'unknown action' })
  } catch (err) {
    console.error('Share resume error:', err)
    return res.status(500).json({ error: err.message || 'Failed to share resume' })
  }
}
