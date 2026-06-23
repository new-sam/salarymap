// 알림 읽음 처리 — 모바일 알림함 진입 시 호출(배지 클리어).
// 인증: Authorization: Bearer <supabase access_token>.
//  POST { all: true }        → 안 읽은 내 알림 전부 읽음
//  POST { ids: [<id>, ...] } → 지정한 내 알림만 읽음
import supabaseAdmin from '../../../lib/supabaseAdmin';

async function getUser(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const {
    data: { user },
  } = await supabaseAdmin.auth.getUser(token);
  return user || null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { all, ids } = req.body || {};
  const now = new Date().toISOString();

  let q = supabaseAdmin
    .from('notifications')
    .update({ read_at: now })
    .eq('user_id', user.id) // 항상 본인 것만(소유 검증)
    .is('read_at', null);   // 이미 읽은 건 건드리지 않음

  if (all === true) {
    // 전체 — 추가 필터 없음
  } else if (Array.isArray(ids) && ids.length) {
    q = q.in('id', ids);
  } else {
    return res.status(400).json({ error: 'all or ids required' });
  }

  const { error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
