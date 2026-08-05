import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'

/* /admin/showcasing-events 의 데이터 — 비공개 인재 전시장(/private/showcasing)에서
   찍힌 이벤트만 시간 역순으로.

   이벤트 '이름'이 아니라 page 로 거른다. 이 화면에서 붙일 이벤트가 앞으로 몇 개가 될지
   모르는데 이름 목록으로 거르면 새 이벤트를 추가할 때마다 여기도 같이 고쳐야 하고,
   고치는 걸 잊으면 화면에서 조용히 사라진다. page 는 화면 한 곳을 가리키는 값이라
   그럴 일이 없다 — track(event, { page: '/private/showcasing' }) 로만 보내면 된다. */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

const PAGE = '/private/showcasing'
const LIMIT = 300

export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const { data, error } = await supabase
      .from('events')
      .select('id, event, created_at, meta, client_id, user_id')
      .eq('page', PAGE)
      .order('created_at', { ascending: false })
      .limit(LIMIT)
    if (error) throw error

    const rows = data || []
    // 이벤트별 건수 — 목록보다 먼저 보는 건 "무엇이 몇 번 찍혔나"라서.
    const counts = {}
    for (const r of rows) counts[r.event] = (counts[r.event] || 0) + 1

    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({
      rows,
      counts,
      limit: LIMIT,
      // 방문자 수 대신 client_id 종류 수 — 로그인 없이 링크로 들어오는 화면이라
      // user_id 는 대부분 비어 있다.
      visitors: new Set(rows.map((r) => r.client_id).filter(Boolean)).size,
      // 링크를 실제로 연 기업 수 — 만들어 둔 링크 수가 아니라 열린 것만 센다.
      companies: new Set(rows.map((r) => r.meta?.co).filter(Boolean)).size,
      generatedAt: new Date().toISOString(),
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
