import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function isAdmin(email) {
  if (!email) return false
  // likelion.net domain = auto admin
  if (email.endsWith('@likelion.net')) return true
  const { data } = await supabase
    .from('admin_users')
    .select('id')
    .eq('email', email)
    .single()
  return !!data
}

export async function verifyAdmin(req) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  const admin = await isAdmin(user.email)
  if (!admin) return null
  return user
}

export default async function handler(req, res) {
  const { email } = req.query
  if (!email) return res.status(400).json({ isAdmin: false })
  const result = await isAdmin(email)
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({ isAdmin: result })
}
