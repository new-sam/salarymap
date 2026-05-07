import { createClient } from '@supabase/supabase-js'
import { verifyAdmin } from './check'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  const admin = await verifyAdmin(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    let page = 1
    let allUsers = []
    while (true) {
      const { data: { users }, error } = await supabase.auth.admin.listUsers({
        page,
        perPage: 1000,
      })
      if (error || !users || users.length === 0) break
      allUsers = allUsers.concat(users)
      if (users.length < 1000) break
      page++
    }

    const result = allUsers
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map(u => ({
        id: u.id,
        email: u.email || '',
        provider: u.app_metadata?.provider || '',
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at || '',
        full_name: u.user_metadata?.full_name || u.user_metadata?.name || '',
      }))

    return res.status(200).json(result)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
