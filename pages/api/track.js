import supabase from '../../lib/supabaseAdmin'

const EXCLUDED_DOMAINS = ['likelion.net']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { event, page, meta, email } = req.body
  if (!event) return res.status(400).json({ error: 'event required' })

  if (email && EXCLUDED_DOMAINS.some(d => email.endsWith('@' + d))) {
    return res.json({ ok: true, skipped: true })
  }

  const { error } = await supabase
    .from('events')
    .insert([{ event, page: page || null, meta: meta || null }])

  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
}
