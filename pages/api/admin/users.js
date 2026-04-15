import { createClient } from '@supabase/supabase-js'
import { verifyAdmin } from './check'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  const admin = await verifyAdmin(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })

  // GET — list admins
  if (req.method === 'GET') {
    const { data } = await supabase
      .from('admin_users')
      .select('*')
      .order('created_at', { ascending: true })
    return res.status(200).json(data || [])
  }

  // POST — add admin
  if (req.method === 'POST') {
    const { email } = req.body
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' })
    }
    const { data, error } = await supabase
      .from('admin_users')
      .insert({ email: email.trim().toLowerCase(), added_by: admin.email })
      .select()
      .single()
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Already an admin' })
      return res.status(500).json({ error: error.message })
    }
    return res.status(201).json(data)
  }

  // DELETE — remove admin
  if (req.method === 'DELETE') {
    const { email } = req.body
    if (email === admin.email) {
      return res.status(400).json({ error: 'Cannot remove yourself' })
    }
    const { error } = await supabase
      .from('admin_users')
      .delete()
      .eq('email', email)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
