import { createClient } from '@supabase/supabase-js'
import { EXCLUDED_EMAIL_DOMAINS } from '../lib/admin-metrics'

const BASE = 'https://salary-fyi.com'

// Static, always-indexable pages.
const STATIC_PATHS = [
  { loc: '/', changefreq: 'daily', priority: '1.0' },
  { loc: '/jobs', changefreq: 'daily', priority: '0.9' },
  { loc: '/community', changefreq: 'hourly', priority: '0.8' },
  { loc: '/how-it-works', changefreq: 'monthly', priority: '0.6' },
  { loc: '/for-companies', changefreq: 'monthly', priority: '0.5' },
]

function xmlEscape(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]))
}

function urlTag({ loc, changefreq, priority, lastmod }) {
  return [
    '  <url>',
    `    <loc>${xmlEscape(BASE + loc)}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : null,
    priority ? `    <priority>${priority}</priority>` : null,
    '  </url>',
  ].filter(Boolean).join('\n')
}

function dateOnly(v) {
  if (!v) return null
  const d = new Date(v)
  return isNaN(d) ? null : d.toISOString().slice(0, 10)
}

export async function getServerSideProps({ res }) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const urls = [...STATIC_PATHS]

  // Companies that have salary data — one URL per distinct (case-insensitive) name.
  try {
    const { data: subs } = await supabase.from('submissions').select('company').limit(20000)
    const seen = new Set()
    for (const s of subs || []) {
      const name = (s.company || '').trim()
      if (!name) continue
      const key = name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      urls.push({ loc: `/companies/${encodeURIComponent(name)}`, changefreq: 'weekly', priority: '0.7' })
    }
  } catch {}

  // Active job listings.
  try {
    const { data: jobs } = await supabase.from('jobs').select('id, created_at').eq('is_active', true).limit(5000)
    for (const j of jobs || []) {
      urls.push({ loc: `/jobs/${j.id}`, changefreq: 'weekly', priority: '0.6', lastmod: dateOnly(j.created_at) })
    }
  } catch {}

  // Real-user community posts only. Seed/team/banned authors are excluded so we
  // never feed Google thin/fake content. Requires the service-role key to resolve
  // author emails — without it we skip posts entirely rather than risk indexing seed.
  if (serviceKey) {
    try {
      const excluded = new Set()
      let page = 1
      let resolved = true
      while (true) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
        const users = data?.users
        if (error) { resolved = false; break }
        if (!users || users.length === 0) break
        for (const u of users) {
          const banned = u.banned_until && new Date(u.banned_until) > new Date()
          const internal = u.email && EXCLUDED_EMAIL_DOMAINS.some((d) => u.email.endsWith('@' + d))
          if (banned || internal) excluded.add(u.id)
        }
        if (users.length < 1000) break
        page++
      }
      if (resolved) {
        const { data: posts } = await supabase
          .from('community_posts')
          .select('id, user_id, created_at')
          .order('created_at', { ascending: false })
          .limit(10000)
        for (const p of posts || []) {
          if (excluded.has(p.user_id)) continue
          urls.push({ loc: `/community/${p.id}`, changefreq: 'weekly', priority: '0.6', lastmod: dateOnly(p.created_at) })
        }
      }
    } catch {}
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(urlTag).join('\n')}\n</urlset>`

  res.setHeader('Content-Type', 'application/xml')
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
  res.write(xml)
  res.end()
  return { props: {} }
}

export default function Sitemap() {
  return null
}
