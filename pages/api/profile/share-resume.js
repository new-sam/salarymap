import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
)

const VTM_WEBHOOK_URL = 'https://vtm-neon.vercel.app/api/webhook/portfolio'
const VTM_API_KEY = process.env.VTM_WEBHOOK_API_KEY || ''

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

    if (action === 'toggle') {
      const newValue = !profile.is_resume_public

      if (newValue) {
        // Turning ON → send PDF to VTM
        const vtmResult = await sendToVtm(user.id, profile.resume_url, profile.full_name)
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
        await deleteFromVtm(user.id)
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

    const vtmResult = await sendToVtm(user.id, profile.resume_url, profile.full_name)
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

async function sendToVtm(userId, resumeUrl, fullName) {
  const pdfRes = await fetch(resumeUrl)
  if (!pdfRes.ok) throw new Error('Failed to download resume PDF')

  const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer())
  const base64 = pdfBuffer.toString('base64')

  const webhookRes = await fetch(VTM_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': VTM_API_KEY,
    },
    body: JSON.stringify({
      pdf_base64: base64,
      name: fullName || '',
      source: 'salarymap',
      external_id: userId,
    }),
  })

  if (!webhookRes.ok) {
    const errText = await webhookRes.text().catch(() => 'unknown error')
    throw new Error(`VTM webhook failed (${webhookRes.status}): ${errText}`)
  }

  return webhookRes.json()
}

async function deleteFromVtm(userId) {
  const webhookRes = await fetch(VTM_WEBHOOK_URL, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': VTM_API_KEY,
    },
    body: JSON.stringify({
      source: 'salarymap',
      external_id: userId,
    }),
  })

  if (!webhookRes.ok) {
    const errText = await webhookRes.text().catch(() => 'unknown error')
    console.error(`VTM delete failed (${webhookRes.status}): ${errText}`)
  }
}
