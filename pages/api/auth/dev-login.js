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

  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: 'http://localhost:3000/auth/callback' },
  })

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  const url = data?.properties?.action_link
  if (url) {
    const fixed = url.replace(/redirect_to=[^&]*/, 'redirect_to=' + encodeURIComponent('http://localhost:3000/auth/callback'))
    return res.send(`
      <html><body style="font-family:system-ui;padding:40px;background:#111;color:#fff">
        <h2>Dev Login</h2>
        <p>Click to login as <b>${email}</b>:</p>
        <a href="${fixed}" style="color:#ff6000;font-size:18px">Login →</a>
        <br/><br/>
        <code style="font-size:11px;color:#666;word-break:break-all">${fixed}</code>
      </body></html>
    `)
  }

  return res.status(500).json({ error: 'Could not generate link', data })
}
