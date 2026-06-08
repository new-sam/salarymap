import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// 홈 상단 이벤트 배너. event_banners 테이블(공개 SELECT)에서 활성 배너만 내려준다.
// (애널리틱스용 events 테이블과 별개 — 이름 충돌 회피.)
export default async function handler(req, res) {
  const { data, error } = await supabase
    .from('event_banners')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error || !data) {
    res.setHeader('Cache-Control', 'no-store')
    return res.status(500).json([])
  }

  // 노출 기간 필터 — starts_at/ends_at이 있으면 현재 시각 기준으로 거른다.
  const now = Date.now()
  const active = data.filter((b) => {
    if (b.starts_at && new Date(b.starts_at).getTime() > now) return false
    if (b.ends_at && new Date(b.ends_at).getTime() < now) return false
    return true
  })

  res.setHeader(
    'Cache-Control',
    active.length === 0
      ? 'no-store'
      : 'public, max-age=60, s-maxage=120, stale-while-revalidate=300'
  )
  res.status(200).json(active)
}
