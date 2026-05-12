import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'Dev only' })
  }

  const email = req.query.email
  if (!email) {
    return res.status(400).send('Usage: /api/auth/dev-login?email=you@example.com')
  }

  const host = req.headers.host || 'localhost:3000'
  const baseUrl = `http://${host}`

  // Generate magic link and extract the token
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  // Extract token hash from the action link
  const actionLink = data?.properties?.action_link
  if (!actionLink) {
    return res.status(500).json({ error: 'Could not generate link', data })
  }

  // The action link goes to Supabase which then redirects to production.
  // Instead, call Supabase's verify endpoint directly to get a session.
  const tokenHash = data?.properties?.hashed_token
  const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink',
  })

  if (verifyError || !verifyData?.session) {
    return res.status(500).json({ error: verifyError?.message || 'verify failed', verifyData })
  }

  // Redirect to local /auth/callback with session in hash
  const sess = verifyData.session
  const hash = new URLSearchParams({
    access_token: sess.access_token,
    refresh_token: sess.refresh_token,
    expires_in: String(sess.expires_in ?? 3600),
    expires_at: String(sess.expires_at ?? ''),
    token_type: 'bearer',
    type: 'magiclink',
  }).toString()

  res.redirect(`${baseUrl}/auth/callback#${hash}`)
}
