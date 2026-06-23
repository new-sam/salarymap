// 인앱 알림 목록 — 모바일(salary-fyi) 알림함이 호출.
// 인증: Authorization: Bearer <supabase access_token> (register.js와 동일 패턴).
//  GET ?cursor=<ISO created_at>&limit=  → 본인 알림(최신순) + 안 읽음 수
// 표시 문구는 클라가 type/actor_name/body로 현지화하므로 여기선 raw row만 돌려준다.
import supabaseAdmin from '../../../lib/supabaseAdmin';

const PAGE_SIZE = 30;

async function getUser(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const {
    data: { user },
  } = await supabaseAdmin.auth.getUser(token);
  return user || null;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const limit = Math.min(Number(req.query.limit) || PAGE_SIZE, 50);
  const cursor = req.query.cursor; // 이 시각보다 과거(<) 항목을 가져온다(무한 스크롤)

  let q = supabaseAdmin
    .from('notifications')
    .select('id, actor_id, actor_name, type, post_id, comment_id, body, data, read_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit + 1); // +1로 다음 페이지 존재 여부 판별
  if (cursor) q = q.lt('created_at', cursor);

  const { data: rows, error } = await q;
  if (error) return res.status(500).json({ error: error.message });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1].created_at : null;

  const { count: unreadCount } = await supabaseAdmin
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('read_at', null);

  return res.status(200).json({ items, nextCursor, unreadCount: unreadCount || 0 });
}
