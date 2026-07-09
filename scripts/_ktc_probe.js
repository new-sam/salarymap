require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function main() {
  // search company / source / title for ktc (case-insensitive)
  const { data, error } = await supabase
    .from('jobs')
    .select('id, company, source, source_id, title, is_active, created_at')
    .or('company.ilike.%ktc%,source.ilike.%ktc%,source_id.ilike.%ktc%,title.ilike.%ktc%')
    .order('created_at', { ascending: false })
  if (error) { console.error(error); return }
  console.log('MATCHES:', data.length)
  const byCompany = {}
  data.forEach(j => { byCompany[j.company] = (byCompany[j.company]||0)+1 })
  console.log('company counts:', JSON.stringify(byCompany, null, 2))
  const bySource = {}
  data.forEach(j => { bySource[j.source||'null'] = (bySource[j.source||'null']||0)+1 })
  console.log('source counts:', JSON.stringify(bySource, null, 2))
  console.log('sample:', JSON.stringify(data.slice(0,5), null, 2))
}
main().then(()=>process.exit(0))
