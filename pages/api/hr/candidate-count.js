import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
)

export default async function handler(req, res) {
  const { count } = await supabase
    .from('candidates')
    .select('id', { count: 'exact', head: true })
    .not('name_vi', 'is', null)
    .neq('name_vi', '')

  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate')
  res.json({ count: count || 0 })
}
