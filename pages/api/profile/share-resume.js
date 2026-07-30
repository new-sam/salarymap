import { createClient } from '@supabase/supabase-js'
import { sendResumeToVtm as sendToVtm, deleteResumeFromVtm as deleteFromVtm } from '../../../lib/vtm'
import { EXCLUDED_EMAILS } from '../../../lib/admin-metrics'

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
      .select('resume_url, full_name, is_resume_public, vtm_talent_id')
      .eq('id', user.id)
      .single()

    if (!profile?.resume_url) {
      return res.status(400).json({ error: 'No resume found' })
    }

    const { action } = req.body || {}

    /* QA 계정은 외부 인재마켓(VTM)에 실제로 올리지 않는다 — is_resume_public 과 응답은
       그대로 태워서 공개 처리 플로우는 실제와 동일하게 검증되고, 외부에는 안 나간다.
       계정 목록은 admin-metrics 의 EXCLUDED_EMAILS 하나로 관리. */
    const skipVtm = EXCLUDED_EMAILS.has((user.email || '').toLowerCase())

    // 명시적 set (idempotent) — /cv 등록 흐름에서 공개 ON을 확정적으로 켤 때 사용.
    // toggle과 달리 현재 상태를 뒤집지 않아 이미 공개된 이력서를 실수로 끄지 않는다.
    if (action === 'set') {
      const value = !!(req.body || {}).value
      if (value && !profile.is_resume_public) {
        const vtmResult = skipVtm ? {} : await sendToVtm(user.id, profile.resume_url, profile.full_name)
        await supabase
          .from('user_profiles')
          .update({ is_resume_public: true, vtm_talent_id: vtmResult.talent_id || null, updated_at: new Date().toISOString() })
          .eq('id', user.id)
      } else if (!value && profile.is_resume_public) {
        if (!skipVtm) await deleteFromVtm(user.id)
        await supabase
          .from('user_profiles')
          .update({ is_resume_public: false, vtm_talent_id: null, updated_at: new Date().toISOString() })
          .eq('id', user.id)
      }
      return res.json({ is_resume_public: value })
    }

    if (action === 'toggle') {
      const newValue = !profile.is_resume_public

      if (newValue) {
        // Turning ON → send PDF to VTM
        const vtmResult = skipVtm ? {} : await sendToVtm(user.id, profile.resume_url, profile.full_name)
        await supabase
          .from('user_profiles')
          .update({
            is_resume_public: true,
            vtm_talent_id: vtmResult.talent_id || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id)
      } else {
        // Turning OFF → delete from VTM
        if (!skipVtm) await deleteFromVtm(user.id)
        await supabase
          .from('user_profiles')
          .update({
            is_resume_public: false,
            vtm_talent_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id)
      }

      return res.json({ is_resume_public: newValue })
    }

    // Manual re-send
    if (!profile.is_resume_public) {
      return res.status(400).json({ error: 'Resume is not set to public' })
    }

    const vtmResult = skipVtm ? {} : await sendToVtm(user.id, profile.resume_url, profile.full_name)
    await supabase
      .from('user_profiles')
      .update({ vtm_talent_id: vtmResult.talent_id || null, updated_at: new Date().toISOString() })
      .eq('id', user.id)

    return res.json({ success: true })
  } catch (err) {
    console.error('Share resume error:', err)
    return res.status(500).json({ error: err.message || 'Failed to share resume' })
  }
}
